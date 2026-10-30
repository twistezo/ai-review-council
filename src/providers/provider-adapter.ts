import type { ProviderId } from '../domain/review-session.js'

export type ProviderStatus = {
  provider: ProviderId
  version: string | null
  problem: string | null
  fix: string | null
}

export type ProviderModel = {
  id: string
  label: string
  // empty when the provider declares no effort levels for the model
  efforts: string[]
}

// Stage 1 covers detection and the model catalog. Execution, cancel and resume come later.
export type ProviderAdapter = {
  id: ProviderId
  displayName: string
  checkStatus: () => Promise<ProviderStatus>
  listModels: () => Promise<ProviderModel[]>
}

export const providerDisplayNames: Record<ProviderId, string> = {
  codex: 'Codex',
  claude: 'Claude Code',
}
