import { rmSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import type { ReviewScope } from '../domain/review-session.js'
import type { GitRepository } from '../git/git-repository.js'

export type ReviewWorkspace = {
  // outside the repository; agents get read access to it
  directory: string
  diffPath: string
  cleanup: () => Promise<void>
}

export type PrepareWorkspace = (repositoryRoot: string, scope: ReviewScope) => Promise<ReviewWorkspace>

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

// Tracked paths for the diff; renames need both sides. New files are read in full instead.
export const trackedDiffPaths = (scope: ReviewScope): string[] => [
  ...new Set(
    scope.changedFiles
      .filter((file) => file.change !== 'untracked')
      .flatMap((file) => (file.previousPath === null ? [file.path] : [file.previousPath, file.path])),
  ),
]

// The diff is frozen at start, so every agent reviews the same change.
export const createWorkspacePreparer =
  (git: GitRepository): PrepareWorkspace =>
  async (repositoryRoot, scope) => {
    const directory = await mkdtemp(path.join(tmpdir(), 'ai-review-council-'))
    activeDirectories.add(directory)
    const diffPath = path.join(directory, 'change.diff')
    try {
      await writeFile(diffPath, await git.readDiff(repositoryRoot, scope.base.hash, trackedDiffPaths(scope)))
    } catch (error) {
      await removeDirectory(directory)
      throw error
    }

    return { directory, diffPath, cleanup: () => removeDirectory(directory) }
  }
