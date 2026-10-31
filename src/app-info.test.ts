import { describe, expect, it } from 'vitest'

import { appNameFromPackageName, formatAppTitle, readAppInfo } from './app-info.js'

describe('app info', () => {
  it('reads the name without the npm scope and the version of this package', () => {
    expect(readAppInfo()).toEqual({ name: 'ai-review-council', version: expect.stringMatching(/^\d+\.\d+\.\d+$/) })
  })

  it.each([
    ['@twistezo/ai-review-council', 'ai-review-council'],
    ['ai-review-council', 'ai-review-council'],
  ])('names the app %s as %s', (packageName, appName) => {
    expect(appNameFromPackageName(packageName)).toBe(appName)
  })

  it('names the app as the repository plus the version', () => {
    expect(formatAppTitle({ name: 'ai-review-council', version: '0.7.0' })).toBe('ai-review-council v0.7.0')
  })
})
