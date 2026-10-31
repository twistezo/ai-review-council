import type { AgentConfiguration, ReviewerAssignment, ReviewSessionDraft } from '../domain/review-session.js'
import type { AgentProgress } from '../execution/agent-progress.js'
import { applyAgentEvent, finishProgress, startProgress } from '../execution/agent-progress.js'
import type { RunAgent } from '../execution/run-agent.js'
import type { AgentRunResult } from '../execution/run-agent-process.js'
import { councilInstructionFiles, reviewerInstructionFiles } from '../instructions/instruction-files.js'
import { compareConfigurations } from '../providers/model-catalog.js'
import type { NumberedReviewer, ReviewerReport } from './review-messages.js'
import { buildCouncilMessage, buildReviewerMessage } from './review-messages.js'
import type { PrepareWorkspace } from './review-workspace.js'

export type ReviewRunDependencies = {
  runAgent: RunAgent
  prepareWorkspace: PrepareWorkspace
  readInstructions: (files: readonly string[]) => Promise<string>
  now: () => number
}

type ProgressUpdate = (agentId: string, change: (progress: AgentProgress) => AgentProgress) => void

export type ReviewRunResult =
  | { kind: 'reported'; report: string; reviewerReports: ReviewerReport[] }
  | { kind: 'council-failed'; error: string; reviewerReports: ReviewerReport[] }
  | { kind: 'reviewers-failed'; reviewerReports: ReviewerReport[] }
  | { kind: 'cancelled' }

export const councilAgentId = 'council'
export const reviewerAgentId = (number: number): string => `reviewer-${number}`

// Numbered in the order the progress table lists them, so the numbers match the council report.
export const numberReviewers = (reviewers: readonly ReviewerAssignment[]): NumberedReviewer[] =>
  [...reviewers]
    .sort((left, right) => compareConfigurations(left.configuration, right.configuration))
    .map((reviewer, index) => ({ ...reviewer, number: index + 1 }))

const isFence = (line: string): boolean => {
  const trimmed = line.trimStart()

  return trimmed.startsWith('```') || trimmed.startsWith('~~~')
}

// Lines outside fenced code blocks; a `#` in a code sample is not a heading.
export const proseLines = (text: string): { line: string; index: number }[] => {
  let isInCodeBlock = false

  return text
    .split('\n')
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => {
      if (isFence(line)) {
        isInCodeBlock = !isInCodeBlock

        return false
      }

      return !isInCodeBlock
    })
}

// The council report starts at its title; any remark the model writes before it is dropped.
export const trimToReport = (text: string): string => {
  const titleIndex = proseLines(text).find(({ line }) => line.startsWith('# '))?.index ?? 0

  return text.split('\n').slice(titleIndex).join('\n').trim()
}

// Each finding is a level-3 heading in both report formats.
export const countFindings = (report: string): number =>
  proseLines(report).filter(({ line }) => line.startsWith('### ')).length

const findingsNote = (report: string): string => {
  const count = countFindings(report)

  return count === 1 ? '1 finding' : `${count} findings`
}

export const runReview = async (
  session: ReviewSessionDraft,
  dependencies: ReviewRunDependencies,
  onProgress: ProgressUpdate,
  signal?: AbortSignal,
): Promise<ReviewRunResult> => {
  const { runAgent, prepareWorkspace, readInstructions, now } = dependencies
  const reviewers = numberReviewers(session.reviewers)
  const workspace = await prepareWorkspace(session.repository.root, session.scope)

  const runOne = async (
    agentId: string,
    configuration: AgentConfiguration,
    instructionFiles: readonly string[],
    message: string,
  ): Promise<AgentRunResult> => {
    onProgress(agentId, () => startProgress(now()))
    const result = await runAgent(
      {
        configuration,
        cwd: session.repository.root,
        instructions: await readInstructions(instructionFiles),
        message,
        readableDirectories: [workspace.directory],
      },
      {
        timeoutMs: session.timeoutMinutes * 60_000,
        signal,
        onEvent: (event) => onProgress(agentId, (progress) => applyAgentEvent(progress, event)),
      },
    )
    const note = result.ok ? findingsNote(result.report) : result.error
    onProgress(agentId, (progress) => finishProgress(progress, { ok: result.ok, note }, now()))

    return result
  }

  try {
    // A cancel while the diff was being prepared starts no agents.
    if (signal?.aborted) {
      return { kind: 'cancelled' }
    }
    const reviewerReports = await Promise.all(
      reviewers.map(async (reviewer): Promise<ReviewerReport> => {
        const result = await runOne(
          reviewerAgentId(reviewer.number),
          reviewer.configuration,
          reviewerInstructionFiles(reviewer.reviewType),
          buildReviewerMessage(session, reviewer, workspace.diffPath),
        )

        return result.ok
          ? { reviewer, report: result.report, error: null }
          : { reviewer, report: null, error: result.error }
      }),
    )
    if (signal?.aborted) {
      return { kind: 'cancelled' }
    }
    if (reviewerReports.every((reviewerReport) => reviewerReport.report === null)) {
      onProgress(councilAgentId, (progress) =>
        finishProgress(progress, { ok: false, note: 'no reviewer reports' }, now()),
      )

      return { kind: 'reviewers-failed', reviewerReports }
    }

    const council = await runOne(
      councilAgentId,
      session.council,
      councilInstructionFiles(reviewers.map((reviewer) => reviewer.reviewType)),
      buildCouncilMessage(session, reviewerReports, workspace.diffPath),
    )
    if (signal?.aborted) {
      return { kind: 'cancelled' }
    }

    return council.ok
      ? { kind: 'reported', report: trimToReport(council.report), reviewerReports }
      : { kind: 'council-failed', error: council.error, reviewerReports }
  } finally {
    await workspace.cleanup()
  }
}
