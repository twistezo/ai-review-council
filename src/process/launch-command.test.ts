import { describe, expect, it } from "vitest"

import { createLauncher } from "./launch-command.js"

const launch = createLauncher(300)

describe("createLauncher", () => {
  it("succeeds when the opener exits with 0", async () => {
    expect(await launch(process.execPath, ["-e", "process.exit(0)"])).toBe(true)
  })

  it("fails when the opener exits with an error", async () => {
    expect(await launch(process.execPath, ["-e", "process.exit(4)"])).toBe(
      false,
    )
  })

  it("fails when the opener is missing", async () => {
    expect(await launch("ai-review-council-missing-opener", [])).toBe(false)
  })

  it("counts an opener still running after the wait as launched, without waiting for it to end", async () => {
    const started = Date.now()

    expect(
      await launch(process.execPath, ["-e", "setTimeout(() => {}, 2_000)"]),
    ).toBe(true)
    expect(Date.now() - started).toBeLessThan(1_500)
  })
})
