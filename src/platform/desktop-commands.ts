export type CommandLine = {
  command: string
  args: readonly string[]
}

// The tools behind copy, paste and open; copy and paste try each candidate in order.
type DesktopCommands = {
  // takes the file path as its only argument
  open: string
  copy: readonly CommandLine[]
  paste: readonly CommandLine[]
}

type DesktopSession = {
  platform: NodeJS.Platform
  isWayland: boolean
}

const macCommands: DesktopCommands = {
  open: "open",
  copy: [{ command: "pbcopy", args: [] }],
  paste: [{ command: "pbpaste", args: [] }],
}

// X11 tools also reach the Wayland clipboard through XWayland, so they back up the Wayland ones.
const x11Copy: CommandLine[] = [
  { command: "xclip", args: ["-selection", "clipboard"] },
  { command: "xsel", args: ["--clipboard", "--input"] },
]
const x11Paste: CommandLine[] = [
  { command: "xclip", args: ["-selection", "clipboard", "-o"] },
  { command: "xsel", args: ["--clipboard", "--output"] },
]
const waylandCopy: CommandLine = { command: "wl-copy", args: [] }
// Text only, so an image on the clipboard is not pasted as binary; `wl-paste` adds a newline unless told not to.
const waylandPaste: CommandLine = {
  command: "wl-paste",
  args: ["--type", "text", "--no-newline"],
}

// macOS and desktop Linux (Wayland or X11); WSL and sessions without a display are not supported.
export const desktopCommandsFor = ({
  platform,
  isWayland,
}: DesktopSession): DesktopCommands => {
  if (platform === "darwin") {
    return macCommands
  }

  return {
    open: "xdg-open",
    copy: isWayland ? [waylandCopy, ...x11Copy] : x11Copy,
    paste: isWayland ? [waylandPaste, ...x11Paste] : x11Paste,
  }
}

// `WAYLAND_DISPLAY` is set inside a Wayland session, also where `XDG_SESSION_TYPE` is missing.
export const currentDesktopSession = (): DesktopSession => ({
  platform: process.platform,
  isWayland: (process.env.WAYLAND_DISPLAY ?? "") !== "",
})

// The result of the first candidate that works; null when none does.
export const firstWorking = async <Result>(
  candidates: readonly CommandLine[],
  attempt: (candidate: CommandLine) => Promise<Result | null>,
): Promise<Result | null> => {
  for (const candidate of candidates) {
    const result = await attempt(candidate)
    if (result !== null) {
      return result
    }
  }

  return null
}
