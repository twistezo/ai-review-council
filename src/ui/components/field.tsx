import { Text } from 'ink'
import type { JSX, ReactNode } from 'react'

import { theme } from '../theme.js'

// Label and value on one line; every value starts in the same column.
export const labelWidth = 14

export const Field = ({ label, children }: { label: string; children: ReactNode }): JSX.Element => (
  <Text>
    <Text color={theme.muted}>{label.padEnd(labelWidth)}</Text>
    {children}
  </Text>
)
