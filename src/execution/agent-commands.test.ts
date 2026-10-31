import { describe, expect, it } from 'vitest'

import { secretReadDenyRules } from '../scope/excluded-files.js'
import type { AgentLaunch } from './agent-commands.js'
import { buildClaudeProcess, buildCodexProcess } from './agent-commands.js'

const launch = (overrides: Partial<AgentLaunch> = {}): AgentLaunch => ({
  configuration: { provider: 'claude', model: 'haiku', modelLabel: 'Haiku 5.5', effort: 'low' },
  cwd: '/repo',
  instructions: 'Common rules\n"quoted"',
  message: 'Review this change',
  readableDirectories: ['/tmp/council-diff'],
  ...overrides,
})

describe('buildClaudeProcess', () => {
  it('limits tools to reading, drops MCP servers and sends the message on stdin', () => {
    const spec = buildClaudeProcess(launch())

    expect(spec).toEqual({
      command: 'claude',
      args: [
        '-p',
        '--model',
        'haiku',
        '--effort',
        'low',
        '--tools',
        'Read,Grep,Glob,Skill',
        '--permission-mode',
        'dontAsk',
        '--strict-mcp-config',
        '--settings',
        '{"disableAllHooks":true,"apiKeyHelper":""}',
        '--disallowedTools',
        secretReadDenyRules.join(','),
        '--add-dir',
        '/tmp/council-diff',
        '--append-system-prompt',
        'Common rules\n"quoted"',
        '--output-format',
        'stream-json',
        '--verbose',
      ],
      cwd: '/repo',
      stdin: 'Review this change',
    })
  })

  it('denies reading secret files anywhere in the repository', () => {
    expect(secretReadDenyRules).toEqual(
      expect.arrayContaining(['Read(**/.env)', 'Read(**/.env.*)', 'Read(**/id_rsa)', 'Read(**/*.pem)']),
    )
  })

  it('omits the effort for a model without effort levels', () => {
    const spec = buildClaudeProcess(
      launch({ configuration: { provider: 'claude', model: 'claude-haiku-4-5', modelLabel: 'Haiku 4.5', effort: null } }),
    )

    expect(spec.args).not.toContain('--effort')
  })
})

describe('buildCodexProcess', () => {
  const spec = buildCodexProcess(
    launch({ configuration: { provider: 'codex', model: 'gpt-6-luna', modelLabel: 'GPT-6-Luna', effort: 'low' } }),
  )

  it('runs in the read-only sandbox without approvals or MCP servers', () => {
    expect(spec.command).toBe('codex')
    expect(spec.args.slice(0, 13)).toEqual([
      'exec',
      '--model',
      'gpt-6-luna',
      '-c',
      'model_reasoning_effort="low"',
      '--sandbox',
      'read-only',
      '-c',
      'approval_policy="never"',
      '-c',
      'mcp_servers={}',
      '--disable',
      'computer_use',
    ])
    expect(spec.args).not.toContain('code_mode_host')
  })

  it('passes instructions as an escaped developer instruction and the message on stdin', () => {
    expect(spec.args).toContain('developer_instructions="Common rules\\n\\"quoted\\""')
    expect(spec.args.at(-1)).toBe('-')
    expect(spec.stdin).toBe('Review this change')
  })
})
