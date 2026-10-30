import { z } from 'zod'

// Provider events reduced to what the run needs: progress, the report and failures.
export type AgentEvent =
  | { kind: 'session'; sessionId: string }
  | { kind: 'read'; target: string }
  | { kind: 'message'; text: string }
  // `text` is null when the provider ends the turn without repeating the final message.
  | { kind: 'completed'; text: string | null }
  | { kind: 'error'; message: string }

export type ParseAgentLine = (line: string) => AgentEvent[]

const parseJson = (line: string): unknown => {
  try {
    return JSON.parse(line)
  } catch {
    return null
  }
}

const describeToolInput = (input: Record<string, unknown>): string => {
  const target = input['file_path'] ?? input['pattern'] ?? input['path']

  return typeof target === 'string' ? target : ''
}

const claudeEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('system'), subtype: z.string().optional(), session_id: z.string().optional() }),
  z.object({
    type: z.literal('assistant'),
    message: z.object({
      // Loose on purpose: unknown part types (thinking, images) must not drop the tool calls beside them.
      content: z.array(
        z.object({
          type: z.string(),
          text: z.string().optional(),
          name: z.string().optional(),
          input: z.record(z.string(), z.unknown()).optional(),
        }),
      ),
    }),
  }),
  z.object({
    type: z.literal('result'),
    subtype: z.string(),
    is_error: z.boolean().optional(),
    result: z.string().optional(),
  }),
])

// Claude Code `--output-format stream-json`.
export const parseClaudeLine: ParseAgentLine = (line) => {
  const parsed = claudeEventSchema.safeParse(parseJson(line))
  if (!parsed.success) {
    return []
  }
  const event = parsed.data
  if (event.type === 'system') {
    return event.subtype === 'init' && event.session_id !== undefined
      ? [{ kind: 'session', sessionId: event.session_id }]
      : []
  }
  if (event.type === 'assistant') {
    return event.message.content.flatMap((part): AgentEvent[] => {
      if (part.type === 'tool_use') {
        return [{ kind: 'read', target: `${part.name ?? ''} ${describeToolInput(part.input ?? {})}`.trim() }]
      }

      return part.type === 'text' && part.text !== undefined && part.text.trim() !== ''
        ? [{ kind: 'message', text: part.text }]
        : []
    })
  }
  if (event.subtype === 'success' && event.is_error !== true) {
    return [{ kind: 'completed', text: event.result ?? null }]
  }

  return [{ kind: 'error', message: `Claude Code ended with ${event.subtype}${event.result ? `: ${event.result}` : ''}` }]
}

const codexEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('thread.started'), thread_id: z.string() }),
  z.object({
    type: z.literal('item.started'),
    item: z.object({ type: z.string(), command: z.string().optional() }),
  }),
  z.object({
    type: z.literal('item.completed'),
    item: z.object({ type: z.string(), text: z.string().optional() }),
  }),
  z.object({ type: z.literal('turn.completed') }),
  z.object({ type: z.literal('turn.failed'), error: z.object({ message: z.string() }) }),
  z.object({ type: z.literal('error'), message: z.string() }),
])

// Codex `exec --json`. The final answer is the last agent message before `turn.completed`.
export const parseCodexLine: ParseAgentLine = (line) => {
  const parsed = codexEventSchema.safeParse(parseJson(line))
  if (!parsed.success) {
    return []
  }
  const event = parsed.data
  switch (event.type) {
    case 'thread.started':
      return [{ kind: 'session', sessionId: event.thread_id }]
    case 'item.started':
      return event.item.type === 'command_execution' ? [{ kind: 'read', target: event.item.command ?? '' }] : []
    case 'item.completed':
      return event.item.type === 'agent_message' && event.item.text !== undefined && event.item.text.trim() !== ''
        ? [{ kind: 'message', text: event.item.text }]
        : []
    case 'turn.completed':
      return [{ kind: 'completed', text: null }]
    case 'turn.failed':
      return [{ kind: 'error', message: `Codex turn failed: ${event.error.message}` }]
    case 'error':
      return [{ kind: 'error', message: `Codex error: ${event.message}` }]
  }
}
