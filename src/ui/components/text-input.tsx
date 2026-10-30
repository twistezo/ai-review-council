import { Text, useInput, usePaste } from 'ink'
import type { Dispatch, JSX, SetStateAction } from 'react'

import { theme } from '../theme.js'

type TextInputProps = {
  value: string
  onChange: Dispatch<SetStateAction<string>>
  onSubmit: () => void
  onTab?: () => void
  placeholder?: string
  isActive?: boolean
}

const isControlKey = (key: Parameters<Parameters<typeof useInput>[0]>[1]): boolean =>
  key.ctrl || key.meta || key.escape || key.upArrow || key.downArrow || key.leftArrow || key.rightArrow

// Single-line input; the cursor always stays at the end.
export const TextInput = ({
  value,
  onChange,
  onSubmit,
  onTab,
  placeholder = '',
  isActive = true,
}: TextInputProps): JSX.Element => {
  useInput(
    (input, key) => {
      if (key.return) {
        onSubmit()

        return
      }
      if (key.tab) {
        onTab?.()

        return
      }
      if (key.backspace || key.delete) {
        onChange((previous) => previous.slice(0, -1))

        return
      }
      if (!isControlKey(key) && input !== '') {
        onChange((previous) => previous + input)
      }
    },
    { isActive },
  )
  usePaste(
    (text) => {
      onChange((previous) => previous + text.replaceAll('\r', '').replaceAll('\n', ' '))
    },
    { isActive },
  )

  return (
    <Text>
      {value === '' ? <Text dimColor>{placeholder}</Text> : value}
      {isActive && <Text backgroundColor={theme.cursor}> </Text>}
    </Text>
  )
}
