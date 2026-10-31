import { readFileSync } from 'node:fs'
import { z } from 'zod'

const appInfoSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
})
export type AppInfo = z.infer<typeof appInfoSchema>

// The npm scope is left out: `@twistezo/ai-review-council` names itself `ai-review-council`.
export const appNameFromPackageName = (packageName: string): string => packageName.split('/').at(-1) ?? packageName

// From package.json, which sits one level above both `src/` and `dist/`.
export const readAppInfo = (): AppInfo => {
  const { name, version } = appInfoSchema.parse(
    JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')),
  )

  return { name: appNameFromPackageName(name), version }
}

// The one way the app names itself, e.g. `ai-review-council v0.7.0`.
export const formatAppTitle = ({ name, version }: AppInfo): string => `${name} v${version}`
