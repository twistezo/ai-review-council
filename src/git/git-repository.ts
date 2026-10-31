import type { ChangedFile, CommitInfo } from '../domain/review-session.js'
import type { RunCommand } from '../process/run-command.js'
import { isSuccessful } from '../process/run-command.js'
import { parseNameStatus, parseNulSeparated } from './git-output.js'

export type RepositoryState = {
  root: string
  // null means detached HEAD
  branch: string | null
  head: CommitInfo | null
  hasChanges: boolean
}

// Read-only Git access. Nothing here changes the repository.
export type GitRepository = {
  readVersion: () => Promise<string | null>
  resolveRoot: (directory: string) => Promise<string | null>
  readState: (root: string) => Promise<RepositoryState>
  resolveCommit: (root: string, ref: string) => Promise<CommitInfo | null>
  // true when the commit is HEAD or one of its ancestors
  isInHeadHistory: (root: string, hash: string) => Promise<boolean>
  listChangedFiles: (root: string, baseHash: string) => Promise<ChangedFile[]>
  // unified diff of tracked paths between the base and the working tree
  readDiff: (root: string, baseHash: string, paths: readonly string[]) => Promise<string>
}

const hexDigits = '0123456789abcdef'
// A large change or a long history takes longer than the default command timeout.
const diffTimeoutMs = 120_000

export const isCommitHashFormat = (value: string): boolean =>
  value.length >= 4 &&
  value.length <= 40 &&
  [...value.toLowerCase()].every((character) => hexDigits.includes(character))

export const createGitRepository = (run: RunCommand): GitRepository => {
  const git = async (cwd: string, args: readonly string[], timeoutMs?: number): Promise<string | null> => {
    const result = await run('git', args, { cwd, timeoutMs })

    return isSuccessful(result) ? result.stdout : null
  }

  const resolveCommit = async (root: string, ref: string): Promise<CommitInfo | null> => {
    // `--end-of-options` keeps a user-provided ref from being read as a flag.
    const output = await git(root, ['log', '-1', '--format=%H%x00%s', '--end-of-options', `${ref}^{commit}`])
    if (output === null) {
      return null
    }
    const [hash = '', subject = ''] = output.trim().split('\0')

    return hash.length === 40 ? { hash, subject } : null
  }

  return {
    readVersion: async () => {
      const result = await run('git', ['--version'])

      return isSuccessful(result) ? result.stdout.trim() : null
    },

    resolveRoot: async (directory) => {
      const output = await git(directory, ['rev-parse', '--show-toplevel'])

      return output === null ? null : output.trim()
    },

    readState: async (root) => {
      const [branchOutput, head, statusOutput] = await Promise.all([
        git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD']),
        resolveCommit(root, 'HEAD'),
        git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=normal']),
      ])

      return {
        root,
        branch: branchOutput === null ? null : branchOutput.trim(),
        head,
        hasChanges: statusOutput !== null && statusOutput !== '',
      }
    },

    resolveCommit,

    isInHeadHistory: async (root, hash) =>
      (await git(root, ['merge-base', '--is-ancestor', hash, 'HEAD'])) !== null,

    listChangedFiles: async (root, baseHash) => {
      // `git diff <base>` compares the base with the working tree: staged and unstaged changes.
      const [diffOutput, untrackedOutput] = await Promise.all([
        git(root, ['diff', '--name-status', '-z', '--find-renames', baseHash, '--']),
        git(root, ['ls-files', '--others', '--exclude-standard', '-z']),
      ])
      if (diffOutput === null || untrackedOutput === null) {
        throw new Error('Could not read changed files from Git')
      }
      const tracked = parseNameStatus(diffOutput)
      const trackedPaths = new Set(tracked.map((file) => file.path))
      const untracked: ChangedFile[] = parseNulSeparated(untrackedOutput)
        .filter((path) => !trackedPaths.has(path))
        .map((path) => ({ path, previousPath: null, change: 'untracked' }))

      return [...tracked, ...untracked].sort((left, right) => left.path.localeCompare(right.path))
    },

    readDiff: async (root, baseHash, paths) => {
      if (paths.length === 0) {
        return ''
      }
      // Paths are file names, not patterns: a file named `*` or `[id].tsx` must not pull in others.
      const output = await git(
        root,
        ['--literal-pathspecs', 'diff', '--find-renames', baseHash, '--', ...paths],
        diffTimeoutMs,
      )
      if (output === null) {
        throw new Error('Could not read the diff from Git')
      }

      return output
    },
  }
}
