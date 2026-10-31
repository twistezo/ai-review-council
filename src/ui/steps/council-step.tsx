import { Box, Text } from 'ink'
import type { JSX } from 'react'
import { useState } from 'react'

import type { AgentConfiguration } from '../../domain/review-session.js'
import type { CatalogModel } from '../../providers/model-catalog.js'
import { choiceFromConfiguration, choiceToConfiguration } from '../agent-choice.js'
import { AgentPicker } from '../components/agent-picker.js'
import { StepFrame } from '../components/step-frame.js'

type CouncilStepProps = {
  models: readonly CatalogModel[]
  value: AgentConfiguration | null
  onSubmit: (configuration: AgentConfiguration) => void
  onBack?: () => void
}

export const CouncilStep = ({ models, value, onSubmit, onBack }: CouncilStepProps): JSX.Element => {
  const [choice, setChoice] = useState(() => choiceFromConfiguration(models, value))

  return (
    <StepFrame title="Council agent" hints="↑↓ row · ←→ column · Enter confirm" onBack={onBack}>
      <Box flexDirection="column" marginBottom={1}>
        <Text dimColor>Verifies findings and writes the final report.</Text>
        <Text dimColor>Use your strongest model.</Text>
      </Box>
      <AgentPicker
        models={models}
        choice={choice}
        onChange={setChoice}
        onSubmit={() => {
          const configuration = choiceToConfiguration(models, choice)
          if (configuration !== null) {
            onSubmit(configuration)
          }
        }}
      />
    </StepFrame>
  )
}
