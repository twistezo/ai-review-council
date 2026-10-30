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

export type PartitionedFiles = {
  included: ChangedFile[]
  excluded: string[]
}

export const partitionReviewFiles = (files: readonly ChangedFile[]): PartitionedFiles => ({
  included: files.filter((file) => !isLikelySecretFile(file.path)),
  excluded: files.filter((file) => isLikelySecretFile(file.path)).map((file) => file.path),
})
