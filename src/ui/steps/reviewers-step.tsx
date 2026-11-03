import { Box, Text, useInput } from "ink"
import type { JSX } from "react"
import { useState } from "react"

import type { ReviewerAssignment } from "../../domain/review-session.js"
import { maxReviewers } from "../../domain/review-session.js"
import type { CatalogModel } from "../../providers/model-catalog.js"
import {
  choiceFromConfiguration,
  choiceToConfiguration,
  newReviewer,
} from "../agent-choice.js"
import { AgentPicker } from "../components/agent-picker.js"
import { ReviewerList } from "../components/reviewer-list.js"
import { StepFrame } from "../components/step-frame.js"
import { theme } from "../theme.js"

// Only accepted reviewers count; the draft is the one being edited, null once the limit is reached.
export type ReviewerSelection = {
  accepted: ReviewerAssignment[]
  draft: ReviewerAssignment | null
}

type ReviewersStepProps = {
  models: readonly CatalogModel[]
  // a draft is kept when Esc goes back to the council
  value: ReviewerSelection
  onChange: (selection: ReviewerSelection) => void
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
const ReviewerEditor = ({
  models,
  reviewer,
  onChange,
  onSubmit,
}: ReviewerEditorProps): JSX.Element => {
  const choice = choiceFromConfiguration(models, reviewer.configuration)

  return (
    <AgentPicker
      models={models}
      choice={choice}
      onChange={next => {
        const configuration = choiceToConfiguration(models, next)
        if (configuration !== null) {
          onChange({ ...reviewer, configuration })
        }
      }}
      reviewType={{
        value: reviewer.reviewType,
        onChange: reviewType => onChange({ ...reviewer, reviewType }),
      }}
      onSubmit={onSubmit}
    />
  )
}

// A new reviewer starts from a clean choice: the first model with its default effort.
const freshReviewer = (
  models: readonly CatalogModel[],
  position: number,
): ReviewerAssignment | null => {
  const configuration = choiceToConfiguration(
    models,
    choiceFromConfiguration(models, null),
  )

  return configuration === null ? null : newReviewer(configuration, position)
}

// The next draft, or null when the accepted reviewers reach the limit.
const nextDraft = (
  models: readonly CatalogModel[],
  accepted: readonly ReviewerAssignment[],
): ReviewerAssignment | null =>
  accepted.length < maxReviewers ? freshReviewer(models, accepted.length) : null

export const ReviewersStep = ({
  models,
  value,
  onChange,
  onSubmit,
  onBack,
}: ReviewersStepProps): JSX.Element => {
  // coming back from the prompt, every accepted reviewer stays and a new one opens
  const [selection, setSelection] = useState<ReviewerSelection>(() => ({
    accepted: value.accepted,
    draft: value.draft ?? nextDraft(models, value.accepted),
  }))
  const { accepted, draft } = selection
  const isAtLimit = accepted.length === maxReviewers

  const updateSelection = (next: ReviewerSelection): void => {
    setSelection(next)
    onChange(next)
  }

  useInput((input, key) => {
    if (key.ctrl && input === "d" && accepted.length > 0) {
      onSubmit(accepted)
    }
  })

  return (
    <StepFrame
      title={isAtLimit ? "Reviewers" : `Reviewer ${accepted.length + 1}`}
      hints={`↑↓ row · ←→ column · Enter next${accepted.length > 0 ? " · Ctrl+D confirm" : ""}`}
      onBack={() => {
        const last = accepted.at(-1)
        if (last === undefined) {
          onBack?.()
        } else {
          updateSelection({ accepted: accepted.slice(0, -1), draft: last })
        }
      }}
    >
      {accepted.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <ReviewerList reviewers={accepted} dimmed />
        </Box>
      )}
      {isAtLimit && (
        <Text dimColor>
          Maximum {maxReviewers} reviewers. Press Ctrl+D to confirm them or Esc
          to edit the last one.
        </Text>
      )}
      {!isAtLimit && draft === null && (
        <Text color={theme.failure}>No model is available for reviewers.</Text>
      )}
      {draft !== null && (
        <ReviewerEditor
          key={accepted.length}
          models={models}
          reviewer={draft}
          onChange={next => updateSelection({ accepted, draft: next })}
          onSubmit={() => {
            const nextAccepted = [...accepted, draft]
            updateSelection({
              accepted: nextAccepted,
              draft: nextDraft(models, nextAccepted),
            })
          }}
        />
      )}
    </StepFrame>
  )
}
