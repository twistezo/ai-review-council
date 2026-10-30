import { killAllAgents, takeCancelledCount, waitForAgentsToStop } from './execution/run-agent-process.js'
import { removeActiveWorkspaces, removeActiveWorkspacesSync } from './review/review-workspace.js'

export type CleanupSummary = {
  agents: number
  workspaces: number
}

// One message for any interrupted run; null when nothing was running, so an interrupted wizard prints nothing.
export const describeCleanup = ({ agents, workspaces }: CleanupSummary): string | null =>
  agents === 0 && workspaces === 0 ? null : '✔ Review cancelled. Everything cleaned up gracefully.'

// Agents stop in the background once Ctrl+C cancels the run; this waits for them and the temp files.
const cancelGraceMs = 7_000

export const cleanUpAfterCancel = async (): Promise<CleanupSummary> => {
  await waitForAgentsToStop(cancelGraceMs)
  const workspaces = await removeActiveWorkspaces()

  return { agents: takeCancelledCount(), workspaces }
}

// Agents run in their own process groups, so a closed terminal (SIGHUP) or a `kill` never reaches them.
// The app stops them itself, says so where the terminal still exists, and exits as the signal would have.
const signalExitCodes: Record<'SIGHUP' | 'SIGINT' | 'SIGTERM', number> = {
  SIGHUP: 129,
  SIGINT: 130,
  SIGTERM: 143,
}

const cleanUpNow = (): CleanupSummary => ({ agents: killAllAgents(), workspaces: removeActiveWorkspacesSync() })

export const installShutdownCleanup = (): void => {
  process.once('exit', cleanUpNow)
  for (const [signal, exitCode] of Object.entries(signalExitCodes)) {
    process.once(signal, () => {
      const message = describeCleanup(cleanUpNow())
      if (message !== null) {
        try {
          process.stderr.write(`\n${message}\n`)
        } catch {
          // the terminal is gone (SIGHUP); the cleanup already happened
        }
      }
      process.exit(exitCode)
    })
  }
}
