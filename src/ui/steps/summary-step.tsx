import { Box, Text } from 'ink'
import type { JSX } from 'react'

import type { ReviewSessionDraft } from '../../domain/review-session.js'
import { reportLanguageNames } from '../../domain/review-session.js'
import { formatConfiguration } from '../../providers/model-catalog.js'
import { Field, labelWidth } from '../components/field.js'
import { describeScope } from '../describe-scope.js'
import { ReviewerList } from '../components/reviewer-list.js'
import { SelectList } from '../components/select-list.js'
import { StepFrame } from '../components/step-frame.js'
import { theme } from '../theme.js'

type SummaryAction = 'start' | 'back'

type SummaryStepProps = {
  session: ReviewSessionDraft
  onAction: (action: SummaryAction) => void
}

// A long prompt is cut to its first lines, ending with an ellipsis.
const maxPromptLines = 3
const ellipsis = '...'

export const summarizePrompt = (prompt: string): string[] => {
  const lines = prompt.split('\n')
  if (lines.length <= maxPromptLines) {
    return lines
  }
  const shown = lines.slice(0, maxPromptLines)

  return [...shown.slice(0, -1), `${shown.at(-1) ?? ''}${ellipsis}`]
}

export const SummaryStep = ({ session, onAction }: SummaryStepProps): JSX.Element => {
  const { repository, reviewers } = session
  const [firstPromptLine = '', ...otherPromptLines] = summarizePrompt(session.prompt)

  return (
    <StepFrame title="Summary" hints="Enter confirm" onBack={() => onAction('back')}>
      <Field label="Language">{reportLanguageNames[session.language]}</Field>
      <Field label="Project">{repository.root}</Field>
      <Field label="Branch">{repository.branch ?? 'detached HEAD'}</Field>
      <Field label="Working tree">
        {repository.hasChanges ? (
          <Text color={theme.warning}>currently has uncommitted changes</Text>
        ) : (
          <Text color={theme.success}>currently clean</Text>
        )}
      </Field>
      <Field label="Scope">{describeScope(session.scope)}</Field>
      <Field label="Council">{formatConfiguration(session.council)}</Field>
      <Field label="Reviewers">{null}</Field>
      <Box paddingLeft={labelWidth}>
        <ReviewerList reviewers={reviewers} />
      </Box>
      <Field label="Prompt">{session.prompt === '' ? <Text dimColor>none, review of the code alone</Text> : firstPromptLine}</Field>
      {otherPromptLines.map((line, index) => (
        <Box key={index} paddingLeft={labelWidth}>
          <Text>{line}</Text>
        </Box>
      ))}
      <Field label="Timeout">{session.timeoutMinutes} min per agent</Field>

      <Box marginTop={1}>
        <SelectList
          items={[{ key: 'start', label: 'Start' }]}
          onSelect={() => onAction('start')}
        />
      </Box>
    </StepFrame>
  )
}
