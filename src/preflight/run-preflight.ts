import { isCouncilProvider } from "../domain/review-session.js"
import type { GitRepository } from "../git/git-repository.js"
import type { CatalogModel } from "../providers/model-catalog.js"
import { toCatalogModels } from "../providers/model-catalog.js"
import type {
  ProviderAdapter,
  ProviderStatus,
} from "../providers/provider-adapter.js"

export type CheckState = "ok" | "unavailable" | "failed"

export type PreflightCheck = {
  label: string
  state: CheckState
  detail: string
  fix: string | null
}

export type PreflightResult = {
  checks: PreflightCheck[]
  models: CatalogModel[]
  // null when the configuration can continue
  blocker: string | null
}

export type PreflightDependencies = {
  git: GitRepository
  adapters: readonly ProviderAdapter[]
  findMissingInstructionFiles: () => Promise<string[]>
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const checkGit = async (git: GitRepository): Promise<PreflightCheck> => {
  let version: string | null
  try {
    version = await git.readVersion()
  } catch (error) {
    return {
      label: "Git",
      state: "failed",
      detail: `Could not run \`git --version\`: ${errorMessage(error)}`,
      fix: null,
    }
  }

  return version === null
    ? {
        label: "Git",
        state: "failed",
        detail: "`git` was not found in PATH. Git is required.",
        fix: null,
      }
    : { label: "Git", state: "ok", detail: version, fix: null }
}

const checkInstructions = async (
  findMissing: () => Promise<string[]>,
): Promise<PreflightCheck> => {
  const missing = await findMissing()

  return missing.length === 0
    ? {
        label: "Instructions",
        state: "ok",
        detail: "instructions/council, instructions/reviewer",
        fix: null,
      }
    : {
        label: "Instructions",
        state: "failed",
        detail: `Missing: ${missing.map(file => `instructions/${file}`).join(", ")}`,
        fix: "Reinstall the app or restore the missing files.",
      }
}

type ProviderCheck = {
  check: PreflightCheck
  models: CatalogModel[]
}

// A CLI that cannot even be checked counts as unavailable, like one that reports a problem.
const readStatus = async (
  adapter: ProviderAdapter,
): Promise<ProviderStatus> => {
  try {
    return await adapter.checkStatus()
  } catch (error) {
    return {
      provider: adapter.id,
      version: null,
      problem: `Could not check the CLI: ${errorMessage(error)}`,
      fix: null,
    }
  }
}

// A provider problem is not fatal on its own: one available provider is enough.
const checkProvider = async (
  adapter: ProviderAdapter,
): Promise<ProviderCheck> => {
  const unavailable = (detail: string, fix: string | null): ProviderCheck => ({
    check: { label: adapter.displayName, state: "unavailable", detail, fix },
    models: [],
  })
  const status = await readStatus(adapter)
  if (status.problem !== null) {
    return unavailable(status.problem, status.fix)
  }
  try {
    const models = toCatalogModels(adapter.id, await adapter.listModels())
    if (models.length === 0) {
      return unavailable(
        "The CLI returned no models.",
        "Check your plan and CLI configuration.",
      )
    }
    const modelCount = `${models.length} ${models.length === 1 ? "model" : "models"}`

    return {
      check: {
        label: adapter.displayName,
        state: "ok",
        detail:
          status.version === null || status.version === ""
            ? modelCount
            : `${status.version}, ${modelCount}`,
        fix: null,
      },
      models,
    }
  } catch (error) {
    return unavailable(
      `Could not read the model catalog: ${errorMessage(error)}`,
      "Update the CLI to the latest version.",
    )
  }
}

export const runPreflight = async ({
  git,
  adapters,
  findMissingInstructionFiles,
}: PreflightDependencies): Promise<PreflightResult> => {
  const [gitCheck, instructionsCheck, ...providerChecks] = await Promise.all([
    checkGit(git),
    checkInstructions(findMissingInstructionFiles),
    ...adapters.map(checkProvider),
  ])
  const models = providerChecks.flatMap(result => result.models)
  const blockers = [
    gitCheck.state === "failed" ? "Git is required." : null,
    instructionsCheck.state === "failed"
      ? "Instruction files are missing."
      : null,
    models.some(model => isCouncilProvider(model.provider))
      ? null
      : "At least one of Codex or Claude must be available.",
  ].filter(blocker => blocker !== null)

  return {
    checks: [
      gitCheck,
      ...providerChecks.map(result => result.check),
      instructionsCheck,
    ],
    models,
    blocker: blockers.length === 0 ? null : blockers.join(" "),
  }
}
