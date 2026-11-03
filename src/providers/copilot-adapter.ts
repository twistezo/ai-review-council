import { copilotModelId } from "../domain/review-session.js"
import type { RunCommand } from "../process/run-command.js"
import { checkCliStatus } from "./check-cli-status.js"
import type { ProviderAdapter } from "./provider-adapter.js"
import { providerDisplayNames } from "./provider-adapter.js"

type CopilotAdapter = ProviderAdapter & {
  command: () => "copilot" | "gh"
}

export const createCopilotAdapter = (run: RunCommand): CopilotAdapter => {
  let command: "copilot" | "gh" = "copilot"

  return {
    id: "copilot",
    displayName: providerDisplayNames.copilot,
    command: () => command,
    checkStatus: async () => {
      const direct = await run("copilot", ["--version"])
      // A broken installed CLI is reported, not silently replaced by another runtime.
      command = direct.failure === "not-found" ? "gh" : "copilot"
      const versionArgs =
        command === "gh" ? ["copilot", "--", "--version"] : ["--version"]
      const result = command === "gh" ? await run(command, versionArgs) : direct

      return checkCliStatus(async () => result, {
        provider: "copilot",
        command,
        versionArgs,
        loginStatusArgs: null,
        installFix:
          "Install Copilot CLI or GitHub CLI with `gh copilot` support, then run this app again.",
      })
    },
    // Free can use Auto even when the named-model catalog is empty.
    listModels: async () => [
      { id: copilotModelId, label: "Auto", efforts: [] },
    ],
  }
}
