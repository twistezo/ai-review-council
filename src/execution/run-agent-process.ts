import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

import type { AgentEvent, ParseAgentLine } from './agent-events.js'
import type { AgentProcessSpec } from './agent-commands.js'

export type AgentRunResult =
  | { ok: true; report: string; sessionId: string | null }
  | { ok: false; error: string; sessionId: string | null }

export type RunAgentOptions = {
  timeoutMs: number
  signal?: AbortSignal
  onEvent?: (event: AgentEvent) => void
}

const killGraceMs = 5_000
const stderrTailLength = 1_000

// Process groups of running agents, each with a promise that settles when the run ends.
const runningAgents = new Map<number, Promise<void>>()
// Runs stopped by a cancel (Ctrl+C), reported once the app has cleaned up.
let cancelledCount = 0

const killGroup = (pid: number, signal: NodeJS.Signals): void => {
  try {
    process.kill(-pid, signal)
  } catch {
    // already gone
  }
}

// Kills every running agent at once and returns how many there were; for exits that cannot wait.
export const killAllAgents = (): number => {
  const count = runningAgents.size
  runningAgents.forEach((_, pid) => killGroup(pid, 'SIGKILL'))
  runningAgents.clear()

  return count
}

// Waits until the agents already being stopped have exited, up to `timeoutMs`.
export const waitForAgentsToStop = async (timeoutMs: number): Promise<void> => {
  await Promise.race([
    Promise.all(runningAgents.values()),
    new Promise((resolve) => setTimeout(resolve, timeoutMs).unref()),
  ])
}

// How many runs a cancel stopped since the last call.
export const takeCancelledCount = (): number => {
  const count = cancelledCount
  cancelledCount = 0

  return count
}

const formatMinutes = (ms: number): string => {
  const minutes = ms / 60_000

  return Number.isInteger(minutes) ? `${minutes} min` : `${Math.round(ms / 1000)} s`
}

// Runs one agent to completion. A run that ends without a report is a failure, never "no findings".
export const runAgentProcess = (
  spec: AgentProcessSpec,
  parseLine: ParseAgentLine,
  { timeoutMs, signal, onEvent }: RunAgentOptions,
): Promise<AgentRunResult> =>
  new Promise((resolve) => {
    let sessionId: string | null = null
    let lastMessage: string | null = null
    let completedText: string | null = null
    let isCompleted = false
    let agentError: string | null = null
    let stopReason: string | null = null
    let stderrTail = ''
    let isSettled = false

    // A separate process group lets a stop reach the CLI and everything it started.
    const child = spawn(spec.command, spec.args, { cwd: spec.cwd, stdio: ['pipe', 'pipe', 'pipe'], detached: true })
    const pid = child.pid
    let markStopped = (): void => undefined
    if (pid !== undefined) {
      runningAgents.set(
        pid,
        new Promise<void>((resolveStopped) => {
          markStopped = resolveStopped
        }),
      )
    }

    const settle = (result: AgentRunResult): void => {
      if (isSettled) {
        return
      }
      isSettled = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', cancel)
      if (pid !== undefined) {
        // The CLI is gone, but a process it started may outlive it or ignore SIGTERM; the group goes with it.
        killGroup(pid, 'SIGKILL')
        runningAgents.delete(pid)
      }
      markStopped()
      resolve(result)
    }

    const stop = (reason: string): void => {
      if (stopReason !== null || pid === undefined) {
        return
      }
      stopReason = reason
      killGroup(pid, 'SIGTERM')
      setTimeout(() => killGroup(pid, 'SIGKILL'), killGraceMs).unref()
    }

    const timer = setTimeout(() => stop(`Timed out after ${formatMinutes(timeoutMs)}`), timeoutMs)
    const cancel = (): void => {
      if (stopReason === null) {
        cancelledCount += 1
      }
      stop('Cancelled')
    }
    if (signal?.aborted) {
      cancel()
    }
    signal?.addEventListener('abort', cancel)

    child.stdin.on('error', () => undefined)
    child.stdin.end(spec.stdin)
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      stderrTail = (stderrTail + chunk).slice(-stderrTailLength)
    })

    createInterface({ input: child.stdout }).on('line', (line) => {
      for (const event of parseLine(line)) {
        if (event.kind === 'session') {
          sessionId = event.sessionId
        } else if (event.kind === 'message') {
          lastMessage = event.text
        } else if (event.kind === 'completed') {
          isCompleted = true
          completedText = event.text
        } else if (event.kind === 'error') {
          agentError ??= event.message
        }
        onEvent?.(event)
      }
    })

    child.on('error', (error: NodeJS.ErrnoException) => {
      settle({
        ok: false,
        error: error.code === 'ENOENT' ? `\`${spec.command}\` was not found in PATH` : error.message,
        sessionId,
      })
    })

    child.on('close', (exitCode) => {
      if (stopReason !== null) {
        settle({ ok: false, error: stopReason, sessionId })

        return
      }
      if (agentError !== null) {
        settle({ ok: false, error: agentError, sessionId })

        return
      }
      const report = (completedText ?? lastMessage ?? '').trim()
      if (isCompleted && report !== '') {
        settle({ ok: true, report, sessionId })

        return
      }
      const details = stderrTail.trim()
      settle({
        ok: false,
        error: isCompleted
          ? 'The agent finished without a report'
          : `\`${spec.command}\` exited with code ${exitCode} before finishing${details === '' ? '' : `: ${details}`}`,
        sessionId,
      })
    })
  })
