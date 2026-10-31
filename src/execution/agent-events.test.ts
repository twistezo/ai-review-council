import { describe, expect, it } from 'vitest'

import { parseClaudeLine, parseCodexLine } from './agent-events.js'
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

  it('counts fresh input, cache writes, cache reads and output as used tokens', () => {
    const usage = {
      input_tokens: 2,
      cache_creation_input_tokens: 5_523,
      cache_read_input_tokens: 1_670,
      output_tokens: 4,
      output_tokens_details: { thinking_tokens: 0 },
    }

    expect(parseClaudeLine(line({ type: 'result', subtype: 'success', is_error: false, result: 'OK', usage }))).toEqual([
      { kind: 'usage', tokens: 7_199 },
      { kind: 'completed', text: 'OK' },
    ])
    expect(parseClaudeLine(line({ type: 'result', subtype: 'error_during_execution', is_error: true, usage }))).toEqual([
      { kind: 'usage', tokens: 7_199 },
      { kind: 'error', message: 'Claude Code ended with error_during_execution' },
    ])
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
      line({ type: 'item.started', item: { id: 'i1', type: 'command_execution', command: '/bin/zsh -lc "rg --files"' } }),
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

  it('ignores warning items', () => {
    expect(parseCodexLine(line({ type: 'item.completed', item: { type: 'error', message: 'feature off' } }))).toEqual([])
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
