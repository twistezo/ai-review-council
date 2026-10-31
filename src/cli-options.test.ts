import { describe, expect, it } from 'vitest'

import { parseCliOptions } from './cli-options.js'

describe('parseCliOptions', () => {
  it('has no presets by default', () => {
    expect(parseCliOptions([])).toEqual({
      ok: true,
      options: { directory: null, language: null, scope: null, reviewerCount: null, timeoutMinutes: 10, showHelp: false },
    })
  })

  it('reads short and long options', () => {
    expect(parseCliOptions(['-d', '~/my app', '-l', 'pl', '-t', '3'])).toEqual({
      ok: true,
      options: { directory: '~/my app', language: 'pl', scope: null, reviewerCount: null, timeoutMinutes: 3, showHelp: false },
    })
    expect(parseCliOptions(['--dir=/repo', '--lang', 'EN', '--timeout=120'])).toEqual({
      ok: true,
      options: { directory: '/repo', language: 'en', scope: null, reviewerCount: null, timeoutMinutes: 120, showHelp: false },
    })
  })

  it('reads the scope as uncommitted, the entire codebase or a commit hash', () => {
    expect(parseCliOptions(['-s', 'uncommitted'])).toMatchObject({ ok: true, options: { scope: { kind: 'uncommitted' } } })
    expect(parseCliOptions(['--scope', 'Uncommitted'])).toMatchObject({ ok: true, options: { scope: { kind: 'uncommitted' } } })
    expect(parseCliOptions(['--scope', ' Full '])).toMatchObject({ ok: true, options: { scope: { kind: 'full' } } })
    expect(parseCliOptions(['--scope=be921ebca'])).toMatchObject({
      ok: true,
      options: { scope: { kind: 'since-commit', commitRef: 'be921ebca' } },
    })
  })

  it.each(['main', 'HEAD~1', 'abc', 'staged'])('rejects the scope %j', (value) => {
    expect(parseCliOptions(['--scope', value])).toEqual({
      ok: false,
      error: 'The --scope option needs `uncommitted`, `full` or a commit hash (4 to 40 hexadecimal characters).',
    })
  })

  it('reads the number of reviewers', () => {
    expect(parseCliOptions(['-r', '2'])).toMatchObject({ ok: true, options: { reviewerCount: 2 } })
    expect(parseCliOptions(['--reviewers=6'])).toMatchObject({ ok: true, options: { reviewerCount: 6 } })
  })

  it.each(['0', '7', '1.5', 'two'])('rejects the reviewer count %j', (value) => {
    expect(parseCliOptions(['--reviewers', value])).toEqual({
      ok: false,
      error: 'The --reviewers option needs a whole number from 1 to 6.',
    })
  })

  it('rejects an unsupported language', () => {
    expect(parseCliOptions(['--lang', 'de'])).toEqual({
      ok: false,
      error: 'Unsupported language "de". Use one of: en, pl.',
    })
  })

  it.each(['0', '121', '1.5', 'ten', ''])('rejects the timeout %j', (value) => {
    expect(parseCliOptions(['--timeout', value])).toEqual({
      ok: false,
      error: 'The --timeout option needs whole minutes from 1 to 120.',
    })
  })

  it('rejects unknown options, positional arguments and missing values', () => {
    expect(parseCliOptions(['--model', 'x']).ok).toBe(false)
    expect(parseCliOptions(['/repo']).ok).toBe(false)
    expect(parseCliOptions(['--dir']).ok).toBe(false)
    expect(parseCliOptions(['--dir', ' ']).ok).toBe(false)
  })
})
