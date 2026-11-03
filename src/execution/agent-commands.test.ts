import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { secretPathPatterns, secretReadDenyRules } from '../scope/excluded-files.js'
import type { AgentLaunch } from './agent-commands.js'
import { buildClaudeProcess, buildCodexProcess, buildCopilotProcess } from './agent-commands.js'

const launch = (overrides: Partial<AgentLaunch> = {}): AgentLaunch => ({
  configuration: { provider: 'claude', model: 'haiku', modelLabel: 'Haiku 5.5', effort: 'low' },
  cwd: '/repo',
  instructions: 'Common rules\n"quoted"',
  message: 'Review this change',
  readableDirectories: ['/tmp/council-diff'],
  ...overrides,
})

// Values that follow each occurrence of `flag`, e.g. every `--add-dir`.
const flagValues = (args: readonly string[], flag: string): string[] =>
  args.flatMap((arg, index) => (arg === flag && index + 1 < args.length ? [args[index + 1] ?? ''] : []))

const flagValue = (args: readonly string[], flag: string): string | undefined => flagValues(args, flag)[0]

const writeOrShellTools = ['Bash', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'WebFetch', 'WebSearch', 'Agent', 'Task']

describe('buildClaudeProcess', () => {
  const spec = buildClaudeProcess(launch())

  it('runs the chosen model and effort in print mode, with the message on stdin', () => {
    expect(spec.command).toBe('claude')
    expect(spec.args).toContain('-p')
    expect(flagValue(spec.args, '--model')).toBe('haiku')
    expect(flagValue(spec.args, '--effort')).toBe('low')
    expect(spec.cwd).toBe('/repo')
    expect(spec.stdin).toBe('Review this change')
  })

  it('allows only reading and search tools, never a shell, writes or sub-agents', () => {
    const tools = flagValue(spec.args, '--tools')?.split(',') ?? []

    expect(tools).toEqual(expect.arrayContaining(['Read', 'Grep', 'Glob']))
    expect(tools.filter((tool) => writeOrShellTools.includes(tool))).toEqual([])
  })

  it('never prompts for permissions and loads no MCP servers', () => {
    expect(flagValue(spec.args, '--permission-mode')).toBe('dontAsk')
    expect(spec.args).toContain('--strict-mcp-config')
  })

  it('turns off hooks and the API key helper of the reviewed repository', () => {
    const settings: unknown = JSON.parse(flagValue(spec.args, '--settings') ?? '{}')

    expect(settings).toMatchObject({ disableAllHooks: true, apiKeyHelper: '' })
  })

  it('denies reading every likely secret file', () => {
    const denied = flagValue(spec.args, '--disallowedTools')?.split(',') ?? []

    expect(denied).toEqual(expect.arrayContaining([...secretReadDenyRules]))
  })

  it('opens each prepared directory and passes the instructions as the system prompt', () => {
    const spec = buildClaudeProcess(launch({ readableDirectories: ['/tmp/a', '/tmp/b'] }))

    expect(flagValues(spec.args, '--add-dir')).toEqual(['/tmp/a', '/tmp/b'])
    expect(flagValue(spec.args, '--append-system-prompt')).toBe('Common rules\n"quoted"')
  })

  it('streams JSON events', () => {
    expect(flagValue(spec.args, '--output-format')).toBe('stream-json')
    expect(spec.args).toContain('--verbose')
  })

  it('omits the effort for a model without effort levels', () => {
    const spec = buildClaudeProcess(
      launch({
        configuration: { provider: 'claude', model: 'claude-haiku-4-5', modelLabel: 'Haiku 4.5', effort: null },
      }),
    )

    expect(spec.args).not.toContain('--effort')
  })
})

describe('buildCodexProcess', () => {
  const spec = buildCodexProcess(
    launch({ configuration: { provider: 'codex', model: 'gpt-6-luna', modelLabel: 'GPT-6-Luna', effort: 'low' } }),
  )
  const configs = flagValues(spec.args, '-c')

  it('runs the chosen model and effort non-interactively', () => {
    expect(spec.command).toBe('codex')
    expect(spec.args[0]).toBe('exec')
    expect(flagValue(spec.args, '--model')).toBe('gpt-6-luna')
    expect(configs).toContain('model_reasoning_effort="low"')
  })

  it('runs in the read-only sandbox without approvals or MCP servers', () => {
    expect(flagValue(spec.args, '--sandbox')).toBe('read-only')
    expect(configs).toEqual(expect.arrayContaining(['approval_policy="never"', 'mcp_servers={}']))
  })

  it('turns off hooks, plugins, sub-agents and browser or computer use, but keeps the tool host reads go through', () => {
    const disabled = flagValues(spec.args, '--disable')

    expect(disabled).toEqual(
      expect.arrayContaining(['hooks', 'plugins', 'multi_agent', 'computer_use', 'browser_use', 'apps']),
    )
    expect(disabled).not.toContain('code_mode_host')
  })

  it('passes instructions as an escaped developer instruction and the message on stdin', () => {
    expect(configs).toContain('developer_instructions="Common rules\\n\\"quoted\\""')
    expect(spec.args.at(-1)).toBe('-')
    expect(spec.stdin).toBe('Review this change')
  })

  it('omits the effort for a model without effort levels', () => {
    const spec = buildCodexProcess(
      launch({ configuration: { provider: 'codex', model: 'gpt-mini', modelLabel: 'GPT mini', effort: null } }),
    )

    expect(spec.args.some((arg) => arg.startsWith('model_reasoning_effort'))).toBe(false)
  })
})

describe('buildCopilotProcess', () => {
  const copilotLaunch = (overrides: Partial<AgentLaunch> = {}): AgentLaunch =>
    launch({ configuration: { provider: 'copilot', model: 'auto', modelLabel: 'Auto', effort: null }, ...overrides })
  const spec = buildCopilotProcess(copilotLaunch())

  it('runs the standalone CLI with the Auto model by default', () => {
    expect(spec.command).toBe('copilot')
    expect(flagValue(spec.args, '--model')).toBe('auto')
  })

  it('forwards the arguments through gh when that runtime was detected', () => {
    const spec = buildCopilotProcess(copilotLaunch({ copilotCommand: 'gh' }))

    expect(spec.command).toBe('gh')
    expect(spec.args.slice(0, 2)).toEqual(['copilot', '--'])
    expect(flagValue(spec.args, '--model')).toBe('auto')
  })

  it('offers only reading tools and denies writes and the shell', () => {
    expect(spec.args).toContain('--available-tools=view,rg,glob')
    expect(spec.args).toEqual(expect.arrayContaining(['--deny-tool=write', '--deny-tool=shell']))
    expect(spec.args).not.toContain('--allow-tool=write')
    expect(spec.args).not.toContain('--allow-tool=shell')
  })

  it('asks the user nothing and loads no built-in MCP servers', () => {
    expect(spec.args).toEqual(expect.arrayContaining(['--no-ask-user', '--disable-builtin-mcps']))
  })

  it('denies reading every likely secret file and opens the prepared directory', () => {
    const deniedReads = spec.args.filter((arg) => arg.startsWith('--deny-tool=read('))

    expect(deniedReads).toEqual(secretPathPatterns.map((pattern) => `--deny-tool=read(${pattern})`))
    expect(flagValues(spec.args, '--add-dir')).toEqual(['/tmp/council-diff'])
  })

  it('writes the usage report into the prepared directory, a new file per run', () => {
    const other = buildCopilotProcess(copilotLaunch())

    expect(flagValue(spec.args, '--usage-output-file')).toBe(spec.usageFile?.path)
    expect(path.dirname(spec.usageFile?.path ?? '')).toBe('/tmp/council-diff')
    expect(other.usageFile?.path).not.toBe(spec.usageFile?.path)
  })

  it('falls back to the repository for the usage report when no directory is prepared', () => {
    const spec = buildCopilotProcess(copilotLaunch({ readableDirectories: [] }))

    expect(path.dirname(spec.usageFile?.path ?? '')).toBe('/repo')
  })

  it('sends the instructions before the message on stdin and streams JSONL', () => {
    expect(spec.stdin).toBe('Common rules\n"quoted"\n\nReview this change')
    expect(spec.args).toEqual(expect.arrayContaining(['--output-format=json', '--stream=on']))
  })
})
