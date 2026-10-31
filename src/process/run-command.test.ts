import { describe, expect, it } from 'vitest'

import { runCommand } from './run-command.js'

describe('runCommand', () => {
  it('ends the wait on timeout even when the command ignores SIGTERM', async () => {
    const started = Date.now()
    const result = await runCommand(
      process.execPath,
      ['-e', "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);"],
      { timeoutMs: 200 },
    )

    expect(result).toMatchObject({ failure: 'timeout', exitCode: null })
    expect(Date.now() - started).toBeLessThan(4_000)
  })
})
