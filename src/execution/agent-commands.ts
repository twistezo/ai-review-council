import type { AgentConfiguration, ProviderId } from '../domain/review-session.js'
import { secretReadDenyRules } from '../scope/excluded-files.js'
import type { ParseAgentLine } from './agent-events.js'
import { parseClaudeLine, parseCodexLine } from './agent-events.js'

export type AgentLaunch = {
  configuration: AgentConfiguration
  // the reviewed repository
  cwd: string
  // instruction files joined, passed as system or developer instructions
  instructions: string
  // the user message: scope, review prompt, reports; sent on stdin
  message: string
  // outside `cwd`, e.g. the folder with the prepared diff
  readableDirectories: readonly string[]
}

export type AgentProcessSpec = {
  command: string
  args: string[]
  cwd: string
  stdin: string
}

// Read and search only: no shell, no MCP servers, no permission prompts (verified in the CLI probes).
// `Skill` runs the agent's own skills, built-in or the user's; with no `Agent` tool they start no sub-agents.
// Hooks and `apiKeyHelper` from the reviewed repository's settings would run shell commands, so both are off;
// its `CLAUDE.md` and skills still load.
export const buildClaudeProcess = ({
  configuration,
  cwd,
  instructions,
  message,
  readableDirectories,
}: AgentLaunch): AgentProcessSpec => ({
  command: 'claude',
  args: [
    '-p',
    '--model',
    configuration.model,
    ...(configuration.effort === null ? [] : ['--effort', configuration.effort]),
    '--tools',
    'Read,Grep,Glob,Skill',
    '--permission-mode',
    'dontAsk',
    '--strict-mcp-config',
    '--settings',
    JSON.stringify({ disableAllHooks: true, apiKeyHelper: '' }),
    '--disallowedTools',
    secretReadDenyRules.join(','),
    ...readableDirectories.flatMap((directory) => ['--add-dir', directory]),
    '--append-system-prompt',
    instructions,
    '--output-format',
    'stream-json',
    '--verbose',
  ],
  cwd,
  stdin: message,
})

// Extras Codex loads from the user config; turning them off leaves file access through a read-only shell.
// `code_mode_host` stays on: every Codex tool call, reading included, goes through it.
const disabledCodexFeatures = [
  'computer_use',
  'browser_use',
  'browser_use_external',
  'in_app_browser',
  'apps',
  'plugins',
  'remote_plugin',
  'multi_agent',
  'image_generation',
  'goals',
  'sleep_tool',
  'tool_suggest',
  'skill_search',
  'hooks',
] as const

// Read-only sandbox: shell commands can read but not write; no network, no approvals, no MCP servers.
// Codex reads the whole disk in this mode, so `readableDirectories` needs no flag.
export const buildCodexProcess = ({ configuration, cwd, instructions, message }: AgentLaunch): AgentProcessSpec => ({
  command: 'codex',
  args: [
    'exec',
    '--model',
    configuration.model,
    ...(configuration.effort === null ? [] : ['-c', `model_reasoning_effort=${JSON.stringify(configuration.effort)}`]),
    '--sandbox',
    'read-only',
    '-c',
    'approval_policy="never"',
    '-c',
    'mcp_servers={}',
    ...disabledCodexFeatures.flatMap((feature) => ['--disable', feature]),
    '-c',
    // A JSON string is a valid TOML basic string.
    `developer_instructions=${JSON.stringify(instructions)}`,
    '--skip-git-repo-check',
    '--json',
    // `-` reads the prompt from stdin
    '-',
  ],
  cwd,
  stdin: message,
})

export const processBuilders: Record<ProviderId, (launch: AgentLaunch) => AgentProcessSpec> = {
  claude: buildClaudeProcess,
  codex: buildCodexProcess,
}

export const lineParsers: Record<ProviderId, ParseAgentLine> = {
  claude: parseClaudeLine,
  codex: parseCodexLine,
}
