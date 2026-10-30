import { spawn } from 'node:child_process'

export type WriteClipboard = (text: string) => Promise<boolean>

// macOS clipboard through `pbcopy`; false when it could not be written.
export const writeClipboard: WriteClipboard = (text) =>
  new Promise((resolve) => {
    const child = spawn('pbcopy', [], { stdio: ['pipe', 'ignore', 'ignore'] })
    child.on('error', () => resolve(false))
    child.on('close', (exitCode) => resolve(exitCode === 0))
    child.stdin.on('error', () => undefined)
    child.stdin.end(text)
  })
