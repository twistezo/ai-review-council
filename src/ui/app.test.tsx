import { tmpdir } from 'node:os'
import { render } from 'ink-testing-library'
import { describe, expect, it } from 'vitest'

import type { AgentLaunch } from '../execution/agent-commands.js'
import type { ReviewRunDependencies } from '../review/run-review.js'
import { fakeAdapter, fakeGitRepository } from '../test-support/fakes.js'
import type { AppPresets, AppServices, WizardOutcome } from './app.js'
import { App } from './app.js'

const keys = {
  enter: '\r',
  ctrlD: '\x04',
  ctrlV: '\x16',
  down: '\x1b[B',
  right: '\x1b[C',
  escape: '\x1b',
} as const

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

// Agents that answer after a short pause, so the run screen renders in between.
const fakeReview = (launches: AgentLaunch[] = []): ReviewRunDependencies => ({
  runAgent: async (launch, options) => {
    launches.push(launch)
    options.onEvent?.({ kind: 'read', target: 'src/checkout.ts' })
    await delay(50)
    const isCouncil = launch.message.startsWith('# Council session')

    return { ok: true, report: isCouncil ? '# Review: VAT missing\n### VAT not added' : '### VAT not added', sessionId: 's' }
  },
  prepareWorkspace: async () => ({ directory: '/tmp/council-test', diffPath: '/tmp/council-test/change.diff', cleanup: async () => undefined }),
  readInstructions: async (files) => files.join(' + '),
  now: Date.now,
})

const frameChangeTimeoutMs = 1_000
const settleMs = 20

// Waits for the frame to change, then lets the new step register its input handlers.
const waitForFrameChange = async (readFrame: () => string, previous: string): Promise<void> => {
  const deadline = Date.now() + frameChangeTimeoutMs
  while (readFrame() === previous && Date.now() < deadline) {
    await delay(5)
  }
  await delay(settleMs)
}

type Session = {
  press: (...inputs: string[]) => Promise<void>
  waitForText: (text: string) => Promise<void>
  frame: () => string
  // every frame rendered so far, including the last one before the app exits
  frames: () => readonly string[]
  outcomes: WizardOutcome[]
}

const startApp = async (
  services: Partial<AppServices> = {},
  presets: AppPresets = { language: null, directory: null, scope: null, reviewerCount: null },
): Promise<Session> => {
  const outcomes: WizardOutcome[] = []
  const { stdin, lastFrame, frames } = render(
    <App
      title="ai-review-council v9.9.9"
      services={{
        git: fakeGitRepository(),
        adapters: [fakeAdapter('codex'), fakeAdapter('claude')],
        findMissingInstructionFiles: async () => [],
        readClipboard: async () => 'Pasted line 1\r\nPasted line 2',
        review: fakeReview(),
        cwd: tmpdir(),
        homeDirectory: tmpdir(),
        ...services,
      }}
      presets={presets}
      timeoutMinutes={10}
      onFinish={(outcome) => outcomes.push(outcome)}
    />,
  )
  const frame = (): string => lastFrame() ?? ''
  const waitForText = async (text: string): Promise<void> => {
    const deadline = Date.now() + frameChangeTimeoutMs
    while (!frame().includes(text) && Date.now() < deadline) {
      await delay(5)
    }
    await delay(settleMs)
  }
  // The requirements check passes on its own and the first step appears.
  await waitForText('step 1 of')

  return {
    waitForText,
    frames: () => frames,
    press: async (...inputs) => {
      for (const input of inputs) {
        const previous = frame()
        stdin.write(input)
        await waitForFrameChange(frame, previous)
      }
    },
    frame,
    outcomes,
  }
}

// language, project, scope
const toCouncil = [keys.enter, keys.enter, keys.enter]

describe('App', () => {
  it('walks the whole flow and runs the review with the chosen agents', async () => {
    const launches: AgentLaunch[] = []
    const app = await startApp({ review: fakeReview(launches) })
    // name, then requirements, a separator, and the step counter above the step title
    expect(app.frame()).toMatch(
      /^ ai-review-council v9\.9\.9\n\n ✔ Git · ✔ Codex · ✔ Claude Code\n ─{40}\n\n Report language • step 1 of 7\n/,
    )
    expect(app.frame()).toContain('Report language')
    expect(app.frame()).toContain('✔ Git · ✔ Codex · ✔ Claude Code')

    await app.press(...toCouncil)
    expect(app.frame()).toContain('Council agent')
    // answers so far, then the field this step sets
    expect(app.frame()).toContain('Scope         uncommitted changes on aaaaaaa (1 files, 1 likely secret file(s) excluded)')
    expect(app.frame()).toContain('Council       ← selecting')
    expect(app.frame()).not.toContain('Reviewers')
    // → to the effort column, medium -> high, Enter confirms
    await app.press(keys.right, keys.right, keys.down, keys.enter)

    // two reviewers
    await app.press(keys.down, keys.enter)
    expect(app.frame()).toContain('Reviewer 1 of 2')
    // → to the model column, a model without efforts, Enter goes to the next reviewer
    await app.press(keys.right, keys.down, keys.enter)
    expect(app.frame()).toContain('Reviewer 2 of 2')
    expect(app.frame()).toContain('Codex • codex-small • default • code')
    // the next reviewer starts fresh: focus on the left column, first model, its default effort
    expect(app.frame()).toContain('▸ Provider')
    expect(app.frame()).toContain('› codex-large')
    expect(app.frame()).toContain('› medium')
    expect(app.frame()).not.toContain('› high')
    // → to the review column, security -> ui-ux
    await app.press(keys.right, keys.right, keys.right, keys.down, keys.enter)

    expect(app.frame()).toContain('Council       Codex · codex-large · high')
    expect(app.frame()).toContain('Reviewers     2')
    expect(app.frame()).toContain('Prompt        ← selecting')
    await app.press('Checkout total must include VAT', keys.enter, 'Rounding to 2 places', keys.ctrlD)
    const frame = app.frame()
    expect(frame).toContain('Summary')
    expect(frame).toContain('Codex · codex-large · high')
    // no instruction files and no usage warning in the summary
    expect(frame).not.toContain('council.md')
    expect(frame).not.toContain('Starting launches')
    expect(frame).toContain('1 likely secret file(s) excluded')
    expect(frame).toContain('Timeout       10 min per agent')
    const summaryLines = frame.split('\n')
    const summaryOrder = ['Language', 'Project', 'Branch', 'Scope', 'Council', 'Reviewers', 'Prompt', 'Timeout'].map(
      (label) => summaryLines.findIndex((line) => line.trimStart().startsWith(label)),
    )
    expect(summaryOrder.every((position) => position >= 0)).toBe(true)
    expect(summaryOrder).toEqual([...summaryOrder].sort((left, right) => left - right))
    expect(frame).toContain('Working tree  currently has uncommitted changes')

    await app.press(keys.enter)
    while (app.outcomes.length === 0) {
      await delay(10)
    }

    const runFrame = app.frames().findLast((rendered) => rendered.includes('Reviewing')) ?? ''
    expect(runFrame).toContain('Reviewing 1 file(s) · Ctrl+C cancels all agents')
    expect(runFrame).toMatch(/\n {2}Codex +codex-large +medium +ui-ux +✔ done · 1 finding/)
    expect(runFrame).toMatch(/\n {2}Codex +codex-small +default +code +✔ done · 1 finding/)
    expect(runFrame).toMatch(/\n {2}Codex +codex-large +high +council +✔ done · 1 finding/)
    expect(app.outcomes).toEqual([
      {
        kind: 'finished',
        result: expect.objectContaining({ kind: 'reported', report: '# Review: VAT missing\n### VAT not added' }),
      },
    ])
    const councilLaunch = launches.find((launch) => launch.message.startsWith('# Council session'))
    expect(councilLaunch).toMatchObject({
      configuration: { provider: 'codex', model: 'codex-large', effort: 'high' },
      cwd: '/repo',
      readableDirectories: ['/tmp/council-test'],
    })
    expect(councilLaunch?.message).toContain('## Review prompt\nCheckout total must include VAT\nRounding to 2 places')
    expect(launches).toHaveLength(3)
  })

  it('lists only the models of the selected provider', async () => {
    const app = await startApp()
    await app.press(...toCouncil)
    expect(app.frame()).toContain('codex-large')
    expect(app.frame()).not.toContain('claude-large')

    await app.press(keys.down)
    expect(app.frame()).toContain('claude-large')
    expect(app.frame()).not.toContain('codex-large')
  })

  it('skips the language and folder steps given as options', async () => {
    const app = await startApp({}, { language: 'pl', directory: tmpdir(), scope: null, reviewerCount: null })

    expect(app.frame()).toContain('Review scope')
    expect(app.frame()).toContain('step 1 of 5')
    // values line up in one column
    const lines = app.frame().split('\n')
    const valueColumn = (label: string): number => {
      const line = lines.find((candidate) => candidate.trimStart().startsWith(label)) ?? ''

      return line.length - line.slice(line.indexOf(label) + label.length).trimStart().length
    }
    expect(app.frame()).toContain('Branch        main')
    expect(app.frame()).toContain('Language      Polish')
    expect(app.frame()).toContain('Scope         ← selecting')
    expect(app.frame()).not.toContain('Working tree')
    // fields follow the wizard steps
    const order = ['Language', 'Project', 'Branch', 'Scope'].map((label) =>
      lines.findIndex((line) => line.trimStart().startsWith(label)),
    )
    expect(order).toEqual([...order].sort((left, right) => left - right))
    expect(new Set([valueColumn('Project'), valueColumn('Branch'), valueColumn('Language')]).size).toBe(1)
  })

  it('shows the folder step with the error when the --dir path is invalid', async () => {
    const app = await startApp({}, { language: null, directory: '/no/such/folder', scope: null, reviewerCount: null })
    await app.press(keys.enter)
    await app.waitForText('Not a directory')

    expect(app.frame()).toContain('Project folder')
    expect(app.frame()).toContain('Not a directory: /no/such/folder')
  })

  it('skips the scope step given as an option', async () => {
    const app = await startApp({}, { language: 'pl', directory: tmpdir(), scope: { kind: 'uncommitted' }, reviewerCount: null })
    await app.waitForText('Council agent')

    expect(app.frame()).toContain('Council agent • step 1 of 4')
  })

  it('shows the scope step with the error and the hash when the --scope commit is wrong', async () => {
    const app = await startApp(
      { git: fakeGitRepository({ isInHeadHistory: async () => false }) },
      { language: 'pl', directory: tmpdir(), scope: { kind: 'since-commit', commitRef: 'aaaa' }, reviewerCount: null },
    )
    await app.waitForText('not in the history')

    expect(app.frame()).toContain('Review scope')
    expect(app.frame()).toContain('Changes after this commit, uncommitted included:')
    expect(app.frame()).toContain('aaaa')
  })

  it('goes straight to the first reviewer when the count is given as an option', async () => {
    const app = await startApp({}, { language: 'pl', directory: tmpdir(), scope: { kind: 'uncommitted' }, reviewerCount: 3 })
    await app.waitForText('Council agent')
    await app.press(keys.enter)

    expect(app.frame()).toContain('Reviewer 1 of 3')
    expect(app.frame()).not.toContain('How many reviewers')
    await app.press(keys.escape)
    expect(app.frame()).toContain('Council agent')
  })

  it('continues with only Claude Code when Codex is not available', async () => {
    const app = await startApp({
      adapters: [fakeAdapter('codex', { status: { problem: 'Not logged in.' } }), fakeAdapter('claude')],
    })
    expect(app.frame()).toContain('– Codex (Not logged in.) · ✔ Claude Code')
    await app.press(...toCouncil)

    expect(app.frame()).toContain('claude-large')
    expect(app.frame()).not.toContain('codex-large')
  })

  it('ends when no provider is available', async () => {
    const app = await startApp({
      adapters: [
        fakeAdapter('codex', { status: { problem: 'Not logged in.' } }),
        fakeAdapter('claude', { status: { problem: '`claude` was not found in PATH.' } }),
      ],
    })
    await app.waitForText('Requirements not met')

    expect(app.frame()).toContain('At least one of Codex or Claude Code must be installed and logged in.')
    await app.press(keys.enter)
    expect(app.outcomes).toEqual([{ kind: 'blocked' }])
  })

  it('reviews the entire codebase chosen in the scope step', async () => {
    const app = await startApp()
    await app.press(keys.enter, keys.enter)

    expect(app.frame()).toContain('Entire codebase')
    await app.press(keys.down, keys.down, keys.enter)
    await app.waitForText('Council agent')
    expect(app.frame()).toContain('Scope         entire codebase on aaaaaaa, uncommitted included (1 files')
  })

  it('stays on the scope step when there is nothing to review', async () => {
    const app = await startApp({ git: fakeGitRepository({ listChangedFiles: async () => [] }) })
    await app.press(...toCouncil)

    expect(app.frame()).toContain('There are no uncommitted changes to review.')
    expect(app.frame()).toContain('Review scope')
  })

  it('pastes the clipboard into the prompt with Ctrl+V', async () => {
    const app = await startApp()
    const councilColumns = [keys.enter]
    // the count question, then the reviewer
    const oneReviewer = [keys.enter, keys.enter]
    await app.press(...toCouncil, ...councilColumns, ...oneReviewer, 'Context: ', keys.ctrlV)

    expect(app.frame()).toContain('Context: Pasted line 1')
    expect(app.frame()).toContain('Pasted line 2')
  })

  it('accepts an empty prompt and reviews the code alone', async () => {
    const launches: AgentLaunch[] = []
    const app = await startApp({ review: fakeReview(launches) })
    const councilColumns = [keys.enter]
    // the count question, then the reviewer
    const oneReviewer = [keys.enter, keys.enter]
    await app.press(...toCouncil, ...councilColumns, ...oneReviewer, keys.ctrlD)

    expect(app.frame()).toContain('Summary')
    expect(app.frame()).toContain('Prompt        none, review of the code alone')
    await app.press(keys.enter)
    while (app.outcomes.length === 0) {
      await delay(10)
    }
    expect(launches[0]?.message).toContain('## Review prompt\nNone given. Review the change on its own merits')
  })
})
