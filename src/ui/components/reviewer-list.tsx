import { Box, Text } from 'ink'
import type { JSX } from 'react'

import type { ReviewerAssignment } from '../../domain/review-session.js'
import { formatEffort } from '../../providers/model-catalog.js'
import { providerDisplayNames } from '../../providers/provider-adapter.js'

type ReviewerListProps = {
  reviewers: readonly ReviewerAssignment[]
  dimmed?: boolean
}

const columnSeparator = ' • '

const toCells = ({ configuration, reviewType }: ReviewerAssignment): string[] => [
  providerDisplayNames[configuration.provider],
  configuration.modelLabel,
  formatEffort(configuration.effort),
  reviewType,
]

// Reviewers with provider, model, effort and review type in aligned columns, separated by dots.
export const ReviewerList = ({ reviewers, dimmed = false }: ReviewerListProps): JSX.Element => {
  const rows = reviewers.map(toCells)
  const widths = (rows[0] ?? []).map((_, column) => Math.max(...rows.map((cells) => cells[column]?.length ?? 0)))

  return (
    <Box flexDirection="column">
      {rows.map((cells, index) => (
        <Text key={index} dimColor={dimmed}>
          {cells
            .map((cell, column) => (column === cells.length - 1 ? cell : cell.padEnd(widths[column] ?? 0)))
            .join(columnSeparator)}
        </Text>
      ))}
    </Box>
  )
}
