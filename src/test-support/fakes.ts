import type { CommitInfo } from '../domain/review-session.js'
import type { GitRepository, RepositoryState } from '../git/git-repository.js'
import type { CommandResult, RunCommand } from '../process/run-command.js'
import type { ProviderAdapter, ProviderModel, ProviderStatus } from '../providers/provider-adapter.js'
import { providerDisplayNames } from '../providers/provider-adapter.js'

export const headCommit: CommitInfo = { hash: 'a'.repeat(40), subject: 'Add checkout form' }

// Git's empty tree in a SHA-1 repository
export const emptyTreeHash = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

export const commandResult = (overrides: Partial<CommandResult> = {}): CommandResult => ({
  exitCode: 0,
  stdout: '',
  stderr: '',
  failure: null,
  ...overrides,
})

// Answers by the joined command line; unknown commands fail like a missing binary.
export const fakeRunCommand =
  (responses: Readonly<Record<string, CommandResult>>): RunCommand =>
  async (command, args) =>
    responses[[command, ...args].join(' ')] ?? commandResult({ exitCode: null, failure: 'not-found' })

const fakeRepositoryState = (overrides: Partial<RepositoryState> = {}): RepositoryState => ({
  root: '/repo',
  branch: 'main',
  head: headCommit,
  hasChanges: true,
  ...overrides,
})

export const fakeGitRepository = (overrides: Partial<GitRepository> = {}): GitRepository => ({
  readVersion: async () => 'git version 2.50.0',
  resolveRoot: async () => '/repo',
  readState: async () => fakeRepositoryState(),
  resolveCommit: async (_root, ref) => (ref === 'HEAD' || headCommit.hash.startsWith(ref) ? headCommit : null),
  isInHeadHistory: async () => true,
  readEmptyTreeHash: async () => emptyTreeHash,
  listChangedFiles: async () => [
    { path: 'src/checkout.ts', previousPath: null, change: 'modified' },
    { path: '.env.local', previousPath: null, change: 'untracked' },
  ],
  readDiff: async (_root, _base, paths) => paths.map((path) => `diff --git a/${path} b/${path}\n`).join(''),
  ...overrides,
})

type FakeAdapterOptions = {
  status?: Partial<ProviderStatus>
  models?: ProviderModel[] | Error
}

export const fakeAdapter = (id: ProviderAdapter['id'], options: FakeAdapterOptions = {}): ProviderAdapter => ({
  id,
  displayName: providerDisplayNames[id],
  checkStatus: async () => ({ provider: id, version: '1.0.0', problem: null, fix: null, ...options.status }),
  listModels: async () => {
    if (options.models instanceof Error) {
      throw options.models
    }

    return (
      options.models ?? [
        { id: `${id}-large`, label: `${id}-large`, efforts: ['low', 'medium', 'high'] },
        { id: `${id}-small`, label: `${id}-small`, efforts: [] },
      ]
    )
  },
})
