// A stand-in for the app: installs the cleanup, starts one long-running fake agent and waits.
import { runAgentProcess } from '../execution/run-agent-process.js'
import { installShutdownCleanup } from '../shutdown.js'

installShutdownCleanup()
const pending = runAgentProcess(
  { command: process.execPath, args: ['-e', 'setInterval(() => {}, 1000)'], cwd: process.cwd(), stdin: '' },
  () => [],
  { timeoutMs: 600_000 },
)
setTimeout(() => console.log('ready'), 200)
await pending
