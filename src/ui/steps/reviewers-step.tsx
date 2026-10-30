import { Box, Text } from 'ink'
import type { JSX } from 'react'
import { useState } from 'react'

import type { ReviewerAssignment } from '../../domain/review-session.js'
import { maxReviewers } from '../../domain/review-session.js'
import type { CatalogModel } from '../../providers/model-catalog.js'
import { choiceFromConfiguration, choiceToConfiguration, resizeReviewers } from '../agent-choice.js'
import { AgentPicker } from '../components/agent-picker.js'
import { ReviewerList } from '../components/reviewer-list.js'
import { SelectList } from '../components/select-list.js'
import { StepFrame } from '../components/step-frame.js'
import { theme } from '../theme.js'

type ReviewersStepProps = {
  models: readonly CatalogModel[]
  value: readonly ReviewerAssignment[]
  // from `--reviewers`; skips the count question
  presetCount: number | null
  onSubmit: (reviewers: ReviewerAssignment[]) => void
  onBack?: () => void
}

type ReviewerEditorProps = {
  models: readonly CatalogModel[]
  reviewer: ReviewerAssignment
  onChange: (reviewer: ReviewerAssignment) => void
  onSubmit: () => void
}

// Keyed by reviewer index so the column focus resets for each reviewer.
const ReviewerEditor = ({ models, reviewer, onChange, onSubmit }: ReviewerEditorProps): JSX.Element => {
  const choice = choiceFromConfiguration(models, reviewer.configuration)

  return (
    <AgentPicker
      models={models}
      choice={choice}
      onChange={(next) => {
        const configuration = choiceToConfiguration(models, next)
        if (configuration !== null) {
          onChange({ ...reviewer, configuration })
        }
      }}
      reviewType={{ value: reviewer.reviewType, onChange: (reviewType) => onChange({ ...reviewer, reviewType }) }}
      onSubmit={onSubmit}
    />
  )
}

// A new reviewer starts from a clean choice: the first model with its default effort.
const resize = (
  models: readonly CatalogModel[],
  reviewers: readonly ReviewerAssignment[],
  count: number,
): ReviewerAssignment[] => {
  const fresh = choiceToConfiguration(models, choiceFromConfiguration(models, null))

  return fresh === null ? [...reviewers] : resizeReviewers(reviewers, count, fresh)
}

export const ReviewersStep = ({ models, value, presetCount, onSubmit, onBack }: ReviewersStepProps): JSX.Element => {
  const [reviewers, setReviewers] = useState<ReviewerAssignment[]>(() =>
    presetCount === null ? [...value] : resize(models, value, presetCount),
  )
  // null shows the count question; a number edits that reviewer. `--reviewers` skips the question.
  const [editing, setEditing] = useState<number | null>(presetCount === null ? null : 0)

  if (editing === null) {
    return (
      <StepFrame title="Reviewers" hints="↑↓ row · Enter confirm" onBack={onBack}>
        <Box marginBottom={1}>
          <Text dimColor>How many reviewers? Each one reviews independently.</Text>
        </Box>
        <SelectList
          items={Array.from({ length: maxReviewers }, (_, index) => ({
            key: String(index + 1),
            label: String(index + 1),
          }))}
          initialKey={String(Math.max(1, value.length))}
          onSelect={(key) => {
            setReviewers((previous) => resize(models, previous, Number(key)))
            setEditing(0)
          }}
        />
      </StepFrame>
    )
  }

  const reviewer = reviewers[editing]
  if (reviewer === undefined) {
    return <Text color={theme.failure}>Reviewer not found.</Text>
  }

  return (
    <StepFrame
      title={`Reviewer ${editing + 1} of ${reviewers.length}`}
      hints="↑↓ row · ←→ column · Enter confirm"
      onBack={() => {
        if (editing > 0) {
          setEditing(editing - 1)
        } else if (presetCount === null) {
          setEditing(null)
        } else {
          onBack?.()
        }
      }}
    >
      {editing > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <ReviewerList reviewers={reviewers.slice(0, editing)} dimmed />
        </Box>
      )}
      <ReviewerEditor
        key={editing}
        models={models}
        reviewer={reviewer}
        onChange={(next) => setReviewers((previous) => previous.map((item, index) => (index === editing ? next : item)))}
        onSubmit={() => {
          if (editing + 1 < reviewers.length) {
            setEditing(editing + 1)
          } else {
            onSubmit(reviewers)
          }
        }}
      />
    </StepFrame>
  )
}
