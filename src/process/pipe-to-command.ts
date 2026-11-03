import { spawn } from "node:child_process"

import type { CommandLine } from "../platform/desktop-commands.js"

// true when the command took the text on stdin and exited with 0
export type PipeToCommand = (
  commandLine: CommandLine,
  text: string,
) => Promise<boolean>

// `wl-copy`, `xclip` and `xsel` leave a background process that serves the clipboard; with no output pipes
// the wait ends when the command exits, and its own process group keeps it alive after a Ctrl+C.
export const pipeToCommand: PipeToCommand = ({ command, args }, text) =>
  new Promise(resolve => {
    const child = spawn(command, [...args], {
      stdio: ["pipe", "ignore", "ignore"],
      detached: true,
    })
    child.on("error", () => resolve(false))
    child.on("close", exitCode => resolve(exitCode === 0))
    child.stdin.on("error", () => undefined)
    child.stdin.end(text)
  })
