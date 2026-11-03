import { render } from 'ink-testing-library'
import { describe, expect, it } from 'vitest'

import type { WriteClipboard } from '../../clipboard/write-clipboard.js'
import type { OpenReport } from '../../review/open-report.js'
import { ReportResult } from './report-result.js'

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const report = '# Review: VAT missing\n\n### VAT not added'

type Actions = {
  writeClipboard?: WriteClipboard
  openReport?: OpenReport
}

type ReportView = {
  press: (input: string) => void
  waitForText: (text: string) => Promise<void>
  waitForQuit: () => Promise<void>
  frame: () => string
  quits: () => number
}

const showReport = async ({
  writeClipboard = async () => true,
  openReport = async () => '/tmp/review.md',
}: Actions = {}): Promise<ReportView> => {
  let quits = 0
  const { stdin, lastFrame } = render(
    <ReportResult
      report={report}
      writeClipboard={writeClipboard}
      openReport={openReport}
      onQuit={() => {
        quits += 1
      }}
    />,
  )
  const frame = (): string => lastFrame() ?? ''
  const waitFor = async (description: string, isReady: () => boolean): Promise<void> => {
    const deadline = Date.now() + 2_000
    while (!isReady()) {
      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for ${description}. Last frame:\n${frame()}`)
      }
      await delay(5)
    }
  }
  await waitFor('the keys to work', () => stdin.listenerCount('readable') > 0)

  return {
    press: (input: string): void => {
      stdin.write(input)
    },
    waitForText: (text: string): Promise<void> => waitFor(`"${text}"`, () => frame().includes(text)),
    waitForQuit: (): Promise<void> => waitFor('the quit', () => quits > 0),
    frame,
    quits: (): number => quits,
  }
}

describe('ReportResult', () => {
  it('says so when the report cannot be copied', async () => {
    const view = await showReport({ writeClipboard: async () => false })
    view.press('c')
    await view.waitForText('✘ Could not copy the report to the clipboard.')

    expect(view.frame()).toContain('c copy · o open · q quit')
  })

  it('says so when the report cannot be opened', async () => {
    const view = await showReport({ openReport: async () => null })
    view.press('o')
    await view.waitForText('✘ Could not open the report.')

    expect(view.frame()).not.toContain('Report opened')
  })

  it.each([
    ['q', 'q'],
    ['Esc', '\x1b'],
  ])('quits with %s, leaving the preview without the key hints', async (_name, key) => {
    const view = await showReport()
    view.press(key)
    await view.waitForQuit()

    expect(view.frame()).toContain('Review: VAT missing')
    expect(view.frame()).not.toContain('q quit')
    expect(view.quits()).toBe(1)
  })
})
