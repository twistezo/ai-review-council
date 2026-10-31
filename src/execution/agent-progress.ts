import type { AgentEvent } from './agent-events.js'

// General phases only; individual tool calls are counted, never listed.
export type AgentPhase = 'waiting' | 'starting' | 'reading' | 'writing' | 'done' | 'failed'

export type AgentProgress = {
  phase: AgentPhase
  reads: number
  sessionId: string | null
  // null until the provider reports usage, at the end of the run
  tokens: number | null
  startedAt: number | null
  finishedAt: number | null
  // the failure reason or a short result note, e.g. the finding count
  note: string | null
}

export const waitingProgress: AgentProgress = {
  phase: 'waiting',
  reads: 0,
  sessionId: null,
  tokens: null,
  startedAt: null,
  finishedAt: null,
  note: null,
}

export const startProgress = (now: number): AgentProgress => ({ ...waitingProgress, phase: 'starting', startedAt: now })

export const applyAgentEvent = (progress: AgentProgress, event: AgentEvent): AgentProgress => {
  switch (event.kind) {
    case 'session':
      return { ...progress, sessionId: event.sessionId }
    case 'usage':
      return { ...progress, tokens: (progress.tokens ?? 0) + event.tokens }
    case 'read':
      return { ...progress, phase: 'reading', reads: progress.reads + 1 }
    case 'message':
      return { ...progress, phase: 'writing' }
    case 'completed':
    case 'error':
      return progress
  }
}

export const finishProgress = (
  progress: AgentProgress,
  outcome: { ok: boolean; note: string | null },
  now: number,
): AgentProgress => ({ ...progress, phase: outcome.ok ? 'done' : 'failed', finishedAt: now, note: outcome.note })
