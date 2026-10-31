import { tmpdir } from 'node:os'
import { z } from 'zod'

import type { AppInfo } from '../app-info.js'
import { formatAppTitle } from '../app-info.js'
import type { JsonLineProcess, StartJsonLineProcess } from '../process/json-line-process.js'
import type { RunCommand } from '../process/run-command.js'
import { checkCliStatus } from './check-cli-status.js'
import type { ProviderAdapter, ProviderModel } from './provider-adapter.js'
import { providerDisplayNames } from './provider-adapter.js'

const codexModelSchema = z.object({
  model: z.string().min(1),
  displayName: z.string(),
  hidden: z.boolean(),
  supportedReasoningEfforts: z.array(z.object({ reasoningEffort: z.string().min(1) })),
})

const modelListResultSchema = z.object({
  data: z.array(codexModelSchema),
  nextCursor: z.string().nullable(),
})

const rpcResponseSchema = z.object({
  id: z.number(),
  result: z.unknown().optional(),
  error: z.object({ message: z.string() }).optional(),
})

type CodexModelPage = {
  models: ProviderModel[]
  nextCursor: string | null
}

export const parseCodexModelPage = (result: unknown): CodexModelPage => {
  const page = modelListResultSchema.parse(result)

  return {
    models: page.data
      .filter((model) => !model.hidden)
      .map((model) => ({
        id: model.model,
        label: model.displayName || model.model,
        efforts: model.supportedReasoningEfforts.map((option) => option.reasoningEffort),
      })),
    nextCursor: page.nextCursor,
  }
}

const isResponseTo =
  (id: number) =>
  (message: unknown): boolean =>
    typeof message === 'object' && message !== null && 'id' in message && message.id === id && !('method' in message)

type Requester = (method: string, params: unknown) => Promise<unknown>

const createRequester = (process: JsonLineProcess): Requester => {
  let nextId = 1

  return async (method, params) => {
    const id = nextId
    nextId += 1
    process.send({ id, method, params })
    const response = rpcResponseSchema.parse(await process.waitFor(isResponseTo(id)))
    if (response.error !== undefined) {
      throw new Error(`Codex ${method} failed: ${response.error.message}`)
    }

    return response.result
  }
}

const catalogTimeoutMs = 30_000
const maxCatalogPages = 20

export const createCodexAdapter = (
  run: RunCommand,
  startProcess: StartJsonLineProcess,
  client: AppInfo,
): ProviderAdapter => ({
  id: 'codex',
  displayName: providerDisplayNames.codex,

  checkStatus: () =>
    checkCliStatus(run, {
      provider: 'codex',
      command: 'codex',
      loginStatusArgs: ['login', 'status'],
      installFix: 'Install the Codex CLI and make sure `codex` is on PATH, then run this app again.',
      loginFix: 'Run `codex login` in a terminal, then run this app again.',
    }),

  // Catalog over the local App Server protocol; no prompt is sent to a model.
  listModels: async () => {
    const process = startProcess('codex', ['app-server', '--listen', 'stdio://'], {
      cwd: tmpdir(),
      timeoutMs: catalogTimeoutMs,
    })
    try {
      const request = createRequester(process)
      await request('initialize', {
        clientInfo: { name: client.name, title: formatAppTitle(client), version: client.version },
        capabilities: null,
      })
      process.send({ method: 'initialized' })

      const models: ProviderModel[] = []
      let cursor: string | null = null
      for (let page = 0; page < maxCatalogPages; page += 1) {
        const result = parseCodexModelPage(await request('model/list', { cursor }))
        models.push(...result.models)
        cursor = result.nextCursor
        if (cursor === null) {
          break
        }
      }

      return models
    } finally {
      process.close()
    }
  },
})
