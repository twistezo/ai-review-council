import { Box, Text } from 'ink'
import type { JSX } from 'react'
import { useEffect, useState } from 'react'

import type { ReviewScope, ReviewScopeKind } from '../../domain/review-session.js'
import type { GitRepository, RepositoryState } from '../../git/git-repository.js'
import type { ScopeRequest } from '../../scope/build-review-scope.js'
import { buildReviewScope } from '../../scope/build-review-scope.js'
import { SelectList } from '../components/select-list.js'
import { ErrorText, StepFrame } from '../components/step-frame.js'
import { TextInput } from '../components/text-input.js'
import { theme } from '../theme.js'

type ScopeStepProps = {
  git: GitRepository
  repository: RepositoryState
  initialKind: ReviewScopeKind
  // Applied at once (`--scope`); on failure the step stays open with the error.
  preset: ScopeRequest | null
  onSubmit: (scope: ReviewScope) => void
  onPresetFailed: () => void
  onBack?: () => void
}

type ScopeView = 'kind' | 'commit' | 'loading'

const kindLabels: Record<ReviewScopeKind, string> = {
  uncommitted: 'Uncommitted only',
  'since-commit': 'Since commit',
  full: 'Entire codebase',
}

const hints: Record<ScopeView, string> = {
  kind: '↑↓ row · Enter confirm',
  commit: 'Enter confirm',
  loading: 'Reading changes',
}

export const ScopeStep = ({
  git,
  repository,
  initialKind,
  preset,
  onSubmit,
  onPresetFailed,
  onBack,
}: ScopeStepProps): JSX.Element => {
  const [view, setView] = useState<ScopeView>(preset === null ? 'kind' : 'loading')
  const [commitRef, setCommitRef] = useState(preset?.kind === 'since-commit' ? preset.commitRef : '')
  const [error, setError] = useState<string | null>(null)

  const load = async (request: ScopeRequest): Promise<boolean> => {
    const previousView: ScopeView = request.kind === 'since-commit' ? 'commit' : 'kind'
    setView('loading')
    setError(null)
    try {
      const result = await buildReviewScope(git, repository.root, request)
      if (result.ok) {
        onSubmit(result.scope)

        return true
      }
      setError(result.error)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    }
    setView(previousView)

    return false
  }

  useEffect(() => {
    if (preset !== null) {
      void load(preset).then((succeeded) => {
        if (!succeeded) {
          onPresetFailed()
        }
      })
    }
    // Runs once on mount for the `--scope` option.
  }, [])

  const goBack =
    view === 'commit'
      ? (): void => {
          setError(null)
          setView('kind')
        }
      : onBack

  return (
    <StepFrame title="Review scope" hints={hints[view]} onBack={goBack}>
      {view === 'kind' && (
        <SelectList
          items={[
            { key: 'uncommitted', label: kindLabels.uncommitted },
            { key: 'since-commit', label: kindLabels['since-commit'] },
            { key: 'full', label: kindLabels.full },
          ]}
          initialKey={initialKind}
          onSelect={(key) => {
            if (key === 'uncommitted' || key === 'full') {
              void load({ kind: key })
            } else {
              setError(null)
              setView('commit')
            }
          }}
        />
      )}
      {view === 'commit' && (
        <Box flexDirection="column">
          <Text>Changes after this commit, uncommitted included:</Text>
          <TextInput
            value={commitRef}
            onChange={(update) => {
              setCommitRef(update)
              setError(null)
            }}
            onSubmit={() => void load({ kind: 'since-commit', commitRef })}
            placeholder="short or full hash, e.g. a1b2c3d"
          />
        </Box>
      )}
      {view === 'loading' && <Text color={theme.warning}>Reading changes…</Text>}
      <ErrorText message={error} />
    </StepFrame>
  )
}
