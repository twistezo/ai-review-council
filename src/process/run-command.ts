import { spawn } from 'node:child_process'

export type CommandFailure = 'not-found' | 'timeout' | 'spawn-error'

export type CommandResult = {
  exitCode: number | null
  stdout: string
  stderr: string
  failure: CommandFailure | null
}

export type RunCommandOptions = {
  cwd?: string
  timeoutMs?: number
}

export type RunCommand = (
  command: string,
  args: readonly string[],
  options?: RunCommandOptions,
) => Promise<CommandResult>

const defaultTimeoutMs = 15_000

// Arguments are passed as an array, never through a shell.
export const runCommand: RunCommand = (command, args, options = {}) =>
  new Promise((resolve) => {
    const child = spawn(command, [...args], { cwd: options.cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let failure: CommandFailure | null = null

    const timer = setTimeout(() => {
      failure = 'timeout'
      child.kill('SIGTERM')
    }, options.timeoutMs ?? defaultTimeoutMs)

    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      stderr += chunk
    })
    child.on('error', (error: NodeJS.ErrnoException) => {
      clearTimeout(timer)
      resolve({
        exitCode: null,
        stdout,
        stderr: error.message,
        failure: error.code === 'ENOENT' ? 'not-found' : 'spawn-error',
      })
    })
    child.on('close', (exitCode) => {
      clearTimeout(timer)
      resolve({ exitCode, stdout, stderr, failure })
    })
  })

export const isSuccessful = (result: CommandResult): boolean =>
  result.failure === null && result.exitCode === 0
