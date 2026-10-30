import { render } from 'ink-testing-library'
import { useState } from 'react'
import type { JSX } from 'react'
import { describe, expect, it } from 'vitest'

import { MultilineInput } from './multiline-input.js'

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const Harness = ({ onSubmit }: { onSubmit: (value: string) => void }): JSX.Element => {
  const [value, setValue] = useState('')

  return <MultilineInput value={value} onChange={setValue} onSubmit={() => onSubmit(value)} readClipboard={async () => null} />
}

const type = async (stdin: { write: (data: string) => void }, keys: readonly string[]): Promise<void> => {
  for (const key of keys) {
    stdin.write(key)
    await delay(50)
  }
}

describe('MultilineInput', () => {
  it('adds a new line with Enter and submits with Ctrl+D', async () => {
    const submitted: string[] = []
    const { stdin } = render(<Harness onSubmit={(value) => submitted.push(value)} />)
    await delay(50)
    await type(stdin, ['one', '\r', 'two', '\x04'])

    expect(submitted).toEqual(['one\ntwo'])
  })

  it('also takes Shift+Enter from terminals that report it as a new line', async () => {
    const submitted: string[] = []
    const { stdin } = render(<Harness onSubmit={(value) => submitted.push(value)} />)
    await delay(50)
    await type(stdin, ['one', '\u001b[13;2u', 'two', '\x04'])

    expect(submitted).toEqual(['one\ntwo'])
  })
})
