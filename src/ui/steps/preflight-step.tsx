import { Box, Text, useInput } from 'ink'
import type { JSX } from 'react'
import { useEffect, useState } from 'react'

import type { CheckState, PreflightCheck, PreflightDependencies, PreflightResult } from '../../preflight/run-preflight.js'
import { runPreflight } from '../../preflight/run-preflight.js'
import { StepFrame } from '../components/step-frame.js'
import { theme } from '../theme.js'

type PreflightStepProps = {
  dependencies: PreflightDependencies
  // Called as soon as the checks pass; the wizard moves on without a key press.
  onPassed: (result: PreflightResult) => void
  onBlocked: () => void
}

const stateMarks: Record<CheckState, JSX.Element> = {
  ok: <Text color={theme.success}>✔</Text>,
  unavailable: <Text color={theme.warning}>–</Text>,
  failed: <Text color={theme.failure}>✘</Text>,
}

// One line under the app title once the checks passed.
export const RequirementsLine = ({ checks }: { checks: readonly PreflightCheck[] }): JSX.Element => (
  <Text wrap="truncate-end">
    {checks
      .filter((check) => check.label !== 'Instructions' || check.state !== 'ok')
      .map((check, index) => (
        <Text key={check.label}>
          {index > 0 && <Text dimColor> · </Text>}
          {stateMarks[check.state]} <Text dimColor={check.state === 'ok'}>{check.label}</Text>
          {check.state !== 'ok' && <Text color={theme.warning}> ({check.detail})</Text>}
        </Text>
      ))}
  </Text>
)

export const PreflightStep = ({ dependencies, onPassed, onBlocked }: PreflightStepProps): JSX.Element => {
  const [result, setResult] = useState<PreflightResult | null>(null)

  useEffect(() => {
    void runPreflight(dependencies).then((checked) => {
      if (checked.blocker === null) {
        onPassed(checked)
      } else {
        setResult(checked)
      }
    })
  }, [dependencies])

  useInput(
    (_input, key) => {
      if (key.return) {
        onBlocked()
      }
    },
    { isActive: result !== null },
  )

  if (result === null) {
    return <Text color={theme.warning}>Loading…</Text>
  }

  return (
    <StepFrame title="Requirements not met" hints="Enter exit">
      {result.checks.map((check) => (
        <Box key={check.label} flexDirection="column">
          <Text>
            {stateMarks[check.state]} {check.label}
            <Text dimColor> {check.detail}</Text>
          </Text>
          {check.fix !== null && <Text color={theme.warning}>  Fix: {check.fix}</Text>}
        </Box>
      ))}
      <Box marginTop={1}>
        <Text color={theme.failure}>{result.blocker}</Text>
      </Box>
    </StepFrame>
  )
}
