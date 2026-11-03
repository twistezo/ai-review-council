import { afterEach, describe, expect, it } from 'vitest'

import type { JsonLineProcess } from './json-line-process.js'
import { startJsonLineProcess } from './json-line-process.js'

const hasId =
  (id: number) =>
  (message: unknown): boolean =>
    typeof message === 'object' && message !== null && 'id' in message && message.id === id

// Answers each request line with `{ id, echo }`, as a JSON-RPC server would.
const echoServer = `require('node:readline').createInterface({ input: process.stdin }).on('line', (line) => {
  const request = JSON.parse(line);
  console.log(JSON.stringify({ id: request.id, echo: request.params }));
});`

let started: JsonLineProcess[] = []

const start = (script: string, timeoutMs = 5_000): JsonLineProcess => {
  const child = startJsonLineProcess(process.execPath, ['-e', script], { cwd: process.cwd(), timeoutMs })
  started.push(child)

  return child
}

afterEach(() => {
  started.forEach((child) => child.close())
  started = []
})

describe('startJsonLineProcess', () => {
  it('matches each reply to the request waiting for it, whatever the order', async () => {
    const server = start(echoServer)
    const first = server.waitFor(hasId(1))
    const second = server.waitFor(hasId(2))
    server.send({ id: 2, params: 'second' })
    server.send({ id: 1, params: 'first' })

    expect(await first).toEqual({ id: 1, echo: 'first' })
    expect(await second).toEqual({ id: 2, echo: 'second' })
  })

  it('keeps a message that arrives before anyone waits for it', async () => {
    const server = start(`console.log(JSON.stringify({ id: 7, ready: true })); setInterval(() => {}, 1000);`)
    await new Promise((resolve) => setTimeout(resolve, 300))

    expect(await server.waitFor(hasId(7))).toEqual({ id: 7, ready: true })
  })

  it('skips lines that are not JSON', async () => {
    const server = start(
      `console.log('Starting server...'); console.log('{broken'); console.log(JSON.stringify({ id: 1 })); setInterval(() => {}, 1000);`,
    )

    expect(await server.waitFor(() => true)).toEqual({ id: 1 })
  })

  it('fails with the exit code and stderr when the process exits before replying', async () => {
    const server = start(`console.error('not logged in'); process.exit(4);`)

    await expect(server.waitFor(hasId(1))).rejects.toThrow(`${process.execPath} exited with code 4. not logged in`)
  })

  it('fails a later wait too once the process is gone', async () => {
    const server = start(`process.exit(2);`)
    await expect(server.waitFor(hasId(1))).rejects.toThrow('exited with code 2')

    await expect(server.waitFor(hasId(2))).rejects.toThrow('exited with code 2')
  })

  it('reports a missing binary as not found in PATH', async () => {
    const missing = startJsonLineProcess('no-such-json-cli', [], { cwd: process.cwd(), timeoutMs: 5_000 })
    started.push(missing)

    await expect(missing.waitFor(() => true)).rejects.toThrow('no-such-json-cli was not found in PATH')
  })

  it('times out when no reply comes', async () => {
    const server = start(`setInterval(() => {}, 1000);`, 200)

    await expect(server.waitFor(hasId(1))).rejects.toThrow(`${process.execPath} did not respond within 0.2 s`)
  })

  it('still delivers to other waiters after one times out', async () => {
    const server = start(echoServer, 300)
    const unanswered = server.waitFor(hasId(99))
    await expect(unanswered).rejects.toThrow('did not respond')
    const answered = server.waitFor(hasId(1))
    server.send({ id: 1, params: 'late' })

    expect(await answered).toEqual({ id: 1, echo: 'late' })
  })
})
