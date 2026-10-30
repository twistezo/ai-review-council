import { Box, Text } from 'ink'
import type { JSX } from 'react'

import type {
  AgentConfiguration,
  ReportLanguage,
  ReviewerAssignment,
  ReviewScope,
} from '../../domain/review-session.js'
import { reportLanguageNames } from '../../domain/review-session.js'
import type { RepositoryState } from '../../git/git-repository.js'
import { formatConfiguration } from '../../providers/model-catalog.js'
import { describeScope } from '../describe-scope.js'
import { theme } from '../theme.js'
import { Field, labelWidth } from './field.js'
import { ReviewerList } from './reviewer-list.js'

const answerFields = ['language', 'project', 'scope', 'council', 'reviewers', 'prompt'] as const
export type AnswerField = (typeof answerFields)[number]

// What the wizard knows so far; null for a question not answered yet.
export type WizardAnswers = {
  language: ReportLanguage | null
  repository: RepositoryState | null
  scope: ReviewScope | null
  council: AgentConfiguration | null
  reviewers: readonly ReviewerAssignment[] | null
  prompt: string | null
}

type AnswersPanelProps = {
  answers: WizardAnswers
  // the field the current step sets
  selecting: AnswerField | null
}

const Selecting = (): JSX.Element => <Text color={theme.selection}>← selecting</Text>

const firstLine = (text: string): string => {
  const [line = ''] = text.split('\n')

  return text.includes('\n') ? `${line} …` : line
}

// Earlier answers in wizard order, then the field the current step sets.
export const AnswersPanel = ({ answers, selecting }: AnswersPanelProps): JSX.Element | null => {
  const isShown = (field: AnswerField, value: unknown): boolean => selecting === field || value !== null
  const fields: JSX.Element[] = []

  if (isShown('language', answers.language)) {
    fields.push(
      <Field key="language" label="Language">
        {selecting === 'language' || answers.language === null ? <Selecting /> : reportLanguageNames[answers.language]}
      </Field>,
    )
  }
  if (isShown('project', answers.repository)) {
    const { repository } = answers
    fields.push(
      <Field key="project" label="Project">
        {selecting === 'project' || repository === null ? <Selecting /> : repository.root}
      </Field>,
    )
    if (selecting !== 'project' && repository !== null) {
      fields.push(
        <Field key="branch" label="Branch">
          {repository.branch ?? `detached HEAD at ${repository.head?.hash.slice(0, 7) ?? '?'}`}
        </Field>,
      )
    }
  }
  if (isShown('scope', answers.scope)) {
    fields.push(
      <Field key="scope" label="Scope">
        {selecting === 'scope' || answers.scope === null ? <Selecting /> : describeScope(answers.scope)}
      </Field>,
    )
  }
  if (isShown('council', answers.council)) {
    fields.push(
      <Field key="council" label="Council">
        {selecting === 'council' || answers.council === null ? <Selecting /> : formatConfiguration(answers.council)}
      </Field>,
    )
  }
  if (isShown('reviewers', answers.reviewers)) {
    const { reviewers } = answers
    fields.push(
      <Field key="reviewers" label="Reviewers">
        {selecting === 'reviewers' || reviewers === null ? <Selecting /> : String(reviewers.length)}
      </Field>,
    )
    if (selecting !== 'reviewers' && reviewers !== null) {
      fields.push(
        <Box key="reviewer-list" paddingLeft={labelWidth}>
          <ReviewerList reviewers={reviewers} />
        </Box>,
      )
    }
  }
  if (isShown('prompt', answers.prompt)) {
    fields.push(
      <Field key="prompt" label="Prompt">
        {selecting === 'prompt' || answers.prompt === null ? (
          <Selecting />
        ) : answers.prompt === '' ? (
          <Text dimColor>none</Text>
        ) : (
          firstLine(answers.prompt)
        )}
      </Field>,
    )
  }

  return fields.length === 0 ? null : <Box flexDirection="column">{fields}</Box>
}
