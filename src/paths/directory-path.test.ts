import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { completeDirectory, normalizePathInput, resolveInputPath } from './directory-path.js'

let root = ''

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'directory-path-'))
  await mkdir(path.join(root, 'projects', 'my app'), { recursive: true })
  await mkdir(path.join(root, 'projects', 'my api'), { recursive: true })
  await mkdir(path.join(root, 'projects', '.hidden'), { recursive: true })
  await writeFile(path.join(root, 'projects', 'my notes.txt'), '')
})

afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('normalizePathInput', () => {
  it.each([
    ['"/Users/me/My Projects"', '/Users/me/My Projects'],
    ["'/tmp/a b'", '/tmp/a b'],
    ['/Users/me/My\\ Projects ', '/Users/me/My Projects'],
  ])('normalizes pasted %s', (raw, expected) => {
    expect(normalizePathInput(raw)).toBe(expected)
  })
})

describe('resolveInputPath', () => {
  it('expands ~ and resolves relative paths', () => {
    expect(resolveInputPath('~/code', '/cwd', '/Users/me')).toBe('/Users/me/code')
    expect(resolveInputPath('../repo', '/work/app', '/Users/me')).toBe('/work/repo')
  })
})

describe('completeDirectory', () => {
  it('completes a unique directory and appends a slash', async () => {
    expect(await completeDirectory('proj', root, '/home')).toEqual({ value: 'projects/', candidates: [] })
  })

  it('completes to the common prefix and lists directories only, with spaces', async () => {
    const result = await completeDirectory('projects/my', root, '/home')

    expect(result).toEqual({ value: 'projects/my ap', candidates: ['my api', 'my app'] })
  })

  it('shows hidden directories only for a dot prefix', async () => {
    expect(await completeDirectory('projects/.h', root, '/home')).toEqual({ value: 'projects/.hidden/', candidates: [] })
    expect((await completeDirectory('projects/', root, '/home')).candidates).not.toContain('.hidden')
  })

  it('keeps the input when nothing matches or the parent does not exist', async () => {
    expect(await completeDirectory('projects/zzz', root, '/home')).toEqual({ value: 'projects/zzz', candidates: [] })
    expect(await completeDirectory('/no/such/dir/x', root, '/home')).toEqual({ value: '/no/such/dir/x', candidates: [] })
  })

  it('expands ~ in the parent directory', async () => {
    expect(await completeDirectory('~/proj', '/elsewhere', root)).toEqual({ value: '~/projects/', candidates: [] })
  })
})
