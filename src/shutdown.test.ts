import { stat } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

import { runAgentProcess } from './execution/run-agent-process.js'
import { createWorkspacePreparer } from './review/review-workspace.js'
import { cleanUpAfterCancel, describeCleanup } from './shutdown.js'
import { fakeGitRepository, headCommit } from './test-support/fakes.js'

describe('describeCleanup', () => {
  it('says nothing when nothing was running', () => {
    expect(describeCleanup({ agents: 0, workspaces: 0 })).toBeNull()
  })

  it('confirms the cleanup once anything was running', () => {
    expect(describeCleanup({ agents: 3, workspaces: 1 })).toBe('✔ Review cancelled. Everything cleaned up gracefully.')
    expect(describeCleanup({ agents: 0, workspaces: 1 })).toBe('✔ Review cancelled. Everything cleaned up gracefully.')
  })
})

describe('cleanUpAfterCancel', () => {
  it('waits for cancelled agents to stop and removes the temporary folder', async () => {
    const workspace = await createWorkspacePreparer(fakeGitRepository())('/repo', {
      kind: 'uncommitted',
      base: headCommit,
      diffBase: headCommit.hash,
      changedFiles: [{ path: 'src/cart.ts', previousPath: null, change: 'modified' }],
      excludedFiles: [],
    })
    const controller = new AbortController()
    const run = runAgentProcess(
      { command: process.execPath, args: ['-e', 'setInterval(() => {}, 1000)'], cwd: process.cwd(), stdin: '' },
      () => [],
      { timeoutMs: 60_000, signal: controller.signal },
    )
    controller.abort()

    expect(await cleanUpAfterCancel()).toEqual({ agents: 1, workspaces: 1 })
    expect(await run).toMatchObject({ ok: false, error: 'Cancelled' })
    await expect(stat(workspace.directory)).rejects.toThrow()
    // reported once
    expect(await cleanUpAfterCancel()).toEqual({ agents: 0, workspaces: 0 })
  })
})
