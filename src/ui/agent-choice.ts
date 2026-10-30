import type { AgentConfiguration, ProviderId, ReviewerAssignment } from '../domain/review-session.js'
import { reviewTypes } from '../domain/review-session.js'
import type { CatalogModel } from '../providers/model-catalog.js'
import { defaultEffort, effortOptions, isSameModel, toConfiguration } from '../providers/model-catalog.js'

export type AgentChoice = {
  modelIndex: number
  effort: string | null
}

export const choiceFromConfiguration = (
  models: readonly CatalogModel[],
  configuration: AgentConfiguration | null,
): AgentChoice => {
  const modelIndex = configuration === null ? -1 : models.findIndex((model) => isSameModel(model, configuration))
  if (configuration === null || modelIndex === -1) {
    const firstModel = models[0]

    return { modelIndex: 0, effort: firstModel === undefined ? null : defaultEffort(firstModel) }
  }

  return { modelIndex, effort: configuration.effort }
}

// Keeps the effort when the new model supports it, otherwise falls back to the model default.
export const changeModel = (models: readonly CatalogModel[], choice: AgentChoice, modelIndex: number): AgentChoice => {
  const model = models[modelIndex]
  if (model === undefined) {
    return choice
  }
  const keepsEffort = effortOptions(model).includes(choice.effort)

  return { modelIndex, effort: keepsEffort ? choice.effort : defaultEffort(model) }
}

// Providers in catalog order, each once.
export const catalogProviders = (models: readonly CatalogModel[]): ProviderId[] =>
  models.map((model) => model.provider).filter((provider, index, providers) => providers.indexOf(provider) === index)

// Catalog indexes of one provider's models, so the model column can list only those.
export const providerModelIndexes = (models: readonly CatalogModel[], provider: ProviderId): number[] =>
  models.flatMap((model, index) => (model.provider === provider ? [index] : []))

// Switching provider selects its first model.
export const changeProvider = (models: readonly CatalogModel[], choice: AgentChoice, provider: ProviderId): AgentChoice => {
  if (models[choice.modelIndex]?.provider === provider) {
    return choice
  }
  const [firstIndex] = providerModelIndexes(models, provider)

  return firstIndex === undefined ? choice : changeModel(models, choice, firstIndex)
}

export const choiceToConfiguration = (
  models: readonly CatalogModel[],
  choice: AgentChoice,
): AgentConfiguration | null => {
  const model = models[choice.modelIndex]

  return model === undefined ? null : toConfiguration(model, choice.effort)
}

// Keeps existing reviewers; new ones start from the fallback and cycle through the review types.
export const resizeReviewers = (
  reviewers: readonly ReviewerAssignment[],
  count: number,
  fallback: AgentConfiguration,
): ReviewerAssignment[] =>
  Array.from(
    { length: count },
    (_, index) =>
      reviewers[index] ?? { configuration: fallback, reviewType: reviewTypes[index % reviewTypes.length] ?? 'code' },
  )
