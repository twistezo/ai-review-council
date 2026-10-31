import { Box, Text, useApp, useWindowSize } from 'ink'
import type { JSX } from 'react'
import { useState } from 'react'

import type {
  AgentConfiguration,
  ReportLanguage,
  ReviewerAssignment,
  ReviewScope,
  ReviewSessionDraft,
} from '../domain/review-session.js'
import { reviewSessionDraftSchema } from '../domain/review-session.js'
import type { ReadClipboard } from '../clipboard/read-clipboard.js'
import type { WriteClipboard } from '../clipboard/write-clipboard.js'
import type { GitRepository, RepositoryState } from '../git/git-repository.js'
import type { PreflightCheck } from '../preflight/run-preflight.js'
import type { CatalogModel } from '../providers/model-catalog.js'
import type { ProviderAdapter } from '../providers/provider-adapter.js'
import type { OpenReport } from '../review/open-report.js'
import type { ReviewRunDependencies } from '../review/run-review.js'
import type { ScopeRequest } from '../scope/build-review-scope.js'
import type { AnswerField, WizardAnswers } from './components/answers-panel.js'
import { AnswersPanel } from './components/answers-panel.js'
import { StepAnswersContext, StepCounterContext } from './components/step-frame.js'
import { CouncilStep } from './steps/council-step.js'
import { LanguageStep } from './steps/language-step.js'
import { PreflightStep, RequirementsLine } from './steps/preflight-step.js'
import { ProjectStep } from './steps/project-step.js'
import { PromptStep } from './steps/prompt-step.js'
import { ReviewersStep } from './steps/reviewers-step.js'
import type { RunOutcome } from './steps/run-screen.js'
import { RunScreen } from './steps/run-screen.js'
import { ScopeStep } from './steps/scope-step.js'
import { SummaryStep } from './steps/summary-step.js'
import type { WizardStep } from './wizard-steps.js'
import { nextStep, numberedSteps, previousStep, wizardSteps } from './wizard-steps.js'
import { theme } from './theme.js'

export type AppServices = {
  git: GitRepository
  adapters: readonly ProviderAdapter[]
  findMissingInstructionFiles: () => Promise<string[]>
  readClipboard: ReadClipboard
  writeClipboard: WriteClipboard
  openReport: OpenReport
  review: ReviewRunDependencies
  cwd: string
  homeDirectory: string
}

// Values given as CLI options; each one skips its step.
export type AppPresets = {
  language: ReportLanguage | null
  directory: string | null
  scope: ScopeRequest | null
  reviewerCount: number | null
}

export type WizardOutcome = RunOutcome | { kind: 'cancelled' } | { kind: 'blocked' }

type AppProps = {
  // shown in the header, e.g. `ai-review-council v0.7.0`
  title: string
  services: AppServices
  presets: AppPresets
  timeoutMinutes: number
  // how the wizard ended; with a report on screen it comes before the app exits, so Ctrl+C there keeps it
  onFinish: (outcome: WizardOutcome) => void
}

type WizardState = {
  step: WizardStep
  // true when the current step was reached with Esc from a later one
  isGoingBack: boolean
  skipped: WizardStep[]
  checks: PreflightCheck[]
  models: CatalogModel[]
  language: ReportLanguage
  projectPath: string
  repository: RepositoryState | null
  scope: ReviewScope | null
  council: AgentConfiguration | null
  reviewers: ReviewerAssignment[]
  prompt: string
  // set once the review starts; the wizard is done then
  running: ReviewSessionDraft | null
}

const buildSessionDraft = (state: WizardState, timeoutMinutes: number): ReviewSessionDraft | null => {
  if (state.repository === null) {
    return null
  }
  const result = reviewSessionDraftSchema.safeParse({
    language: state.language,
    repository: {
      root: state.repository.root,
      branch: state.repository.branch,
      hasChanges: state.repository.hasChanges,
    },
    scope: state.scope,
    council: state.council,
    reviewers: state.reviewers,
    prompt: state.prompt,
    timeoutMinutes,
  })

  return result.success ? result.data : null
}

// paddingX on both sides of the screen
const screenPadding = 2
// a short rule under the header, narrower on small windows
const separatorWidth = 40

// The answer each wizard step sets, shown with `← selecting` while that step is open.
const stepFields: Partial<Record<WizardStep, AnswerField>> = {
  language: 'language',
  project: 'project',
  scope: 'scope',
  council: 'council',
  reviewers: 'reviewers',
  prompt: 'prompt',
}

// Only answers of steps before the current one; going back hides the later ones.
const answersBefore = (state: WizardState): WizardAnswers => {
  const isBefore = (step: WizardStep): boolean => wizardSteps.indexOf(step) < wizardSteps.indexOf(state.step)

  return {
    language: isBefore('language') ? state.language : null,
    repository: isBefore('project') ? state.repository : null,
    scope: isBefore('scope') ? state.scope : null,
    council: isBefore('council') ? state.council : null,
    reviewers: isBefore('reviewers') ? state.reviewers : null,
    prompt: isBefore('prompt') ? state.prompt : null,
  }
}

const presetSkips = (presets: AppPresets): WizardStep[] => [
  ...(presets.language === null ? [] : (['language'] as const)),
  ...(presets.directory === null ? [] : (['project'] as const)),
  ...(presets.scope === null ? [] : (['scope'] as const)),
]

export const App = ({ title, services, presets, timeoutMinutes, onFinish }: AppProps): JSX.Element => {
  const { exit } = useApp()
  const [state, setState] = useState<WizardState>({
    step: 'preflight',
    isGoingBack: false,
    skipped: presetSkips(presets),
    checks: [],
    models: [],
    language: presets.language ?? 'en',
    projectPath: presets.directory ?? services.cwd,
    repository: null,
    scope: null,
    council: null,
    reviewers: [],
    prompt: '',
    running: null,
  })

  const finish = (outcome: WizardOutcome): void => {
    onFinish(outcome)
    exit()
  }
  const complete = (patch: Partial<WizardState>): void => {
    setState((previous) => ({
      ...previous,
      ...patch,
      step: nextStep(previous.step, previous.skipped),
      isGoingBack: false,
    }))
  }
  const previous = previousStep(state.step, state.skipped)
  const back =
    previous === null
      ? undefined
      : (): void => setState((current) => ({ ...current, step: previous, isGoingBack: true }))
  // A preset step that was skipped is shown when its value turned out invalid.
  const isAutoSubmit = state.step === 'project' && state.skipped.includes('project')

  const renderStep = (): JSX.Element => {
    switch (state.step) {
      case 'preflight':
        return (
          <PreflightStep
            dependencies={services}
            onPassed={({ checks, models }) => complete({ checks, models })}
            onBlocked={() => finish({ kind: 'blocked' })}
          />
        )
      case 'language':
        return <LanguageStep value={state.language} onSubmit={(language) => complete({ language })} onBack={back} />
      case 'project':
        return (
          <ProjectStep
            git={services.git}
            initialPath={state.projectPath}
            autoSubmit={isAutoSubmit}
            cwd={services.cwd}
            homeDirectory={services.homeDirectory}
            onSubmit={(projectPath, repository) =>
              complete({ projectPath, repository, scope: repository.root === state.repository?.root ? state.scope : null })
            }
            onAutoSubmitFailed={() =>
              setState((current) => ({ ...current, skipped: current.skipped.filter((step) => step !== 'project') }))
            }
            onBack={isAutoSubmit ? undefined : back}
          />
        )
      case 'scope':
        return state.repository === null ? (
          <Text color={theme.failure}>No repository selected.</Text>
        ) : (
          <ScopeStep
            git={services.git}
            repository={state.repository}
            initialKind={state.scope?.kind ?? presets.scope?.kind ?? 'uncommitted'}
            preset={state.skipped.includes('scope') ? presets.scope : null}
            onSubmit={(scope) => complete({ scope })}
            onPresetFailed={() =>
              setState((current) => ({ ...current, skipped: current.skipped.filter((step) => step !== 'scope') }))
            }
            onBack={state.skipped.includes('scope') ? undefined : back}
          />
        )
      case 'council':
        return (
          <CouncilStep
            models={state.models}
            value={state.council}
            onSubmit={(council) => complete({ council })}
            onBack={back}
          />
        )
      case 'reviewers':
        return (
          <ReviewersStep
            models={state.models}
            value={state.reviewers}
            resumeAtLast={state.isGoingBack}
            presetCount={presets.reviewerCount}
            onSubmit={(reviewers) => complete({ reviewers })}
            onBack={back}
          />
        )
      case 'prompt':
        return (
          <PromptStep
            value={state.prompt}
            readClipboard={services.readClipboard}
            onSubmit={(prompt) => complete({ prompt })}
            onBack={back}
          />
        )
      case 'summary': {
        const session = buildSessionDraft(state, timeoutMinutes)

        return session === null ? (
          <Text color={theme.failure}>The configuration is incomplete. Press Ctrl+C and start again.</Text>
        ) : (
          <SummaryStep
            session={session}
            onAction={(action) => {
              if (action === 'back') {
                back?.()
              } else if (action === 'start') {
                setState((current) => ({ ...current, running: session }))
              } else {
                finish({ kind: 'cancelled' })
              }
            }}
          />
        )
      }
    }
  }

  const { columns } = useWindowSize()
  const steps = numberedSteps(state.skipped)
  const stepNumber = state.running === null ? steps.indexOf(state.step) + 1 : 0

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold color={theme.title}>
        {title}
      </Text>
      {state.checks.length > 0 && (
        <Box marginTop={1}>
          <RequirementsLine checks={state.checks} />
        </Box>
      )}
      <Text dimColor>{'─'.repeat(Math.max(1, Math.min(separatorWidth, columns - screenPadding)))}</Text>
      <Box marginTop={1}>
        {state.running === null ? (
          <StepCounterContext.Provider value={stepNumber > 0 ? `step ${stepNumber} of ${steps.length}` : null}>
            <StepAnswersContext.Provider
              value={
                stepFields[state.step] === undefined ? null : (
                  <AnswersPanel answers={answersBefore(state)} selecting={stepFields[state.step] ?? null} />
                )
              }
            >
              {renderStep()}
            </StepAnswersContext.Provider>
          </StepCounterContext.Provider>
        ) : (
          <RunScreen
            session={state.running}
            dependencies={services.review}
            writeClipboard={services.writeClipboard}
            openReport={services.openReport}
            onFinished={finish}
            onReported={onFinish}
            onQuit={exit}
          />
        )}
      </Box>
    </Box>
  )
}
