import type { CommandLine } from "../platform/desktop-commands.js"
import { firstWorking } from "../platform/desktop-commands.js"
import type { RunCommand } from "../process/run-command.js"
import { isSuccessful } from "../process/run-command.js"

export type ReadClipboard = () => Promise<string | null>

// The first paste tool that works; null when none can read the clipboard.
export const createClipboardReader =
  (run: RunCommand, candidates: readonly CommandLine[]): ReadClipboard =>
  () =>
    firstWorking(candidates, async ({ command, args }) => {
      const result = await run(command, args)

      return isSuccessful(result) ? result.stdout : null
    })
