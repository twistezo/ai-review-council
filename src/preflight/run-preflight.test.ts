import { describe, expect, it } from 'vitest'

import { fakeAdapter, fakeGitRepository } from '../test-support/fakes.js'
import type { PreflightDependencies } from './run-preflight.js'
import { runPreflight } from './run-preflight.js'

const dependencies = (overrides: Partial<PreflightDependencies> = {}): PreflightDependencies => ({
  git: fakeGitRepository(),
  adapters: [fakeAdapter('codex'), fakeAdapter('claude')],
  findMissingInstructionFiles: async () => [],
  ...overrides,
})

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

  it('continues with one provider when the other is not logged in', async () => {
    const result = await runPreflight(
      dependencies({
        adapters: [
          fakeAdapter('codex', { status: { problem: 'Not logged in.', fix: 'Run `codex login`' } }),
          fakeAdapter('claude'),
        ],
      }),
    )

    expect(result.blocker).toBeNull()
    expect(result.checks[1]).toEqual({
      label: 'Codex',
      state: 'unavailable',
      detail: 'Not logged in.',
      fix: 'Run `codex login`',
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

    expect(result.blocker).toBe('At least one of Codex or Claude Code must be installed and logged in.')
    expect(result.checks[2]?.detail).toBe('Could not read the model catalog: timeout')
  })

  it('blocks when Git is missing, even with providers available', async () => {
    const result = await runPreflight(dependencies({ git: fakeGitRepository({ readVersion: async () => null }) }))

    expect(result.blocker).toBe('Git is required.')
  })

  it('blocks when instruction files are missing', async () => {
    const result = await runPreflight(dependencies({ findMissingInstructionFiles: async () => ['council/council.md'] }))

    expect(result.blocker).toBe('Instruction files are missing.')
    expect(result.checks.at(-1)?.detail).toBe('Missing: docs/council/council.md')
  })
})
