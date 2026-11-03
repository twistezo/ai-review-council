import { render } from 'ink-testing-library'
import { useState } from 'react'
import type { JSX } from 'react'
import { describe, expect, it } from 'vitest'

import { MultilineInput } from './multiline-input.js'

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const waitUntil = async (description: string, isReady: () => boolean): Promise<void> => {
  const deadline = Date.now() + 2_000
  while (!isReady()) {
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for ${description}`)
    }
    await delay(5)
  }
}

type HarnessProps = {
  onSubmit: (value: string) => void
  readClipboard: () => Promise<string | null>
}

const Harness = ({ onSubmit, readClipboard }: HarnessProps): JSX.Element => {
  const [value, setValue] = useState('')

  return <MultilineInput value={value} onChange={setValue} onSubmit={() => onSubmit(value)} readClipboard={readClipboard} />
}

// Types each key once the previous one is on screen, then submits with Ctrl+D.
const submitTyped = async (
  keys: readonly string[],
  readClipboard: () => Promise<string | null> = async () => null,
): Promise<string[]> => {
  const submitted: string[] = []
  const { stdin, lastFrame } = render(<Harness onSubmit={(value) => submitted.push(value)} readClipboard={readClipboard} />)
  await waitUntil('the input to listen', () => stdin.listenerCount('readable') > 0)
  for (const key of keys) {
    const previous = lastFrame()
    stdin.write(key)
    await waitUntil(`the frame after ${JSON.stringify(key)}`, () => lastFrame() !== previous)
  }
  stdin.write('\x04')
  await waitUntil('the submit', () => submitted.length > 0)

  return submitted
}

describe('MultilineInput', () => {
  it('adds a new line with Enter and submits with Ctrl+D', async () => {
    expect(await submitTyped(['one', '\r', 'two'])).toEqual(['one\ntwo'])
  })

  it('also takes Shift+Enter from terminals that report it as a new line', async () => {
    expect(await submitTyped(['one', '\u001b[13;2u', 'two'])).toEqual(['one\ntwo'])
  })

  it('removes the last character with Backspace, across a line break too', async () => {
    expect(await submitTyped(['one', '\r', '\x7f', '\x7f', 'X'])).toEqual(['onX'])
  })

  it('pastes the clipboard with Ctrl+V, turning Windows line endings into new lines', async () => {
    expect(await submitTyped(['A: ', '\x16'], async () => 'one\r\ntwo\rthree')).toEqual(['A: one\ntwo\nthree'])
  })

  it('takes a terminal paste with its line breaks', async () => {
    expect(await submitTyped(['\u001b[200~one\r\ntwo\u001b[201~'])).toEqual(['one\ntwo'])
  })
})
