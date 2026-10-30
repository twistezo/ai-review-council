import { Box, Text } from 'ink'
import type { JSX } from 'react'
import { useState } from 'react'

import { MultilineInput } from '../components/multiline-input.js'
import { StepFrame } from '../components/step-frame.js'

type PromptStepProps = {
  value: string
  readClipboard: () => Promise<string | null>
  // an empty prompt means a review of the code alone
  onSubmit: (prompt: string) => void
  onBack?: () => void
}

export const PromptStep = ({ value, readClipboard, onSubmit, onBack }: PromptStepProps): JSX.Element => {
  const [prompt, setPrompt] = useState(value)

  return (
    <StepFrame title="Review prompt" hints="Enter new line · Ctrl+D confirm · Ctrl+V or Cmd+V paste" onBack={onBack}>
      <Box marginBottom={1}>
        <Text dimColor>Task, acceptance criteria, links. Shared by all agents.</Text>
      </Box>
      <MultilineInput
        value={prompt}
        onChange={setPrompt}
        onSubmit={() => onSubmit(prompt.trim())}
        readClipboard={readClipboard}
        placeholder="Type or paste (Ctrl+V) the review prompt"
      />
    </StepFrame>
  )
}
