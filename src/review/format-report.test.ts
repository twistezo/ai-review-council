import { describe, expect, it } from 'vitest'

import { formatReport } from './format-report.js'

describe('formatReport', () => {
  it('formats the report as Markdown', async () => {
    const report = '# Przegląd\n## Ustalenia\n* Ważność: wysoka\n*   Pewność: średnia\n\n\n\nKoniec'

    expect(await formatReport(report)).toBe('# Przegląd\n\n## Ustalenia\n\n- Ważność: wysoka\n- Pewność: średnia\n\nKoniec')
  })

  it('keeps code blocks as they are', async () => {
    const report = '# Review\n\n```ts\nconst  total=net*(1+VAT_RATE)\n```'

    expect(await formatReport(report)).toBe(report)
  })
})
