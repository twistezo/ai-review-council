import { readFile } from "node:fs/promises"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"

import { desktopCommandsFor } from "../platform/desktop-commands.js"
import { fakeLaunchCommand } from "../test-support/fakes.js"
import { createReportOpener } from "./open-report.js"

const macOpen = desktopCommandsFor({
  platform: "darwin",
  isWayland: false,
}).open
const linuxOpen = desktopCommandsFor({
  platform: "linux",
  isWayland: true,
}).open

describe("createReportOpener", () => {
  it("writes the report to a Markdown file and opens it with the default app", async () => {
    const { launch, calls } = fakeLaunchCommand(true)
    const openReport = createReportOpener(launch, macOpen)
    const filePath = await openReport("# Review\n\n### Typo")

    expect(filePath).toMatch(/ai-review-council-report-.+\/review\.md$/)
    expect(calls).toEqual([["open", filePath]])
    expect(await readFile(filePath ?? "", "utf8")).toBe(
      "# Review\n\n### Typo\n",
    )
  })

  it("opens the file with xdg-open on Linux", async () => {
    const { launch, calls } = fakeLaunchCommand(true)
    const filePath = await createReportOpener(launch, linuxOpen)("# Review")

    expect(calls).toEqual([["xdg-open", filePath]])
  })

  it("reports nothing when the file cannot be opened", async () => {
    const openReport = createReportOpener(
      fakeLaunchCommand(false).launch,
      macOpen,
    )

    expect(await openReport("# Review")).toBeNull()
  })

  it("reports nothing and opens nothing when the file cannot be written", async () => {
    const { launch, calls } = fakeLaunchCommand(true)
    const openReport = createReportOpener(launch, macOpen)
    vi.stubEnv("TMPDIR", path.join("/nonexistent", "ai-review-council-test"))
    try {
      expect(await openReport("# Review")).toBeNull()
    } finally {
      vi.unstubAllEnvs()
    }
    expect(calls).toEqual([])
  })
})
