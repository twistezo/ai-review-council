export const wizardSteps = ['preflight', 'language', 'project', 'scope', 'council', 'reviewers', 'prompt', 'summary'] as const
export type WizardStep = (typeof wizardSteps)[number]

// Steps the user sees in the step counter: no requirements check, no steps answered by CLI options.
export const numberedSteps = (skipped: readonly WizardStep[]): WizardStep[] =>
  wizardSteps.filter((step) => step !== 'preflight' && !skipped.includes(step))

// A preset folder or scope still has to be resolved, so these steps run forward and submit themselves.
const runsWhenSkipped: readonly WizardStep[] = ['project', 'scope']

export const nextStep = (step: WizardStep, skipped: readonly WizardStep[]): WizardStep => {
  const index = wizardSteps.indexOf(step)
  const isSkipped = (candidate: WizardStep): boolean =>
    skipped.includes(candidate) && !runsWhenSkipped.includes(candidate)

  return wizardSteps.slice(index + 1).find((candidate) => !isSkipped(candidate)) ?? 'summary'
}

// null when there is nothing to go back to; the requirements check is never revisited.
export const previousStep = (step: WizardStep, skipped: readonly WizardStep[]): WizardStep | null => {
  const index = wizardSteps.indexOf(step)
  const earlier = wizardSteps.slice(1, Math.max(index, 1)).filter((candidate) => !skipped.includes(candidate))

  return earlier.at(-1) ?? null
}
