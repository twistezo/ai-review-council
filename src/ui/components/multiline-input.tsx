import { Box, Text, useInput, usePaste } from 'ink'
import type { Dispatch, JSX, SetStateAction } from 'react'

import { theme } from '../theme.js'

type MultilineInputProps = {
  value: string
  onChange: Dispatch<SetStateAction<string>>
  onSubmit: () => void
  // Ctrl+V reads the clipboard; Cmd+V arrives as a terminal paste either way.
  readClipboard: () => Promise<string | null>
  placeholder?: string
}

const normalizeNewlines = (text: string): string => text.replaceAll('\r\n', '\n').replaceAll('\r', '\n')

// Enter inserts a new line and Ctrl+D submits: most terminals send Shift+Enter exactly like Enter.
export const MultilineInput = ({
  value,
  onChange,
  onSubmit,
  readClipboard,
  placeholder = '',
}: MultilineInputProps): JSX.Element => {
  const append = (text: string): void => {
    onChange((previous) => previous + normalizeNewlines(text))
  }

  useInput((input, key) => {
    if (key.ctrl && input === 'd') {
      onSubmit()

      return
    }
    if (key.ctrl && input === 'v') {
      void readClipboard().then((text) => {
        if (text !== null) {
          append(text)
        }
      })

      return
    }
    if (key.return) {
      onChange((previous) => `${previous}\n`)

      return
    }
    if (key.backspace || key.delete) {
      onChange((previous) => previous.slice(0, -1))

      return
    }
    if (key.ctrl || key.meta || key.escape || key.tab || key.upArrow || key.downArrow) {
      return
    }
    if (key.leftArrow || key.rightArrow || input === '') {
      return
    }
    onChange((previous) => previous + input)
  })
  usePaste(append)

  const lines = value.split('\n')

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.muted} paddingX={1}>
      {value === '' ? (
        <Text>
          <Text dimColor>{placeholder}</Text>
          <Text backgroundColor={theme.cursor}> </Text>
        </Text>
      ) : (
        lines.map((line, index) => (
          <Text key={index}>
            {line}
            {index === lines.length - 1 && <Text backgroundColor={theme.cursor}> </Text>}
          </Text>
        ))
      )}
    </Box>
  )
}
