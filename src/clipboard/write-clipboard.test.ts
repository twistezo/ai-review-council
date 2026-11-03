import { describe, expect, it } from "vitest"

import { desktopCommandsFor } from "../platform/desktop-commands.js"
import { fakePipeToCommand } from "../test-support/fakes.js"
import { createClipboardWriter } from "./write-clipboard.js"

const macCopy = desktopCommandsFor({
  platform: "darwin",
  isWayland: false,
}).copy
const waylandCopy = desktopCommandsFor({
  platform: "linux",
  isWayland: true,
}).copy

describe("createClipboardWriter", () => {
  it("copies with pbcopy on macOS", async () => {
    const { pipe, calls } = fakePipeToCommand(["pbcopy"])

    expect(await createClipboardWriter(pipe, macCopy)("# Review")).toBe(true)
    expect(calls).toEqual([["pbcopy", "# Review"]])
  })

  it("copies with the first tool that works and tries no others", async () => {
    const { pipe, calls } = fakePipeToCommand(["wl-copy", "xclip"])

    expect(await createClipboardWriter(pipe, waylandCopy)("# Review")).toBe(
      true,
    )
    expect(calls).toEqual([["wl-copy", "# Review"]])
  })

  it("falls back to the X11 tools when wl-copy fails", async () => {
    const { pipe, calls } = fakePipeToCommand(["xsel"])

    expect(await createClipboardWriter(pipe, waylandCopy)("# Review")).toBe(
      true,
    )
    expect(calls).toEqual([
      ["wl-copy", "# Review"],
      ["xclip", "-selection", "clipboard", "# Review"],
      ["xsel", "--clipboard", "--input", "# Review"],
    ])
  })

  it("reports a failure when no tool can copy", async () => {
    const { pipe } = fakePipeToCommand([])

    expect(await createClipboardWriter(pipe, waylandCopy)("# Review")).toBe(
      false,
    )
  })
})
