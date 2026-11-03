import { spawn } from "node:child_process"

// true when the command started the app: it exited with 0 or is still running after a short wait
export type LaunchCommand = (
  command: string,
  args: readonly string[],
) => Promise<boolean>

// No pipes and its own process group: the opened app neither holds the wait nor closes with this app.
// Some `xdg-open` setups wait until the opened app closes, so one still running after `waitMs` counts as launched.
export const createLauncher =
  (waitMs: number): LaunchCommand =>
  (command, args) =>
    new Promise(resolve => {
      const child = spawn(command, [...args], {
        stdio: "ignore",
        detached: true,
      })
      const timer = setTimeout(() => {
        child.unref()
        resolve(true)
      }, waitMs)
      child.on("error", () => {
        clearTimeout(timer)
        resolve(false)
      })
      child.on("exit", exitCode => {
        clearTimeout(timer)
        resolve(exitCode === 0)
      })
    })

export const launchCommand = createLauncher(5_000)
