import { describe, expect, it } from "vitest"

import { desktopCommandsFor } from "../platform/desktop-commands.js"
import { commandResult, fakeRunCommand } from "../test-support/fakes.js"
import { createClipboardReader } from "./read-clipboard.js"

const macPaste = desktopCommandsFor({
  platform: "darwin",
  isWayland: false,
}).paste
const waylandPaste = desktopCommandsFor({
  platform: "linux",
  isWayland: true,
}).paste

describe("createClipboardReader", () => {
  it("returns the clipboard text exactly as pasted", async () => {
    const readClipboard = createClipboardReader(
      fakeRunCommand({ pbpaste: commandResult({ stdout: "  be921eb\n" }) }),
      macPaste,
    )

    expect(await readClipboard()).toBe("  be921eb\n")
  })

  it("returns an empty clipboard as empty text, not as a failure", async () => {
    const readClipboard = createClipboardReader(
      fakeRunCommand({ pbpaste: commandResult() }),
      macPaste,
    )

    expect(await readClipboard()).toBe("")
  })

  it("returns null when pbpaste fails", async () => {
    const readClipboard = createClipboardReader(
      fakeRunCommand({
        pbpaste: commandResult({
          exitCode: 1,
          stderr: "pasteboard unavailable",
        }),
      }),
      macPaste,
    )

    expect(await readClipboard()).toBeNull()
  })

  it("returns null when pbpaste is missing", async () => {
    const readClipboard = createClipboardReader(fakeRunCommand({}), macPaste)

    expect(await readClipboard()).toBeNull()
  })

  it("reads the Wayland clipboard when wl-paste works", async () => {
    const readClipboard = createClipboardReader(
      fakeRunCommand({
        "wl-paste --type text --no-newline": commandResult({
          stdout: "from wayland",
        }),
        "xclip -selection clipboard -o": commandResult({ stdout: "from x11" }),
      }),
      waylandPaste,
    )

    expect(await readClipboard()).toBe("from wayland")
  })

  it("falls back to xclip when wl-paste is not installed", async () => {
    const readClipboard = createClipboardReader(
      fakeRunCommand({
        "xclip -selection clipboard -o": commandResult({ stdout: "from x11" }),
      }),
      waylandPaste,
    )

    expect(await readClipboard()).toBe("from x11")
  })

  it("falls back to xsel when the earlier tools fail", async () => {
    const readClipboard = createClipboardReader(
      fakeRunCommand({
        "wl-paste --type text --no-newline": commandResult({ exitCode: 1 }),
        "xclip -selection clipboard -o": commandResult({ exitCode: 1 }),
        "xsel --clipboard --output": commandResult({ stdout: "from xsel" }),
      }),
      waylandPaste,
    )

    expect(await readClipboard()).toBe("from xsel")
  })

  it("returns null when no Linux clipboard tool is installed", async () => {
    const readClipboard = createClipboardReader(
      fakeRunCommand({}),
      waylandPaste,
    )

    expect(await readClipboard()).toBeNull()
  })
})
