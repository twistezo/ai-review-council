import { randomUUID } from "node:crypto"
import path from "node:path"
import type {
  AgentConfiguration,
  ProviderId,
} from "../domain/review-session.js"
import {
  secretPathPatterns,
  secretReadDenyRules,
} from "../scope/excluded-files.js"
import type { ParseAgentLine } from "./agent-events.js"
import {
  parseClaudeLine,
  parseCodexLine,
  parseCopilotLine,
  parseCopilotUsage,
} from "./agent-events.js"

export type AgentLaunch = {
  configuration: AgentConfiguration
  copilotCommand?: "copilot" | "gh"
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
  usageFile?: { path: string; parse: ParseAgentLine }
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
  command: "claude",
  args: [
    "-p",
    "--model",
    configuration.model,
    ...(configuration.effort === null
      ? []
      : ["--effort", configuration.effort]),
    "--tools",
    "Read,Grep,Glob,Skill",
    "--permission-mode",
    "dontAsk",
    "--strict-mcp-config",
    "--settings",
    JSON.stringify({ disableAllHooks: true, apiKeyHelper: "" }),
    "--disallowedTools",
    secretReadDenyRules.join(","),
    ...readableDirectories.flatMap(directory => ["--add-dir", directory]),
    "--append-system-prompt",
    instructions,
    "--output-format",
    "stream-json",
    "--verbose",
  ],
  cwd,
  stdin: message,
})

// Extras Codex loads from the user config; turning them off leaves file access through a read-only shell.
// `code_mode_host` stays on: every Codex tool call, reading included, goes through it.
const disabledCodexFeatures = [
  "computer_use",
  "browser_use",
  "browser_use_external",
  "in_app_browser",
  "apps",
  "plugins",
  "remote_plugin",
  "multi_agent",
  "image_generation",
  "goals",
  "sleep_tool",
  "tool_suggest",
  "skill_search",
  "hooks",
] as const

// Read-only sandbox: shell commands can read but not write; no network, no approvals, no MCP servers.
// Codex reads the whole disk in this mode, so `readableDirectories` needs no flag.
export const buildCodexProcess = ({
  configuration,
  cwd,
  instructions,
  message,
}: AgentLaunch): AgentProcessSpec => ({
  command: "codex",
  args: [
    "exec",
    "--model",
    configuration.model,
    ...(configuration.effort === null
      ? []
      : [
          "-c",
          `model_reasoning_effort=${JSON.stringify(configuration.effort)}`,
        ]),
    "--sandbox",
    "read-only",
    "-c",
    'approval_policy="never"',
    "-c",
    "mcp_servers={}",
    ...disabledCodexFeatures.flatMap(feature => ["--disable", feature]),
    "-c",
    // A JSON string is a valid TOML basic string.
    `developer_instructions=${JSON.stringify(instructions)}`,
    "--skip-git-repo-check",
    "--json",
    // `-` reads the prompt from stdin
    "-",
  ],
  cwd,
  stdin: message,
})

// Read and search only: no shell, no writes, no built-in MCP servers, no questions to the user.
// Copilot CLI 1.0.105 help documents `shell`, `write`, MCP and `url` permission kinds; the `read` rules are unverified.
// The instructions go first on stdin: the CLI has no system prompt option for prompt mode.
// The reviewed repository's `AGENTS.md` and skills still load, as for the other providers.
export const buildCopilotProcess = ({
  copilotCommand = "copilot",
  configuration,
  cwd,
  instructions,
  message,
  readableDirectories,
}: AgentLaunch): AgentProcessSpec => {
  const usagePath = path.join(
    readableDirectories[0] ?? cwd,
    `copilot-usage-${randomUUID()}.json`,
  )

  return {
    usageFile: { path: usagePath, parse: parseCopilotUsage },
    command: copilotCommand,
    args: [
      ...(copilotCommand === "gh" ? ["copilot", "--"] : []),
      "--usage-output-file",
      usagePath,
      "--model",
      configuration.model,
      "--no-auto-update",
      "--no-ask-user",
      "--disable-builtin-mcps",
      "--sync-session=off",
      "--no-bash-env",
      "--available-tools=view,rg,glob",
      "--allow-tool=read",
      "--deny-tool=write",
      "--deny-tool=shell",
      ...secretPathPatterns.map(pattern => `--deny-tool=read(${pattern})`),
      ...readableDirectories.flatMap(directory => ["--add-dir", directory]),
      "--output-format=json",
      "--stream=on",
    ],
    cwd,
    stdin: `${instructions}\n\n${message}`,
  }
}

export const processBuilders: Record<
  ProviderId,
  (launch: AgentLaunch) => AgentProcessSpec
> = {
  claude: buildClaudeProcess,
  codex: buildCodexProcess,
  copilot: buildCopilotProcess,
}

export const lineParsers: Record<ProviderId, ParseAgentLine> = {
  claude: parseClaudeLine,
  codex: parseCodexLine,
  copilot: parseCopilotLine,
}
