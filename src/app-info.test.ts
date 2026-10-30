import { describe, expect, it } from 'vitest'

import { formatAppTitle, readAppInfo } from './app-info.js'

describe('app info', () => {
  it('reads the name and version of this package', () => {
    expect(readAppInfo()).toEqual({ name: 'ai-review-council', version: expect.stringMatching(/^\d+\.\d+\.\d+$/) })
  })

  it('names the app as the repository plus the version', () => {
    expect(formatAppTitle({ name: 'ai-review-council', version: '0.7.0' })).toBe('ai-review-council v0.7.0')
  })
})
