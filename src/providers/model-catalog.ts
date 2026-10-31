import type { AgentConfiguration, ProviderId } from '../domain/review-session.js'
import type { ProviderModel } from './provider-adapter.js'
import { providerDisplayNames } from './provider-adapter.js'

export type CatalogModel = ProviderModel & {
  provider: ProviderId
}

export const toCatalogModels = (provider: ProviderId, models: readonly ProviderModel[]): CatalogModel[] =>
  models.map((model) => ({ ...model, provider }))

// A model without declared efforts runs without the effort parameter.
export const effortOptions = (model: CatalogModel): (string | null)[] =>
  model.efforts.length === 0 ? [null] : model.efforts

const preferredEffort = 'medium'

export const defaultEffort = (model: CatalogModel): string | null =>
  model.efforts.includes(preferredEffort) ? preferredEffort : (model.efforts[0] ?? null)

export const toConfiguration = (model: CatalogModel, effort: string | null): AgentConfiguration => ({
  provider: model.provider,
  model: model.id,
  modelLabel: model.label,
  effort,
})

export const isSameModel = (model: CatalogModel, configuration: AgentConfiguration): boolean =>
  model.provider === configuration.provider && model.id === configuration.model

// Display names only; the CLI identifier stays internal.
const formatModel = (model: Pick<CatalogModel, 'provider' | 'label'>): string =>
  `${providerDisplayNames[model.provider]} · ${model.label}`

export const formatEffort = (effort: string | null): string => effort ?? 'default'

export const formatConfiguration = (configuration: AgentConfiguration): string =>
  `${formatModel({ provider: configuration.provider, label: configuration.modelLabel })} · ${formatEffort(configuration.effort)}`

const compareText = (left: string, right: string): number => left.localeCompare(right, 'en', { sensitivity: 'base' })

// Alphabetical by provider, model and effort, as listed in the progress table.
export const compareConfigurations = (left: AgentConfiguration, right: AgentConfiguration): number =>
  compareText(providerDisplayNames[left.provider], providerDisplayNames[right.provider]) ||
  compareText(left.modelLabel, right.modelLabel) ||
  compareText(formatEffort(left.effort), formatEffort(right.effort))
