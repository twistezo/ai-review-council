import { Box, Text, useInput } from 'ink'
import type { JSX, ReactNode } from 'react'
import { createContext, useContext } from 'react'

import { theme } from '../theme.js'

// The step counter, e.g. `step 1 of 5`, shown after the step title; null hides it.
export const StepCounterContext = createContext<string | null>(null)

// The answers so far, shown under the step title; null hides them.
export const StepAnswersContext = createContext<ReactNode>(null)

type StepFrameProps = {
  title: string
  hints: string
  // Esc goes back when provided.
  onBack?: () => void
  children: ReactNode
}

export const StepFrame = ({ title, hints, onBack, children }: StepFrameProps): JSX.Element => {
  const stepCounter = useContext(StepCounterContext)
  const answers = useContext(StepAnswersContext)

  useInput(
    (_input, key) => {
      if (key.escape) {
        onBack?.()
      }
    },
    { isActive: onBack !== undefined },
  )

  return (
    <Box flexDirection="column">
      <Text>
        <Text bold color={theme.title}>
          {title}
        </Text>
        {stepCounter !== null && <Text dimColor> • {stepCounter}</Text>}
      </Text>
      {answers !== null && <Box marginTop={1}>{answers}</Box>}
      <Box flexDirection="column" marginY={1}>
        {children}
      </Box>
      <Text dimColor>
        {hints}
        {onBack !== undefined && ' · Esc back'} · Ctrl+C quit
      </Text>
    </Box>
  )
}

export const ErrorText = ({ message }: { message: string | null }): JSX.Element | null =>
  message === null ? null : <Text color={theme.failure}>{message}</Text>
