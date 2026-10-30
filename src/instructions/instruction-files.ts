import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { ReviewType } from '../domain/review-session.js'
import { reviewTypes } from '../domain/review-session.js'

// `docs/` sits next to `src/` and `dist/`, so the same relative path works for both.
export const instructionsDirectory = fileURLToPath(new URL('../../docs/', import.meta.url))

const reviewTypeFile = (reviewType: ReviewType): string => `${reviewType}-review.md`

// Rules shared by every agent come first.
const commonFile = 'common.md'

export const reviewerInstructionFiles = (reviewType: ReviewType): string[] => [
  commonFile,
  'reviewer/reviewer.md',
  `reviewer/${reviewTypeFile(reviewType)}`,
]

// The council gets the variants chosen for the reviewers, each once, in a stable order.
export const councilInstructionFiles = (chosenTypes: readonly ReviewType[]): string[] => [
  commonFile,
  'council/council.md',
  ...reviewTypes
    .filter((reviewType) => chosenTypes.includes(reviewType))
    .map((reviewType) => `council/${reviewTypeFile(reviewType)}`),
]

export const allInstructionFiles = (): string[] => [
  ...new Set([...councilInstructionFiles(reviewTypes), ...reviewTypes.flatMap(reviewerInstructionFiles)]),
]

export const findMissingInstructionFiles = async (directory: string): Promise<string[]> => {
  const checks = await Promise.all(
    allInstructionFiles().map(async (file) => {
      try {
        await access(path.join(directory, file))

        return null
      } catch {
        return file
      }
    }),
  )

  return checks.filter((file) => file !== null)
}

const instructionSeparator = '\n\n---\n\n'

// The files in order, joined into one instruction text for an agent.
export const readInstructions = async (directory: string, files: readonly string[]): Promise<string> => {
  const contents = await Promise.all(files.map((file) => readFile(path.join(directory, file), 'utf8')))

  return contents.map((content) => content.trim()).join(instructionSeparator)
}
