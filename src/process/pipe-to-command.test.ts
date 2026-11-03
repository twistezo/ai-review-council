import { describe, expect, it } from "vitest"

import type { CommandLine } from "../platform/desktop-commands.js"
import { pipeToCommand } from "./pipe-to-command.js"

const nodeScript = (script: string): CommandLine => ({
  command: process.execPath,
  args: ["-e", script],
})

describe("pipeToCommand", () => {
  it("succeeds when the command reads the text and exits with 0", async () => {
    const readsAll = nodeScript(
      "process.stdin.resume(); process.stdin.on('end', () => process.exit(0))",
    )

    expect(await pipeToCommand(readsAll, "# Review")).toBe(true)
  })

  it("fails when the command exits with an error", async () => {
    expect(await pipeToCommand(nodeScript("process.exit(1)"), "# Review")).toBe(
      false,
    )
  })

  it("fails when the command is missing", async () => {
    expect(
      await pipeToCommand(
        { command: "ai-review-council-missing-copy", args: [] },
        "# Review",
      ),
    ).toBe(false)
  })
})
