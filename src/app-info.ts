import { readFileSync } from 'node:fs'
import { z } from 'zod'

const appInfoSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
})
export type AppInfo = z.infer<typeof appInfoSchema>

// From package.json, which sits one level above both `src/` and `dist/`.
export const readAppInfo = (): AppInfo =>
  appInfoSchema.parse(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')))

// The one way the app names itself, e.g. `ai-review-council v0.7.0`.
export const formatAppTitle = ({ name, version }: AppInfo): string => `${name} v${version}`
