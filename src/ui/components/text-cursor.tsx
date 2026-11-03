import type { Key } from "ink"
import { Text } from "ink"
import type { Dispatch, JSX, SetStateAction } from "react"
import { useRef, useState } from "react"

import { theme } from "../theme.js"

type TextCursor = {
  cursorIndex: number
  insert: (text: string) => void
  moveToEnd: () => void
  // Moves or deletes for ←, →, Backspace and Delete; false for any other key.
  handleEditingKey: (key: Key) => boolean
}

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" })

// A character is what the user sees as one: an emoji or an accented letter can span several code units.
const characterStarts = (text: string): number[] =>
  Array.from(graphemes.segment(text), segment => segment.index)

const previousBoundary = (text: string, index: number): number =>
  characterStarts(text)
    .filter(start => start < index)
    .at(-1) ?? 0

const nextBoundary = (text: string, index: number): number =>
  characterStarts(text).find(start => start > index) ?? text.length

const snapToBoundary = (text: string, index: number): number =>
  index === text.length || characterStarts(text).includes(index)
    ? index
    : previousBoundary(text, index)

// The cursor is a distance from the end, so a value changed from outside keeps the text after the cursor.
// Edits work on the latest text in a ref, not on the rendered value: Ink handles every key of one input
// chunk before React renders, and each key has to see the edits of the keys before it.
export const useTextCursor = (
  value: string,
  onChange: Dispatch<SetStateAction<string>>,
): TextCursor => {
  const latestText = useRef(value)
  const renderedValue = useRef(value)
  const offsetFromEnd = useRef(0)
  // Only the ref changes when the cursor moves, so the move asks for a render itself.
  const [, requestRender] = useState(0)

  const cursorIndexIn = (text: string): number =>
    text.length - Math.min(offsetFromEnd.current, text.length)

  if (renderedValue.current !== value) {
    renderedValue.current = value
    latestText.current = value
    offsetFromEnd.current =
      value.length - snapToBoundary(value, cursorIndexIn(value))
  }

  const setCursor = (index: number): void => {
    offsetFromEnd.current = latestText.current.length - index
    requestRender(count => count + 1)
  }
  // Replaces the text before and after the cursor; the cursor ends between the two.
  const editAtCursor = (
    edit: (before: string, after: string) => [string, string],
  ): void => {
    const text = latestText.current
    const index = cursorIndexIn(text)
    const [before, after] = edit(text.slice(0, index), text.slice(index))
    offsetFromEnd.current = after.length
    latestText.current = before + after
    onChange(before + after)
  }
  const deleteBefore = (): void =>
    editAtCursor((before, after) => [
      before.slice(0, previousBoundary(before, before.length)),
      after,
    ])
  const deleteAfter = (): void =>
    editAtCursor((before, after) => [
      before,
      after.slice(nextBoundary(after, 0)),
    ])
  const moveLeft = (): void => {
    const text = latestText.current
    setCursor(previousBoundary(text, cursorIndexIn(text)))
  }
  const moveRight = (): void => {
    const text = latestText.current
    setCursor(nextBoundary(text, cursorIndexIn(text)))
  }

  return {
    cursorIndex: cursorIndexIn(value),
    insert: inserted =>
      editAtCursor((before, after) => [before + inserted, after]),
    moveToEnd: () => setCursor(latestText.current.length),
    handleEditingKey: key => {
      if (key.backspace) {
        deleteBefore()
      } else if (key.delete) {
        deleteAfter()
      } else if (key.leftArrow) {
        moveLeft()
      } else if (key.rightArrow) {
        moveRight()
      } else {
        return false
      }

      return true
    },
  }
}

type CursorLineProps = {
  text: string
  // null when the cursor is not on this line
  column: number | null
}

// Highlights the whole character under the cursor, or a space after the last one.
export const CursorLine = ({ text, column }: CursorLineProps): JSX.Element => {
  if (column === null) {
    return <Text>{text}</Text>
  }
  const end = nextBoundary(text, column)

  return (
    <Text>
      {text.slice(0, column)}
      <Text backgroundColor={theme.cursor}>
        {column < text.length ? text.slice(column, end) : " "}
      </Text>
      {text.slice(end)}
    </Text>
  )
}
