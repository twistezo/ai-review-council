import { Box, Text, useInput, usePaste } from "ink"
import type { Dispatch, JSX, SetStateAction } from "react"

import { theme } from "../theme.js"
import { CursorLine, useTextCursor } from "./text-cursor.js"

type MultilineInputProps = {
  value: string
  onChange: Dispatch<SetStateAction<string>>
  onSubmit: () => void
  // Ctrl+V reads the clipboard; the terminal's own paste (Cmd+V, Ctrl+Shift+V) arrives as a paste either way.
  readClipboard: () => Promise<string | null>
  placeholder?: string
}

const normalizeNewlines = (text: string): string =>
  text.replaceAll("\r\n", "\n").replaceAll("\r", "\n")

// Where each line starts in the whole value; every line break takes one character.
const lineStarts = (lines: readonly string[]): number[] => {
  const starts: number[] = []
  let start = 0
  for (const line of lines) {
    starts.push(start)
    start += line.length + 1
  }

  return starts
}

// Enter inserts a new line and Ctrl+D submits: most terminals send Shift+Enter exactly like Enter.
// ←→ move the cursor, also across line breaks.
export const MultilineInput = ({
  value,
  onChange,
  onSubmit,
  readClipboard,
  placeholder = "",
}: MultilineInputProps): JSX.Element => {
  const cursor = useTextCursor(value, onChange)
  const insertText = (text: string): void => {
    cursor.insert(normalizeNewlines(text))
  }

  useInput((input, key) => {
    if (key.ctrl && input === "d") {
      onSubmit()

      return
    }
    if (key.ctrl && input === "v") {
      void readClipboard().then(text => {
        if (text !== null) {
          insertText(text)
        }
      })

      return
    }
    if (key.return) {
      cursor.insert("\n")

      return
    }
    if (cursor.handleEditingKey(key)) {
      return
    }
    if (
      key.ctrl ||
      key.meta ||
      key.escape ||
      key.tab ||
      key.upArrow ||
      key.downArrow ||
      input === ""
    ) {
      return
    }
    cursor.insert(input)
  })
  usePaste(insertText)

  const lines = value.split("\n")
  const starts = lineStarts(lines)

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.muted}
      paddingX={1}
    >
      {value === "" ? (
        <Text>
          <Text dimColor>{placeholder}</Text>
          <Text backgroundColor={theme.cursor}> </Text>
        </Text>
      ) : (
        lines.map((line, index) => {
          const column = cursor.cursorIndex - (starts[index] ?? 0)

          return (
            <CursorLine
              key={index}
              text={line}
              column={column >= 0 && column <= line.length ? column : null}
            />
          )
        })
      )}
    </Box>
  )
}
