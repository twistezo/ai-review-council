import type { RunCommand } from '../process/run-command.js'
import { isSuccessful } from '../process/run-command.js'

export type ReadClipboard = () => Promise<string | null>

// macOS clipboard; null when it cannot be read.
export const createClipboardReader =
  (run: RunCommand): ReadClipboard =>
  async () => {
    const result = await run('pbpaste', [])

    return isSuccessful(result) ? result.stdout : null
  }
