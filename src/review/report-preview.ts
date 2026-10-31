import { proseLines } from './run-review.js'

export type ReportPreview = {
  title: string | null
  // the first paragraph before any finding
  summary: string | null
  // `### ` headings, which the council keeps for confirmed findings
  findings: string[]
  lineCount: number
}

const headingText = (line: string, marker: string): string => line.slice(marker.length).trim()

// Built only from what every report keeps: the `# ` title, its first paragraph and the `### ` finding headings.
// Section names and severity fields follow the report language and wording, so they are left out.
export const previewReport = (report: string): ReportPreview => {
  const lines = proseLines(report)
  const titleIndex = lines.findIndex(({ line }) => line.startsWith('# '))
  const title = titleIndex === -1 ? null : headingText(lines[titleIndex]?.line ?? '', '# ')
  const afterTitle = lines.slice(titleIndex + 1)
  const firstFinding = afterTitle.findIndex(({ line }) => line.startsWith('### '))
  const beforeFindings = firstFinding === -1 ? afterTitle : afterTitle.slice(0, firstFinding)
  const paragraphStart = beforeFindings.findIndex(({ line }) => line.trim() !== '' && !line.startsWith('#'))
  const paragraph: string[] = []
  for (const { line } of paragraphStart === -1 ? [] : beforeFindings.slice(paragraphStart)) {
    if (line.trim() === '' || line.startsWith('#')) {
      break
    }
    paragraph.push(line.trim())
  }

  return {
    title,
    summary: paragraph.length === 0 ? null : paragraph.join(' '),
    findings: lines.filter(({ line }) => line.startsWith('### ')).map(({ line }) => headingText(line, '### ')),
    lineCount: report.split('\n').length,
  }
}
