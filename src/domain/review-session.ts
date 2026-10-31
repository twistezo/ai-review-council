import { z } from 'zod'

const providerIds = ['codex', 'claude'] as const
const providerIdSchema = z.enum(providerIds)
export type ProviderId = z.infer<typeof providerIdSchema>

export const reportLanguages = ['en', 'pl'] as const
export const reportLanguageSchema = z.enum(reportLanguages)
export type ReportLanguage = z.infer<typeof reportLanguageSchema>

export const reportLanguageNames: Record<ReportLanguage, string> = {
  en: 'English',
  pl: 'Polish',
}

export const reviewTypes = ['code', 'security', 'ui-ux'] as const
const reviewTypeSchema = z.enum(reviewTypes)
export type ReviewType = z.infer<typeof reviewTypeSchema>

const agentConfigurationSchema = z.object({
  provider: providerIdSchema,
  model: z.string().min(1),
  modelLabel: z.string().min(1),
  // null when the provider declares no effort levels for the model
  effort: z.string().min(1).nullable(),
})
export type AgentConfiguration = z.infer<typeof agentConfigurationSchema>

export const maxReviewers = 8

const reviewerAssignmentSchema = z.object({
  configuration: agentConfigurationSchema,
  reviewType: reviewTypeSchema,
})
export type ReviewerAssignment = z.infer<typeof reviewerAssignmentSchema>

const repositorySummarySchema = z.object({
  root: z.string().min(1),
  // null means detached HEAD
  branch: z.string().min(1).nullable(),
  hasChanges: z.boolean(),
})
type RepositorySummary = z.infer<typeof repositorySummarySchema>

const fileChanges = ['added', 'modified', 'deleted', 'renamed', 'copied', 'untracked'] as const
const changedFileSchema = z.object({
  path: z.string().min(1),
  previousPath: z.string().min(1).nullable(),
  change: z.enum(fileChanges),
})
export type ChangedFile = z.infer<typeof changedFileSchema>

const commitInfoSchema = z.object({
  hash: z.string().length(40),
  subject: z.string(),
})
export type CommitInfo = z.infer<typeof commitInfoSchema>

const reviewScopeKinds = ['uncommitted', 'since-commit', 'full'] as const
const reviewScopeSchema = z.object({
  kind: z.enum(reviewScopeKinds),
  // the commit the review starts from; HEAD for `full`
  base: commitInfoSchema,
  // what the diff is taken against: the base commit, or Git's empty tree for `full`, so every file shows as added
  diffBase: z.string().min(1),
  changedFiles: z.array(changedFileSchema).min(1),
  // paths of likely secret files left out of the review
  excludedFiles: z.array(z.string().min(1)),
})
export type ReviewScope = z.infer<typeof reviewScopeSchema>
export type ReviewScopeKind = ReviewScope['kind']

export const defaultTimeoutMinutes = 10
export const maxTimeoutMinutes = 30
export const timeoutMinutesSchema = z.number().int().min(1).max(maxTimeoutMinutes)

export const reviewSessionDraftSchema = z.object({
  language: reportLanguageSchema,
  repository: repositorySummarySchema,
  scope: reviewScopeSchema,
  council: agentConfigurationSchema,
  reviewers: z.array(reviewerAssignmentSchema).min(1).max(maxReviewers),
  // empty: review the code alone
  prompt: z.string().trim(),
  // per agent; a run past it fails
  timeoutMinutes: timeoutMinutesSchema,
})
export type ReviewSessionDraft = z.infer<typeof reviewSessionDraftSchema>
