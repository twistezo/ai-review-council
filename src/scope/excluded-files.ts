import type { ChangedFile } from '../domain/review-session.js'

const secretFileNames = new Set([
  '.env',
  '.netrc',
  '.npmrc',
  '.pypirc',
  'credentials',
  'credentials.json',
  'secrets.json',
  'service-account.json',
  'id_rsa',
  'id_dsa',
  'id_ecdsa',
  'id_ed25519',
])
const secretExtensions = ['.pem', '.key', '.p12', '.pfx', '.jks', '.keystore', '.kdbx']
const envTemplateSuffixes = ['.example', '.sample', '.template', '.dist']

export const isLikelySecretFile = (filePath: string): boolean => {
  const fileName = (filePath.split('/').at(-1) ?? '').toLowerCase()
  const isEnvFile =
    fileName.startsWith('.env.') && !envTemplateSuffixes.some((suffix) => fileName.endsWith(suffix))

  return (
    secretFileNames.has(fileName) || isEnvFile || secretExtensions.some((extension) => fileName.endsWith(extension))
  )
}

// The same names as Claude Code deny rules, so an agent cannot read them outside the diff either.
// Rules cannot make exceptions, so env templates such as `.env.example` are denied too.
export const secretReadDenyRules: readonly string[] = [
  ...secretFileNames,
  '.env.*',
  ...secretExtensions.map((extension) => `*${extension}`),
].map((pattern) => `Read(**/${pattern})`)

type PartitionedFiles = {
  included: ChangedFile[]
  excluded: string[]
}

// A rename touches two paths; a secret on either side keeps the file out of the diff.
const touchesSecretFile = (file: ChangedFile): boolean =>
  isLikelySecretFile(file.path) || (file.previousPath !== null && isLikelySecretFile(file.previousPath))

export const partitionReviewFiles = (files: readonly ChangedFile[]): PartitionedFiles => ({
  included: files.filter((file) => !touchesSecretFile(file)),
  excluded: files
    .filter(touchesSecretFile)
    .map((file) => (file.previousPath === null ? file.path : `${file.previousPath} -> ${file.path}`)),
})
