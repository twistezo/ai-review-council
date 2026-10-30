import type { ChangedFile } from '../domain/review-session.js'

export const parseNulSeparated = (output: string): string[] =>
  output.split('\0').filter((entry) => entry.trim() !== '')

const changeFromStatusCode = (code: string): ChangedFile['change'] => {
  if (code === 'A') {
    return 'added'
  }
  if (code === 'D') {
    return 'deleted'
  }

  return 'modified'
}

// Parses `git diff --name-status -z`: renames and copies carry two paths.
export const parseNameStatus = (output: string): ChangedFile[] => {
  const tokens = parseNulSeparated(output)
  const files: ChangedFile[] = []
  let index = 0

  while (index < tokens.length) {
    const code = tokens[index]?.charAt(0) ?? ''
    if (code === 'R' || code === 'C') {
      files.push({
        path: tokens[index + 2] ?? '',
        previousPath: tokens[index + 1] ?? null,
        change: code === 'R' ? 'renamed' : 'copied',
      })
      index += 3
      continue
    }
    files.push({ path: tokens[index + 1] ?? '', previousPath: null, change: changeFromStatusCode(code) })
    index += 2
  }

  return files.filter((file) => file.path !== '')
}
