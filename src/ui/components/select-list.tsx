import { Box, Text, useInput } from 'ink'
import type { JSX } from 'react'
import { useState } from 'react'

import { clampIndex } from '../list-state.js'
import { theme } from '../theme.js'

type SelectItem = {
  key: string
  label: string
}

type SelectListProps = {
  items: readonly SelectItem[]
  onSelect: (key: string) => void
  initialKey?: string | null
  isActive?: boolean
}

export const SelectList = ({ items, onSelect, initialKey = null, isActive = true }: SelectListProps): JSX.Element => {
  const [cursor, setCursor] = useState(() => Math.max(0, items.findIndex((item) => item.key === initialKey)))

  useInput(
    (_input, key) => {
      if (key.upArrow || key.downArrow) {
        setCursor((previous) => clampIndex(previous + (key.upArrow ? -1 : 1), items.length))

        return
      }
      const selected = items[cursor]
      if (key.return && selected !== undefined) {
        onSelect(selected.key)
      }
    },
    { isActive },
  )

  return (
    <Box flexDirection="column">
      {items.map((item, index) => (
        <Text key={item.key} color={index === cursor ? theme.selection : undefined}>
          {index === cursor ? '› ' : '  '}
          {item.label}
        </Text>
      ))}
    </Box>
  )
}
