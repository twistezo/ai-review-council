import { describe, expect, it } from 'vitest'

import { previewReport } from './report-preview.js'

describe('previewReport', () => {
  it('takes the title, the first paragraph and the finding headings, whatever the section names', () => {
    const report = [
      '# Raport rady weryfikacyjnej',
      '',
      'Potwierdzono dwa problemy.',
      'Jeden wymaga dowodów.',
      '',
      '## Potwierdzone problemy',
      '',
      '### 1. Wynik zmienia kreator',
      '',
      '**Waga: średnia**',
      '',
      '```ts',
      '### not a heading inside code',
      '```',
      '',
      '### 2. Backspace psuje emoji',
      '',
      '## Kwestie nierozstrzygnięte',
      '',
      '- Konfiguracja Claude Code',
    ].join('\n')

    expect(previewReport(report)).toEqual({
      title: 'Raport rady weryfikacyjnej',
      summary: 'Potwierdzono dwa problemy. Jeden wymaga dowodów.',
      findings: ['1. Wynik zmienia kreator', '2. Backspace psuje emoji'],
      lineCount: 20,
    })
  })

  it('reads the summary under a section heading, never from a finding', () => {
    expect(previewReport('# Review\n\n## Summary\nAll good.\n\n## Findings\n### Typo').summary).toBe('All good.')
    expect(previewReport('# Review\n\n### Typo\n\nThe word is misspelled.').summary).toBeNull()
  })

  it('works without a title or findings', () => {
    expect(previewReport('No issues were confirmed.')).toEqual({
      title: null,
      summary: 'No issues were confirmed.',
      findings: [],
      lineCount: 1,
    })
  })
})
