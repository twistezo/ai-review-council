import { describe, expect, it } from 'vitest'

import { fakeAdapter, fakeGitRepository } from '../test-support/fakes.js'
import type { PreflightCheck, PreflightDependencies, PreflightResult } from './run-preflight.js'
import { runPreflight } from './run-preflight.js'

const dependencies = (overrides: Partial<PreflightDependencies> = {}): PreflightDependencies => ({
  git: fakeGitRepository(),
  adapters: [fakeAdapter('codex'), fakeAdapter('claude')],
  findMissingInstructionFiles: async () => [],
  ...overrides,
})

const checkLabelled = (result: PreflightResult, label: string): PreflightCheck | undefined =>
  result.checks.find((check) => check.label === label)

describe('runPreflight', () => {
  it('passes and collects the models of both providers', async () => {
    const result = await runPreflight(dependencies())

    expect(result.blocker).toBeNull()
    expect(result.models.map((model) => `${model.provider}/${model.id}`)).toEqual([
      'codex/codex-large',
      'codex/codex-small',
      'claude/claude-large',
      'claude/claude-small',
    ])
  })

  it('continues with one provider when the other is unavailable', async () => {
    const result = await runPreflight(
      dependencies({
        adapters: [
          fakeAdapter('codex', { status: { problem: 'Provider is unavailable.' } }),
          fakeAdapter('claude'),
        ],
      }),
    )

    expect(result.blocker).toBeNull()
    expect(checkLabelled(result, 'Codex')).toEqual({
      label: 'Codex',
      state: 'unavailable',
      detail: 'Provider is unavailable.',
      fix: null,
    })
    expect(result.models.every((model) => model.provider === 'claude')).toBe(true)
  })

  it('blocks when neither provider is available', async () => {
    const result = await runPreflight(
      dependencies({
        adapters: [
          fakeAdapter('codex', { status: { problem: '`codex` was not found in PATH.' } }),
          fakeAdapter('claude', { models: new Error('timeout') }),
        ],
      }),
    )

    expect(result.blocker).toBe('At least one of Codex or Claude must be available.')
    expect(checkLabelled(result, 'Claude')).toEqual({
      label: 'Claude',
      state: 'unavailable',
      detail: 'Could not read the model catalog: timeout',
      fix: 'Update the CLI to the latest version.',
    })
  })

  it('blocks when only Copilot is available, since it cannot be the council agent', async () => {
    const result = await runPreflight(
      dependencies({
        adapters: [
          fakeAdapter('codex', { status: { problem: '`codex` was not found in PATH.' } }),
          fakeAdapter('copilot', { models: [{ id: 'auto', label: 'Auto', efforts: [] }] }),
        ],
      }),
    )

    expect(result.models.map((model) => model.provider)).toEqual(['copilot'])
    expect(result.blocker).toBe('At least one of Codex or Claude must be available.')
  })

  it('keeps Copilot usable as a reviewer next to a council provider', async () => {
    const result = await runPreflight(
      dependencies({
        adapters: [
          fakeAdapter('codex'),
          fakeAdapter('copilot', {
            models: [{ id: 'auto', label: 'Auto', efforts: [] }],
          }),
        ],
      }),
    )

    expect(result.blocker).toBeNull()
    expect(checkLabelled(result, 'Copilot')).toEqual({
      label: 'Copilot',
      state: 'ok',
      detail: '1.0.0, 1 model',
      fix: null,
    })
  })

  it('blocks when Git is missing, even with providers available', async () => {
    const result = await runPreflight(dependencies({ git: fakeGitRepository({ readVersion: async () => null }) }))

    expect(result.blocker).toBe('Git is required.')
    expect(checkLabelled(result, 'Git')).toMatchObject({ state: 'failed', detail: '`git` was not found in PATH. Git is required.' })
  })

  it('names every blocker at once when Git, the instructions and the council providers are all missing', async () => {
    const result = await runPreflight(
      dependencies({
        git: fakeGitRepository({ readVersion: async () => null }),
        adapters: [fakeAdapter('codex', { status: { problem: '`codex` was not found in PATH.' } })],
        findMissingInstructionFiles: async () => ['common.md', 'reviewer/reviewer.md'],
      }),
    )

    expect(result.blocker).toBe(
      'Git is required. Instruction files are missing. At least one of Codex or Claude must be available.',
    )
    expect(checkLabelled(result, 'Instructions')?.detail).toBe('Missing: docs/common.md, docs/reviewer/reviewer.md')
  })

  it('treats a provider that lists no models as unavailable', async () => {
    const result = await runPreflight(dependencies({ adapters: [fakeAdapter('codex', { models: [] }), fakeAdapter('claude')] }))

    expect(result.blocker).toBeNull()
    expect(checkLabelled(result, 'Codex')).toEqual({
      label: 'Codex',
      state: 'unavailable',
      detail: 'The CLI returned no models.',
      fix: 'Check your plan and CLI configuration.',
    })
    expect(result.models.some((model) => model.provider === 'codex')).toBe(false)
  })

  it('treats a provider whose check throws as unavailable and goes on with the others', async () => {
    const broken = fakeAdapter('codex')
    const result = await runPreflight(
      dependencies({
        adapters: [
          {
            ...broken,
            checkStatus: async () => {
              throw new Error('spawn EACCES')
            },
          },
          fakeAdapter('claude'),
        ],
      }),
    )

    expect(result.blocker).toBeNull()
    expect(checkLabelled(result, 'Codex')).toMatchObject({
      state: 'unavailable',
      detail: 'Could not check the CLI: spawn EACCES',
    })
    expect(result.models.every((model) => model.provider === 'claude')).toBe(true)
  })

  it('blocks with a Git check failure when running Git throws', async () => {
    const git = fakeGitRepository({
      readVersion: async () => {
        throw new Error('spawn git EACCES')
      },
    })
    const result = await runPreflight(dependencies({ git }))

    expect(result.blocker).toBe('Git is required.')
    expect(checkLabelled(result, 'Git')).toMatchObject({
      state: 'failed',
      detail: 'Could not run `git --version`: spawn git EACCES',
    })
  })

  it('shows only the model count when the CLI reports no version', async () => {
    const result = await runPreflight(dependencies({ adapters: [fakeAdapter('claude', { status: { version: null } })] }))

    expect(checkLabelled(result, 'Claude')).toMatchObject({ state: 'ok', detail: '2 models' })
  })

  it('blocks when instruction files are missing', async () => {
    const result = await runPreflight(dependencies({ findMissingInstructionFiles: async () => ['council/council.md'] }))

    expect(result.blocker).toBe('Instruction files are missing.')
    expect(checkLabelled(result, 'Instructions')).toEqual({
      label: 'Instructions',
      state: 'failed',
      detail: 'Missing: docs/council/council.md',
      fix: 'Reinstall the app or restore the missing files.',
    })
  })
})
