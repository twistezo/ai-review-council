import type {
  AgentConfiguration,
  ChangedFile,
  ReportLanguage,
  ReviewScope,
  ReviewSessionDraft,
  ReviewType,
} from '../domain/review-session.js'
import { reportLanguageNames } from '../domain/review-session.js'
import { formatConfiguration } from '../providers/model-catalog.js'

export type NumberedReviewer = {
  number: number
  configuration: AgentConfiguration
  reviewType: ReviewType
}

export type ReviewerReport = {
  reviewer: NumberedReviewer
  // null when the reviewer failed
  report: string | null
  error: string | null
}

const changeLabels: Record<ChangedFile['change'], string> = {
  added: 'added',
  modified: 'modified',
  deleted: 'deleted',
  renamed: 'renamed',
  copied: 'copied',
  untracked: 'new, not in the diff: read it in full',
}

const describeFile = (file: ChangedFile): string =>
  `- ${file.previousPath === null ? file.path : `${file.previousPath} -> ${file.path}`} (${changeLabels[file.change]})`

const describeRange = (scope: ReviewScope): string => {
  const base = `${scope.base.hash.slice(0, 7)} ${scope.base.subject}`.trim()
  switch (scope.kind) {
    case 'uncommitted':
      return `Uncommitted changes against ${base}.`
    case 'since-commit':
      return `Everything changed after ${base}, up to the current files with uncommitted changes. The base commit itself is not part of the change.`
    case 'full':
      return `The entire codebase at ${base}, uncommitted changes included. Every file is part of the change and shows as added in the diff.`
  }
}

const scopeSection = (session: ReviewSessionDraft, diffPath: string): string => {
  const { repository, scope } = session
  const lines = [
    '## Scope',
    `Repository: ${repository.root} (${repository.branch === null ? 'detached HEAD' : `branch ${repository.branch}`})`,
    describeRange(scope),
    `Diff of tracked changes: ${diffPath}`,
    `Changed files (${scope.changedFiles.length}):`,
    ...scope.changedFiles.map(describeFile),
  ]
  if (scope.excludedFiles.length > 0) {
    lines.push(`Left out as likely secrets, do not open: ${scope.excludedFiles.join(', ')}`)
  }

  return lines.join('\n')
}

const noPrompt = 'None given. Review the change on its own merits and judge intent from the code.'

const promptSection = (session: ReviewSessionDraft): string =>
  ['## Review prompt', session.prompt === '' ? noPrompt : session.prompt].join('\n')

export const reviewerLabel = ({ number, configuration, reviewType }: NumberedReviewer): string =>
  `Reviewer ${number} · ${formatConfiguration(configuration)} · ${reviewType}`

export const buildReviewerMessage = (
  session: ReviewSessionDraft,
  reviewer: NumberedReviewer,
  diffPath: string,
): string =>
  [
    '# Review session',
    `You are reviewer ${reviewer.number} of ${session.reviewers.length}. Variant: ${reviewer.reviewType}.`,
    scopeSection(session, diffPath),
    promptSection(session),
  ].join('\n\n')

export const buildCouncilMessage = (
  session: ReviewSessionDraft,
  reports: readonly ReviewerReport[],
  diffPath: string,
): string =>
  [
    '# Council session',
    `Language of the final report: ${reportLanguageNames[session.language]}. Write every part of it in ${reportLanguageNames[session.language]}: headings, field names and values included.`,
    scopeSection(session, diffPath),
    promptSection(session),
    '## Reviewer reports',
    ...reports.map(({ reviewer, report, error }) =>
      [`### ${reviewerLabel(reviewer)}`, report ?? `This reviewer failed: ${error ?? 'unknown error'}.`].join('\n\n'),
    ),
  ].join('\n\n')

// Printed instead of the council report when the council fails: the reviewer reports as they are.
export const buildFallbackReport = (councilError: string, reports: readonly ReviewerReport[]): string =>
  [
    '# Review without council verification',
    `The council failed (${councilError}). These are the unverified reviewer reports.`,
    ...reports.map(({ reviewer, report, error }) =>
      [`## ${reviewerLabel(reviewer)}`, report ?? `This reviewer failed: ${error ?? 'unknown error'}.`].join('\n\n'),
    ),
  ].join('\n\n')
