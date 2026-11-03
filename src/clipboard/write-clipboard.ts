import type { CommandLine } from "../platform/desktop-commands.js"
import { firstWorking } from "../platform/desktop-commands.js"
import type { PipeToCommand } from "../process/pipe-to-command.js"

export type WriteClipboard = (text: string) => Promise<boolean>

// The first copy tool that works; false when none could write the clipboard.
export const createClipboardWriter =
  (pipe: PipeToCommand, candidates: readonly CommandLine[]): WriteClipboard =>
  async text =>
    (await firstWorking(candidates, async candidate =>
      (await pipe(candidate, text)) ? true : null,
    )) ?? false
