import type { AgentLaunch } from './agent-commands.js'
import { lineParsers, processBuilders } from './agent-commands.js'
import type { AgentRunResult, RunAgentOptions } from './run-agent-process.js'
import { runAgentProcess } from './run-agent-process.js'

export type RunAgent = (launch: AgentLaunch, options: RunAgentOptions) => Promise<AgentRunResult>

export const runAgent: RunAgent = (launch, options) => {
  const { provider } = launch.configuration

  return runAgentProcess(processBuilders[provider](launch), lineParsers[provider], options)
}
