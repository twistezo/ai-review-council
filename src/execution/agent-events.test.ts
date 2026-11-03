import { describe, expect, it } from 'vitest'

import { parseClaudeLine, parseCodexLine, parseCopilotLine, parseCopilotUsage } from './agent-events.js'
import { applyAgentEvent, finishProgress, startProgress } from './agent-progress.js'

const line = (event: unknown): string => JSON.stringify(event)

describe('parseClaudeLine', () => {
  it('reads the session id from the init event', () => {
    expect(parseClaudeLine(line({ type: 'system', subtype: 'init', session_id: 's-1', tools: ['Read'] }))).toEqual([
      { kind: 'session', sessionId: 's-1' },
    ])
  })

  it('turns tool calls into reads and text into messages', () => {
    const events = parseClaudeLine(
      line({
        type: 'assistant',
        message: {
          content: [
            { type: 'redacted_thinking', data: '...' },
            { type: 'text', text: 'Reading the file.' },
            { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: '/repo/src/a.ts' } },
            { type: 'tool_use', id: 't2', name: 'Grep', input: { pattern: 'token' } },
          ],
        },
      }),
    )

    expect(events).toEqual([
      { kind: 'message', text: 'Reading the file.' },
      { kind: 'read', target: 'Read /repo/src/a.ts' },
      { kind: 'read', target: 'Grep token' },
    ])
  })

  it('completes with the result text', () => {
    expect(parseClaudeLine(line({ type: 'result', subtype: 'success', is_error: false, result: '# Report' }))).toEqual([
      { kind: 'completed', text: '# Report' },
    ])
  })

  it('reports an unsuccessful result as an error', () => {
    expect(parseClaudeLine(line({ type: 'result', subtype: 'error_max_turns', is_error: true }))).toEqual([
      { kind: 'error', message: 'Claude Code ended with error_max_turns' },
    ])
  })

  it('treats a success result flagged as an error as a failure', () => {
    expect(parseClaudeLine(line({ type: 'result', subtype: 'success', is_error: true, result: 'API Error: 529' }))).toEqual(
      [{ kind: 'error', message: 'Claude Code ended with success: API Error: 529' }],
    )
  })

  it('appends the result text to an unsuccessful result', () => {
    expect(
      parseClaudeLine(line({ type: 'result', subtype: 'error_during_execution', is_error: true, result: 'Credit balance is too low' })),
    ).toEqual([{ kind: 'error', message: 'Claude Code ended with error_during_execution: Credit balance is too low' }])
  })

  it('completes without text when the result carries none', () => {
    expect(parseClaudeLine(line({ type: 'result', subtype: 'success' }))).toEqual([{ kind: 'completed', text: null }])
  })

  it('skips blank text parts and names a tool call without input', () => {
    expect(
      parseClaudeLine(
        line({ type: 'assistant', message: { content: [{ type: 'text', text: '  \n' }, { type: 'tool_use', name: 'Glob' }] } }),
      ),
    ).toEqual([{ kind: 'read', target: 'Glob' }])
  })

  it('counts fresh input, cache writes, cache reads and output as used tokens', () => {
    const usage = {
      input_tokens: 2,
      cache_creation_input_tokens: 5_523,
      cache_read_input_tokens: 1_670,
      output_tokens: 4,
      output_tokens_details: { thinking_tokens: 0 },
    }

    expect(parseClaudeLine(line({ type: 'result', subtype: 'success', is_error: false, result: 'OK', usage }))).toEqual(
      [
        { kind: 'usage', tokens: 7_199 },
        { kind: 'completed', text: 'OK' },
      ],
    )
    expect(parseClaudeLine(line({ type: 'result', subtype: 'error_during_execution', is_error: true, usage }))).toEqual(
      [
        { kind: 'usage', tokens: 7_199 },
        { kind: 'error', message: 'Claude Code ended with error_during_execution' },
      ],
    )
  })

  it('ignores other events and lines that are not JSON', () => {
    expect(parseClaudeLine(line({ type: 'rate_limit_event' }))).toEqual([])
    expect(parseClaudeLine('not json')).toEqual([])
  })
})

describe('parseCodexLine', () => {
  it('maps the thread, commands, messages and turn end', () => {
    const events = [
      line({ type: 'thread.started', thread_id: 'th-1' }),
      line({ type: 'turn.started' }),
      line({
        type: 'item.started',
        item: { id: 'i1', type: 'command_execution', command: '/bin/zsh -lc "rg --files"' },
      }),
      line({ type: 'item.completed', item: { id: 'i1', type: 'command_execution', exit_code: 0 } }),
      line({ type: 'item.completed', item: { id: 'i2', type: 'agent_message', text: '# Report' } }),
      line({
        type: 'turn.completed',
        usage: { input_tokens: 20_568, cached_input_tokens: 20_000, output_tokens: 5, reasoning_output_tokens: 0 },
      }),
    ].flatMap(parseCodexLine)

    // cached input is already inside `input_tokens`
    expect(events).toEqual([
      { kind: 'session', sessionId: 'th-1' },
      { kind: 'read', target: '/bin/zsh -lc "rg --files"' },
      { kind: 'message', text: '# Report' },
      { kind: 'usage', tokens: 20_573 },
      { kind: 'completed', text: null },
    ])
  })

  it('reports failed turns and stream errors', () => {
    expect(parseCodexLine(line({ type: 'turn.failed', error: { message: 'rate limited' } }))).toEqual([
      { kind: 'error', message: 'Codex turn failed: rate limited' },
    ])
    expect(parseCodexLine(line({ type: 'error', message: 'stream closed' }))).toEqual([
      { kind: 'error', message: 'Codex error: stream closed' },
    ])
  })

  it('completes a turn without usage when Codex reports none', () => {
    expect(parseCodexLine(line({ type: 'turn.completed' }))).toEqual([{ kind: 'completed', text: null }])
  })

  it('ignores blank agent messages and other started items', () => {
    expect(parseCodexLine(line({ type: 'item.completed', item: { type: 'agent_message', text: '  ' } }))).toEqual([])
    expect(parseCodexLine(line({ type: 'item.started', item: { type: 'reasoning' } }))).toEqual([])
  })

  it('ignores warning items', () => {
    expect(parseCodexLine(line({ type: 'item.completed', item: { type: 'error', message: 'feature off' } }))).toEqual(
      [],
    )
  })
})

// Shapes from a Copilot CLI 1.0.105 review of `demo/bug-farm`, trimmed and with local paths replaced.
describe('parseCopilotLine', () => {
  const finalReport = '- **`checkout.ts:20`** Subtotal ignores `item.quantity`.'

  it('maps reads, the final answer and the CLI result of a captured run', () => {
    const events = [
      line({ type: 'session.mcp_servers_loaded', data: { servers: [] } }),
      line({ type: 'assistant.turn_start', data: { turnId: '0' } }),
      line({ type: 'assistant.reasoning_delta', data: { reasoningId: 'r1', deltaContent: 'Looking at' } }),
      line({ type: 'assistant.reasoning', data: { reasoningId: 'r1', content: 'Looking at the diff' } }),
      line({ type: 'assistant.message', data: { messageId: 'm1', content: '', toolRequests: [{}] } }),
      line({
        type: 'tool.execution_start',
        data: { toolName: 'view', arguments: { path: '/tmp/review/change.diff' } },
      }),
      line({
        type: 'tool.execution_start',
        data: { toolName: 'rg', arguments: { pattern: 'quantity', paths: ['/repo'], output_mode: 'content' } },
      }),
      line({ type: 'assistant.turn_end', data: { turnId: '0' } }),
      line({ type: 'assistant.message_start', data: { messageId: 'm2', phase: 'final_answer' } }),
      line({ type: 'assistant.message_delta', data: { messageId: 'm2', deltaContent: '- **`checkout' } }),
      line({ type: 'assistant.message', data: { messageId: 'm2', phase: 'final_answer', content: finalReport } }),
      line({ type: 'session.usage_checkpoint', data: { totalPremiumRequests: 1 } }),
      line({ type: 'assistant.idle', data: {} }),
      line({ type: 'result', sessionId: 's-1', exitCode: 0, usage: { premiumRequests: 1 } }),
    ].flatMap(parseCopilotLine)

    // no usage event: the CLI reports requests, not tokens
    expect(events).toEqual([
      { kind: 'read', target: 'view /tmp/review/change.diff' },
      { kind: 'read', target: 'rg quantity' },
      { kind: 'message', text: finalReport },
      { kind: 'session', sessionId: 's-1' },
      { kind: 'completed', text: null },
    ])
  })

  it('does not take a message between tool calls as the report', () => {
    expect(parseCopilotLine(line({ type: 'assistant.message', data: { content: 'Let me check the tests.' } }))).toEqual(
      [],
    )
  })

  it('ignores events of sub-agent tool calls', () => {
    expect(
      parseCopilotLine(
        line({ type: 'tool.execution_start', data: { toolName: 'view', parentToolCallId: 't1', arguments: {} } }),
      ),
    ).toEqual([])
  })

  it('reports a failed CLI result with its session', () => {
    expect(parseCopilotLine(line({ type: 'result', sessionId: 's-1', exitCode: 1 }))).toEqual([
      { kind: 'session', sessionId: 's-1' },
      { kind: 'error', message: 'Copilot exited with code 1. Check Copilot usage limits.' },
    ])
  })

  it('reports a CLI result without an exit code as a failure', () => {
    expect(parseCopilotLine(line({ type: 'result' }))).toEqual([
      { kind: 'error', message: 'Copilot exited with code unknown. Check Copilot usage limits.' },
    ])
  })

  it('does not take a blank final answer as the report', () => {
    expect(parseCopilotLine(line({ type: 'assistant.message', data: { phase: 'final_answer', content: ' ' } }))).toEqual(
      [],
    )
  })

  it('ignores lines that are not JSON or not events', () => {
    expect(parseCopilotLine('not json')).toEqual([])
    expect(parseCopilotLine(line({ data: {} }))).toEqual([])
  })
})

describe('agent progress', () => {
  it('moves through general phases and counts reads', () => {
    const events = [
      { kind: 'session', sessionId: 's-1' },
      { kind: 'read', target: 'a' },
      { kind: 'read', target: 'b' },
      { kind: 'message', text: 'done' },
    ] as const
    const progress = events.reduce(applyAgentEvent, startProgress(1_000))

    expect(progress).toMatchObject({ phase: 'writing', reads: 2, sessionId: 's-1', startedAt: 1_000 })
    expect(finishProgress(progress, { ok: false, note: 'Timed out after 10 min' }, 5_000)).toMatchObject({
      phase: 'failed',
      finishedAt: 5_000,
      note: 'Timed out after 10 min',
    })
  })
})

describe('Copilot session token totals', () => {
  it('counts fresh input, both caches and output once across all models', () => {
    expect(
      parseCopilotUsage(
        JSON.stringify({
          tokenDetails: {
            input: { tokenCount: 15 },
            cache_read: { tokenCount: 73093 },
            cache_write: { tokenCount: 23062 },
            output: { tokenCount: 3659 },
          },
          modelMetrics: { model: { usage: { inputTokens: 96170, outputTokens: 3659 } } },
        }),
      ),
    ).toEqual([{ kind: 'usage', tokens: 99829 }])
  })

  it('counts input and output alone when no cache was used', () => {
    expect(
      parseCopilotUsage(JSON.stringify({ tokenDetails: { input: { tokenCount: 10 }, output: { tokenCount: 5 } } })),
    ).toEqual([{ kind: 'usage', tokens: 15 }])
  })

  it('rejects negative token counts as unknown usage', () => {
    expect(
      parseCopilotUsage(JSON.stringify({ tokenDetails: { input: { tokenCount: -1 }, output: { tokenCount: 5 } } })),
    ).toEqual([])
  })

  it('keeps unknown usage unknown rather than inventing zero', () => {
    expect(parseCopilotUsage('{}')).toEqual([])
    expect(parseCopilotUsage('incomplete')).toEqual([])
  })
})
