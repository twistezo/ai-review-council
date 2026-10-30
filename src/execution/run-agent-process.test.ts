import { describe, expect, it } from 'vitest'

import type { AgentEvent } from './agent-events.js'
import { parseCodexLine } from './agent-events.js'
import type { AgentProcessSpec } from './agent-commands.js'
import { runAgentProcess } from './run-agent-process.js'

// A stand-in CLI: a Node script printing Codex-style JSON lines.
const fakeAgent = (script: string): AgentProcessSpec => ({
  command: process.execPath,
  args: ['-e', script],
  cwd: process.cwd(),
  stdin: 'Review this change',
})

const emit = (event: unknown): string => `console.log(${JSON.stringify(JSON.stringify(event))});`

const thread = emit({ type: 'thread.started', thread_id: 'th-1' })
const report = emit({ type: 'item.completed', item: { type: 'agent_message', text: '# Report' } })
const turnCompleted = emit({ type: 'turn.completed' })

describe('runAgentProcess', () => {
  it('returns the last message as the report and forwards events', async () => {
    const events: AgentEvent[] = []
    const result = await runAgentProcess(
      fakeAgent(
        `${thread}${emit({ type: 'item.started', item: { type: 'command_execution', command: 'cat a.ts' } })}${report}${turnCompleted}`,
      ),
      parseCodexLine,
      { timeoutMs: 5_000, onEvent: (event) => events.push(event) },
    )

    expect(result).toEqual({ ok: true, report: '# Report', sessionId: 'th-1' })
    expect(events.map((event) => event.kind)).toEqual(['session', 'read', 'message', 'completed'])
  })

  it('sends the message on stdin', async () => {
    const echoStdin = `let input = ''; process.stdin.on('data', (c) => (input += c)); process.stdin.on('end', () => {
      console.log(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: input } }));
      ${turnCompleted}
    });`
    const result = await runAgentProcess(fakeAgent(echoStdin), parseCodexLine, { timeoutMs: 5_000 })

    expect(result).toMatchObject({ ok: true, report: 'Review this change' })
  })

  it('fails when the process exits before finishing', async () => {
    const result = await runAgentProcess(
      fakeAgent(`${thread}console.error('auth expired'); process.exit(3);`),
      parseCodexLine,
      { timeoutMs: 5_000 },
    )

    expect(result).toEqual({
      ok: false,
      error: `\`${process.execPath}\` exited with code 3 before finishing: auth expired`,
      sessionId: 'th-1',
    })
  })

  it('fails when the agent finishes without a report', async () => {
    const result = await runAgentProcess(fakeAgent(turnCompleted), parseCodexLine, { timeoutMs: 5_000 })

    expect(result).toMatchObject({ ok: false, error: 'The agent finished without a report' })
  })

  it('fails on an agent error even if a message came before', async () => {
    const result = await runAgentProcess(
      fakeAgent(`${report}${emit({ type: 'turn.failed', error: { message: 'rate limited' } })}`),
      parseCodexLine,
      { timeoutMs: 5_000 },
    )

    expect(result).toMatchObject({ ok: false, error: 'Codex turn failed: rate limited' })
  })

  it('kills a run that exceeds the timeout', async () => {
    const started = Date.now()
    const result = await runAgentProcess(fakeAgent(`${thread}setInterval(() => {}, 1000);`), parseCodexLine, {
      timeoutMs: 300,
    })

    expect(result).toEqual({ ok: false, error: 'Timed out after 0 s', sessionId: 'th-1' })
    expect(Date.now() - started).toBeLessThan(3_000)
  })

  it('stops when cancelled', async () => {
    const controller = new AbortController()
    const run = runAgentProcess(fakeAgent('setInterval(() => {}, 1000);'), parseCodexLine, {
      timeoutMs: 5_000,
      signal: controller.signal,
    })
    setTimeout(() => controller.abort(), 100)

    expect(await run).toMatchObject({ ok: false, error: 'Cancelled' })
  })

  it('reports a missing CLI', async () => {
    const result = await runAgentProcess(
      { command: 'no-such-agent-cli', args: [], cwd: process.cwd(), stdin: '' },
      parseCodexLine,
      { timeoutMs: 5_000 },
    )

    expect(result).toEqual({ ok: false, error: '`no-such-agent-cli` was not found in PATH', sessionId: null })
  })
})
