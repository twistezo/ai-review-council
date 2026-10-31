import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import type { RunCommand } from '../process/run-command.js'
import { isSuccessful } from '../process/run-command.js'

// the file's path once it opened; null when it could not be written or opened
export type OpenReport = (report: string) => Promise<string | null>

// Writes the report to a temporary Markdown file and opens it in the macOS default app for `.md`.
// The file outlives the app, so the viewer keeps it after the review ends.
export const createReportOpener =
  (run: RunCommand): OpenReport =>
  async (report) => {
    try {
      const directory = await mkdtemp(path.join(tmpdir(), 'ai-review-council-report-'))
      const filePath = path.join(directory, 'review.md')
      await writeFile(filePath, `${report}\n`)

      return isSuccessful(await run('open', [filePath])) ? filePath : null
    } catch {
      return null
    }
  }
