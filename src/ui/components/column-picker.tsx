import { Box, Text, useInput } from 'ink'
import type { JSX } from 'react'
import { useState } from 'react'

import { clampIndex, visibleWindow } from '../list-state.js'
import { theme } from '../theme.js'

export type PickerColumn = {
  title: string
  options: readonly string[]
  selected: number
}

type ColumnPickerProps = {
  columns: readonly PickerColumn[]
  onChange: (column: number, option: number) => void
  onSubmit: () => void
  height?: number
}

// Side-by-side lists: ↑↓ changes the value, ←→ or Tab move between columns, Enter confirms the whole row.
export const ColumnPicker = ({ columns, onChange, onSubmit, height = 10 }: ColumnPickerProps): JSX.Element => {
  const [activeColumn, setActiveColumn] = useState(0)

  useInput((_input, key) => {
    if (key.return) {
      onSubmit()

      return
    }
    if (key.leftArrow || key.rightArrow || key.tab) {
      const direction = key.leftArrow || (key.tab && key.shift) ? -1 : 1
      setActiveColumn((previous) => (previous + direction + columns.length) % columns.length)

      return
    }
    const column = columns[activeColumn]
    if (column !== undefined && (key.upArrow || key.downArrow)) {
      onChange(activeColumn, clampIndex(column.selected + (key.upArrow ? -1 : 1), column.options.length))
    }
  })

  return (
    <Box flexDirection="row" gap={3}>
      {columns.map((column, columnIndex) => {
        const isActiveColumn = columnIndex === activeColumn
        const { start, end } = visibleWindow(column.options.length, column.selected, height)

        return (
          <Box key={column.title} flexDirection="column">
            <Text bold underline={isActiveColumn} color={isActiveColumn ? theme.focus : undefined}>
              {isActiveColumn ? '› ' : '  '}
              {column.title}
            </Text>
            <Text dimColor>{start > 0 ? '  ↑' : ' '}</Text>
            {column.options.slice(start, end).map((option, offset) => {
              const isSelected = start + offset === column.selected

              return (
                <Text key={option} color={isSelected ? (isActiveColumn ? theme.selection : theme.chosen) : undefined} dimColor={!isSelected}>
                  {isSelected ? '› ' : '  '}
                  {option}
                </Text>
              )
            })}
            <Text dimColor>{end < column.options.length ? '  ↓' : ' '}</Text>
          </Box>
        )
      })}
    </Box>
  )
}
