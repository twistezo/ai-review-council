import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { runCommand } from '../process/run-command.js'

const fixture = fileURLToPath(new URL('../test-support/agent-parent-fixture.ts', import.meta.url))

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)

    return true
  } catch {
    return false
  }
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

describe('agent cleanup', () => {
  it.each([
    ['SIGHUP', 129],
    ['SIGTERM', 143],
    ['SIGINT', 130],
  ] as const)('stops running agents when the app gets %s', async (signal, expectedExitCode) => {
    const parent = spawn(process.execPath, ['--import', 'tsx', fixture], { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    parent.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      stderr += chunk
    })
    await new Promise<void>((resolve) => parent.stdout.on('data', () => resolve()))
    const children = await runCommand('pgrep', ['-P', String(parent.pid)])
    const agentPid = Number(children.stdout.trim().split('\n')[0])
    expect(isAlive(agentPid)).toBe(true)

    const exited = new Promise<number | null>((resolve) => parent.on('exit', (code) => resolve(code)))
    parent.kill(signal)
    expect(await exited).toBe(expectedExitCode)
    await delay(200)

    expect(isAlive(agentPid)).toBe(false)
    expect(stderr).toContain('✔ Review cancelled. Everything cleaned up gracefully.')
  }, 15_000)
})
