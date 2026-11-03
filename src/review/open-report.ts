import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import type { LaunchCommand } from "../process/launch-command.js"

// the file's path once it opened; null when it could not be written or opened
export type OpenReport = (report: string) => Promise<string | null>

// Writes the report to a temporary Markdown file and opens it in the default app for `.md`.
// The file outlives the app, so the viewer keeps it after the review ends.
export const createReportOpener =
  (launch: LaunchCommand, openCommand: string): OpenReport =>
  async report => {
    try {
      const directory = await mkdtemp(
        path.join(tmpdir(), "ai-review-council-report-"),
      )
      const filePath = path.join(directory, "review.md")
      await writeFile(filePath, `${report}\n`)

      return (await launch(openCommand, [filePath])) ? filePath : null
    } catch {
      return null
    }
  }
