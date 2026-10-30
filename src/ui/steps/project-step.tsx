import { Box, Text } from 'ink'
import type { JSX } from 'react'
import { useEffect, useState } from 'react'

import type { GitRepository, RepositoryState } from '../../git/git-repository.js'
import { completeDirectory, isDirectory, resolveInputPath } from '../../paths/directory-path.js'
import { ErrorText, StepFrame } from '../components/step-frame.js'
import { TextInput } from '../components/text-input.js'
import { theme } from '../theme.js'

type ProjectStepProps = {
  git: GitRepository
  initialPath: string
  // Submits the initial path at once (`--dir`); on failure the form stays open with the error.
  autoSubmit: boolean
  cwd: string
  homeDirectory: string
  onSubmit: (path: string, repository: RepositoryState) => void
  onAutoSubmitFailed: () => void
  onBack?: () => void
}

type ResolveResult = { ok: true; repository: RepositoryState } | { ok: false; error: string }

const maxCandidates = 8

const resolveRepository = async (git: GitRepository, directory: string): Promise<ResolveResult> => {
  if (!(await isDirectory(directory))) {
    return { ok: false, error: `Not a directory: ${directory}` }
  }
  const root = await git.resolveRoot(directory)
  if (root === null) {
    return { ok: false, error: `Not inside a Git repository: ${directory}` }
  }
  const repository = await git.readState(root)
  if (repository.head === null) {
    return { ok: false, error: 'The repository has no commits, so there is nothing to compare against.' }
  }

  return { ok: true, repository }
}

export const ProjectStep = ({
  git,
  initialPath,
  autoSubmit,
  cwd,
  homeDirectory,
  onSubmit,
  onAutoSubmitFailed,
  onBack,
}: ProjectStepProps): JSX.Element => {
  const [value, setValue] = useState(initialPath)
  const [candidates, setCandidates] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(autoSubmit)

  const submit = async (path: string): Promise<boolean> => {
    setIsChecking(true)
    setCandidates([])
    const result = await resolveRepository(git, resolveInputPath(path, cwd, homeDirectory))
    setIsChecking(false)
    if (!result.ok) {
      setError(result.error)

      return false
    }
    onSubmit(path, result.repository)

    return true
  }

  useEffect(() => {
    if (autoSubmit) {
      void submit(initialPath).then((succeeded) => {
        if (!succeeded) {
          onAutoSubmitFailed()
        }
      })
    }
    // Runs once on mount for the `--dir` option.
  }, [])

  const complete = async (): Promise<void> => {
    const completion = await completeDirectory(value, cwd, homeDirectory)
    setValue(completion.value)
    setCandidates(completion.candidates)
  }

  return (
    <StepFrame title="Project folder" hints="Tab complete · Enter confirm" onBack={onBack}>
      <TextInput
        value={value}
        onChange={(update) => {
          setValue(update)
          setError(null)
        }}
        onSubmit={() => void submit(value)}
        onTab={() => void complete()}
        placeholder="Path to a Git repository or one of its folders"
        isActive={!isChecking}
      />
      {candidates.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {candidates.slice(0, maxCandidates).map((candidate) => (
            <Text key={candidate} dimColor>
              {candidate}/
            </Text>
          ))}
          {candidates.length > maxCandidates && <Text dimColor>…and {candidates.length - maxCandidates} more</Text>}
        </Box>
      )}
      {isChecking && <Text color={theme.warning}>Checking repository…</Text>}
      <ErrorText message={error} />
    </StepFrame>
  )
}
