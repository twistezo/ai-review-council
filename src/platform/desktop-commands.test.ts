import { describe, expect, it } from "vitest"

import { desktopCommandsFor, firstWorking } from "./desktop-commands.js"

const commandNames = (candidates: readonly { command: string }[]): string[] =>
  candidates.map(candidate => candidate.command)

describe("desktopCommandsFor", () => {
  it("uses the built-in macOS tools", () => {
    const commands = desktopCommandsFor({
      platform: "darwin",
      isWayland: false,
    })

    expect(commands.open).toBe("open")
    expect(commandNames(commands.copy)).toEqual(["pbcopy"])
    expect(commandNames(commands.paste)).toEqual(["pbpaste"])
  })

  it("tries the Wayland clipboard first in a Wayland session, then the X11 tools", () => {
    const commands = desktopCommandsFor({ platform: "linux", isWayland: true })

    expect(commands.open).toBe("xdg-open")
    expect(commandNames(commands.copy)).toEqual(["wl-copy", "xclip", "xsel"])
    expect(commandNames(commands.paste)).toEqual(["wl-paste", "xclip", "xsel"])
  })

  it("uses only the X11 clipboard tools in an X11 session", () => {
    const commands = desktopCommandsFor({ platform: "linux", isWayland: false })

    expect(commandNames(commands.copy)).toEqual(["xclip", "xsel"])
    expect(commandNames(commands.paste)).toEqual(["xclip", "xsel"])
  })

  it("pastes only text from Wayland, without an added trailing newline", () => {
    const { paste } = desktopCommandsFor({ platform: "linux", isWayland: true })

    expect(paste[0]).toEqual({
      command: "wl-paste",
      args: ["--type", "text", "--no-newline"],
    })
  })
})

describe("firstWorking", () => {
  const candidates = [
    { command: "first", args: [] },
    { command: "second", args: [] },
  ]

  it("stops at the first candidate that gives a result", async () => {
    const tried: string[] = []
    const result = await firstWorking(candidates, async ({ command }) => {
      tried.push(command)

      return command === "first" ? "from first" : "from second"
    })

    expect(result).toBe("from first")
    expect(tried).toEqual(["first"])
  })

  it("keeps an empty result instead of moving on", async () => {
    expect(await firstWorking(candidates, async () => "")).toBe("")
  })

  it("returns null when no candidate works", async () => {
    expect(await firstWorking(candidates, async () => null)).toBeNull()
  })
})
