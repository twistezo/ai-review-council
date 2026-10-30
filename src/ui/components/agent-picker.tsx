import type { JSX } from 'react'

import type { ReviewType } from '../../domain/review-session.js'
import { reviewTypes } from '../../domain/review-session.js'
import type { CatalogModel } from '../../providers/model-catalog.js'
import { effortOptions, formatEffort } from '../../providers/model-catalog.js'
import { providerDisplayNames } from '../../providers/provider-adapter.js'
import type { AgentChoice } from '../agent-choice.js'
import { catalogProviders, changeModel, changeProvider, providerModelIndexes } from '../agent-choice.js'
import type { PickerColumn } from './column-picker.js'
import { ColumnPicker } from './column-picker.js'

type AgentPickerProps = {
  models: readonly CatalogModel[]
  choice: AgentChoice
  onChange: (choice: AgentChoice) => void
  // Adds the review type column when present.
  reviewType?: { value: ReviewType; onChange: (reviewType: ReviewType) => void }
  onSubmit: () => void
}

// Columns: provider, model of that provider, effort, and optionally the review type.
export const AgentPicker = ({ models, choice, onChange, reviewType, onSubmit }: AgentPickerProps): JSX.Element => {
  const model = models[choice.modelIndex]
  const providers = catalogProviders(models)
  const modelIndexes = model === undefined ? [] : providerModelIndexes(models, model.provider)
  const efforts = model === undefined ? [] : effortOptions(model)
  const columns: PickerColumn[] = [
    {
      title: 'Provider',
      options: providers.map((provider) => providerDisplayNames[provider]),
      selected: model === undefined ? 0 : providers.indexOf(model.provider),
    },
    {
      title: 'Model',
      options: modelIndexes.map((index) => models[index]?.label ?? ''),
      selected: Math.max(0, modelIndexes.indexOf(choice.modelIndex)),
    },
    { title: 'Effort', options: efforts.map(formatEffort), selected: Math.max(0, efforts.indexOf(choice.effort)) },
  ]
  if (reviewType !== undefined) {
    columns.push({ title: 'Review', options: reviewTypes, selected: reviewTypes.indexOf(reviewType.value) })
  }

  const changeColumn = (column: number, option: number): void => {
    const provider = providers[option]
    const modelIndex = modelIndexes[option]
    if (column === 0 && provider !== undefined) {
      onChange(changeProvider(models, choice, provider))
    } else if (column === 1 && modelIndex !== undefined) {
      onChange(changeModel(models, choice, modelIndex))
    } else if (column === 2) {
      onChange({ ...choice, effort: efforts[option] ?? null })
    } else if (column === 3 && reviewType !== undefined) {
      reviewType.onChange(reviewTypes[option] ?? reviewType.value)
    }
  }

  return <ColumnPicker columns={columns} onSubmit={onSubmit} onChange={changeColumn} />
}
