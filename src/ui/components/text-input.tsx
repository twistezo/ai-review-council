import { Text, useInput, usePaste } from "ink"
import type { Dispatch, JSX, SetStateAction } from "react"

import { theme } from "../theme.js"
import { CursorLine, useTextCursor } from "./text-cursor.js"

type TextInputProps = {
  value: string
  onChange: Dispatch<SetStateAction<string>>
  onSubmit: () => void
  onTab?: () => void
  placeholder?: string
  isActive?: boolean
}

const isControlKey = (
  key: Parameters<Parameters<typeof useInput>[0]>[1],
): boolean => key.ctrl || key.meta || key.escape || key.upArrow || key.downArrow

// Single-line input; ←→ move the cursor, and Tab completion leaves it at the end.
export const TextInput = ({
  value,
  onChange,
  onSubmit,
  onTab,
  placeholder = "",
  isActive = true,
}: TextInputProps): JSX.Element => {
  const cursor = useTextCursor(value, onChange)

  useInput(
    (input, key) => {
      if (key.return) {
        onSubmit()

        return
      }
      if (key.tab) {
        cursor.moveToEnd()
        onTab?.()

        return
      }
      if (cursor.handleEditingKey(key)) {
        return
      }
      if (!isControlKey(key) && input !== "") {
        cursor.insert(input)
      }
    },
    { isActive },
  )
  usePaste(
    text => {
      cursor.insert(text.replaceAll("\r", "").replaceAll("\n", " "))
    },
    { isActive },
  )

  if (value === "") {
    return (
      <Text>
        <Text dimColor>{placeholder}</Text>
        {isActive && <Text backgroundColor={theme.cursor}> </Text>}
      </Text>
    )
  }

  return (
    <CursorLine text={value} column={isActive ? cursor.cursorIndex : null} />
  )
}
