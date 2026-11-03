import { describe, expect, it } from 'vitest'

import { commandResult, fakeRunCommand } from '../test-support/fakes.js'
import { createClipboardReader } from './read-clipboard.js'

describe('createClipboardReader', () => {
  it('returns the clipboard text exactly as pasted', async () => {
    const readClipboard = createClipboardReader(fakeRunCommand({ pbpaste: commandResult({ stdout: '  be921eb\n' }) }))

    expect(await readClipboard()).toBe('  be921eb\n')
  })

  it('returns an empty clipboard as empty text, not as a failure', async () => {
    const readClipboard = createClipboardReader(fakeRunCommand({ pbpaste: commandResult() }))

    expect(await readClipboard()).toBe('')
  })

  it('returns null when pbpaste fails', async () => {
    const readClipboard = createClipboardReader(
      fakeRunCommand({ pbpaste: commandResult({ exitCode: 1, stderr: 'pasteboard unavailable' }) }),
    )

    expect(await readClipboard()).toBeNull()
  })

  it('returns null when pbpaste is missing', async () => {
    const readClipboard = createClipboardReader(fakeRunCommand({}))

    expect(await readClipboard()).toBeNull()
  })
})
