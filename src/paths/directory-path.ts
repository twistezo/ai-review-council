import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'

// Accepts pasted paths: surrounding quotes and backslash-escaped spaces (Finder drag and drop).
export const normalizePathInput = (raw: string): string => {
  const trimmed = raw.trim()
  const quote = trimmed.charAt(0)
  const isQuoted = trimmed.length >= 2 && (quote === '"' || quote === "'") && trimmed.endsWith(quote)
  const unquoted = isQuoted ? trimmed.slice(1, -1) : trimmed

  return unquoted.replaceAll('\\ ', ' ')
}

export const expandHome = (value: string, homeDirectory: string): string => {
  if (value === '~') {
    return homeDirectory
  }

  return value.startsWith('~/') ? path.join(homeDirectory, value.slice(2)) : value
}

export const resolveInputPath = (raw: string, cwd: string, homeDirectory: string): string =>
  path.resolve(cwd, expandHome(normalizePathInput(raw), homeDirectory))

export const isDirectory = async (directory: string): Promise<boolean> => {
  try {
    return (await stat(directory)).isDirectory()
  } catch {
    return false
  }
}

export type DirectoryCompletion = {
  value: string
  candidates: string[]
}

const commonPrefix = (values: readonly string[]): string => {
  const [first = '', ...rest] = values
  let length = first.length
  for (const value of rest) {
    while (!value.startsWith(first.slice(0, length))) {
      length -= 1
    }
  }

  return first.slice(0, length)
}

const listDirectoryNames = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true })
  const checks = await Promise.all(
    entries.map(async (entry) =>
      entry.isDirectory() || (entry.isSymbolicLink() && (await isDirectory(path.join(directory, entry.name)))),
    ),
  )

  return entries.filter((_, index) => checks[index]).map((entry) => entry.name)
}

// Tab completion for directories only. Hidden directories appear once the prefix starts with a dot.
export const completeDirectory = async (
  raw: string,
  cwd: string,
  homeDirectory: string,
): Promise<DirectoryCompletion> => {
  const input = normalizePathInput(raw)
  if (input === '~') {
    return { value: '~/', candidates: [] }
  }
  const separatorIndex = input.lastIndexOf('/')
  const typedParent = input.slice(0, separatorIndex + 1)
  const prefix = input.slice(separatorIndex + 1)
  const parentDirectory = path.resolve(cwd, expandHome(typedParent === '' ? '.' : typedParent, homeDirectory))

  let names: string[]
  try {
    names = await listDirectoryNames(parentDirectory)
  } catch {
    return { value: raw, candidates: [] }
  }
  const matches = names
    .filter((name) => name.startsWith(prefix) && (prefix.startsWith('.') || !name.startsWith('.')))
    .sort((left, right) => left.localeCompare(right))

  if (matches.length === 0) {
    return { value: raw, candidates: [] }
  }
  if (matches.length === 1) {
    return { value: `${typedParent}${matches[0]}/`, candidates: [] }
  }

  return { value: `${typedParent}${commonPrefix(matches)}`, candidates: matches }
}
