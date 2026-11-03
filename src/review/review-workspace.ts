import { rmSync } from "node:fs"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import type { ReviewScope } from "../domain/review-session.js"
import type { GitRepository } from "../git/git-repository.js"

type ReviewWorkspace = {
  // outside the repository; agents get read access to it
  directory: string
  diffPath: string
  cleanup: () => Promise<void>
}

export type PrepareWorkspace = (
  repositoryRoot: string,
  scope: ReviewScope,
) => Promise<ReviewWorkspace>

// Temporary folders of runs in progress, so an interrupted app can still remove them.
const activeDirectories = new Set<string>()

const removeDirectory = async (directory: string): Promise<void> => {
  await rm(directory, { recursive: true, force: true })
  activeDirectories.delete(directory)
}

// Removes the folders of runs still in progress and returns how many there were.
export const removeActiveWorkspaces = async (): Promise<number> => {
  const directories = [...activeDirectories]
  await Promise.all(directories.map(removeDirectory))

  return directories.length
}

// The same for exits that cannot wait.
export const removeActiveWorkspacesSync = (): number => {
  const directories = [...activeDirectories]
  for (const directory of directories) {
    rmSync(directory, { recursive: true, force: true })
    activeDirectories.delete(directory)
  }

  return directories.length
}

// Keeps one `git diff` call far below the OS argument limit (about 1 MB on macOS).
const maxDiffBatchBytes = 100_000

// Tracked changes that share a path form one group, each path once; renames need both sides.
// New files are read in full instead.
const trackedPathGroups = (scope: ReviewScope): string[][] => {
  const groupOfPath = new Map<string, Set<string>>()
  const groups: Set<string>[] = []
  for (const file of scope.changedFiles) {
    if (file.change === "untracked") {
      continue
    }
    const paths =
      file.previousPath === null ? [file.path] : [file.previousPath, file.path]
    const [group = new Set<string>(), ...joinedGroups] = [
      ...new Set(paths.flatMap(filePath => groupOfPath.get(filePath) ?? [])),
    ]
    if (!groups.includes(group)) {
      groups.push(group)
    }
    for (const joined of joinedGroups) {
      paths.push(...joined)
      groups.splice(groups.indexOf(joined), 1)
    }
    for (const filePath of paths) {
      group.add(filePath)
      groupOfPath.set(filePath, group)
    }
  }

  return groups.map(group => [...group])
}

// Each group stays in one batch, so Git still pairs both sides of a rename.
export const trackedDiffBatches = (
  scope: ReviewScope,
  maxBatchBytes: number = maxDiffBatchBytes,
): string[][] => {
  const batches: string[][] = []
  let batch: string[] = []
  let batchBytes = 0
  for (const paths of trackedPathGroups(scope)) {
    let pathsBytes = 0
    for (const filePath of paths) {
      pathsBytes += Buffer.byteLength(filePath) + 1
    }
    if (batch.length > 0 && batchBytes + pathsBytes > maxBatchBytes) {
      batches.push(batch)
      batch = []
      batchBytes = 0
    }
    batch.push(...paths)
    batchBytes += pathsBytes
  }
  if (batch.length > 0) {
    batches.push(batch)
  }

  return batches
}

// The diff is frozen at start, so every agent reviews the same change.
export const createWorkspacePreparer =
  (git: GitRepository): PrepareWorkspace =>
  async (repositoryRoot, scope) => {
    const directory = await mkdtemp(path.join(tmpdir(), "ai-review-council-"))
    activeDirectories.add(directory)
    const diffPath = path.join(directory, "change.diff")
    try {
      const diffs: string[] = []
      for (const paths of trackedDiffBatches(scope)) {
        diffs.push(await git.readDiff(repositoryRoot, scope.diffBase, paths))
      }
      await writeFile(diffPath, diffs.join(""))
    } catch (error) {
      await removeDirectory(directory)
      throw error
    }

    return { directory, diffPath, cleanup: () => removeDirectory(directory) }
  }
