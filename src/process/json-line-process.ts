import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

export type JsonLineProcess = {
  send: (message: unknown) => void
  waitFor: (predicate: (message: unknown) => boolean) => Promise<unknown>
  close: () => void
}

export type StartJsonLineProcess = (
  command: string,
  args: readonly string[],
  options: { cwd: string; timeoutMs: number },
) => JsonLineProcess

type Waiter = {
  predicate: (message: unknown) => boolean
  resolve: (message: unknown) => void
  reject: (error: Error) => void
}

const stderrTailLength = 2_000

// Long-lived process speaking newline-delimited JSON on stdin/stdout.
export const startJsonLineProcess: StartJsonLineProcess = (command, args, { cwd, timeoutMs }) => {
  const child = spawn(command, [...args], { cwd, stdio: ['pipe', 'pipe', 'pipe'] })
  const unclaimed: unknown[] = []
  let waiters: Waiter[] = []
  let failure: Error | null = null
  let stderrTail = ''

  const fail = (error: Error): void => {
    failure ??= error
    waiters.forEach((waiter) => waiter.reject(error))
    waiters = []
  }

  child.stdin.on('error', () => undefined)
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
    stderrTail = (stderrTail + chunk).slice(-stderrTailLength)
  })
  child.on('error', (error: NodeJS.ErrnoException) => {
    fail(new Error(error.code === 'ENOENT' ? `${command} was not found in PATH` : error.message))
  })
  child.on('close', (exitCode) => {
    fail(new Error(`${command} exited with code ${exitCode}. ${stderrTail.trim()}`.trim()))
  })

  createInterface({ input: child.stdout }).on('line', (line) => {
    let message: unknown
    try {
      message = JSON.parse(line)
    } catch {
      return
    }
    const waiter = waiters.find((candidate) => candidate.predicate(message))
    if (waiter === undefined) {
      unclaimed.push(message)

      return
    }
    waiters = waiters.filter((candidate) => candidate !== waiter)
    waiter.resolve(message)
  })

  const waitFor = (predicate: (message: unknown) => boolean): Promise<unknown> => {
    const bufferedIndex = unclaimed.findIndex(predicate)
    if (bufferedIndex !== -1) {
      return Promise.resolve(unclaimed.splice(bufferedIndex, 1)[0])
    }
    if (failure !== null) {
      return Promise.reject(failure)
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        waiters = waiters.filter((candidate) => candidate !== waiter)
        reject(new Error(`${command} did not respond within ${timeoutMs / 1000} s`))
      }, timeoutMs)
      const waiter: Waiter = {
        predicate,
        resolve: (message) => {
          clearTimeout(timer)
          resolve(message)
        },
        reject: (error) => {
          clearTimeout(timer)
          reject(error)
        },
      }
      waiters.push(waiter)
    })
  }

  return {
    send: (message) => {
      child.stdin.write(`${JSON.stringify(message)}\n`)
    },
    waitFor,
    close: () => {
      child.stdin.end()
      child.kill('SIGTERM')
    },
  }
}
