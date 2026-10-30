import { format } from 'prettier'

// Prettier's Markdown style for the printed and copied report; the original text when formatting fails.
// Code blocks stay as written: they quote or suggest code in the reviewed project's own style.
export const formatReport = async (report: string): Promise<string> => {
  try {
    return (await format(report, { parser: 'markdown', embeddedLanguageFormatting: 'off' })).trimEnd()
  } catch {
    return report
  }
}
