import { parseArgs } from "node:util"

import type { ReportLanguage } from "./domain/review-session.js"
import { isCommitHashFormat } from "./git/git-repository.js"
import type { ScopeRequest } from "./scope/build-review-scope.js"
import {
  defaultTimeoutMinutes,
  maxTimeoutMinutes,
  reportLanguageSchema,
  reportLanguages,
  timeoutMinutesSchema,
} from "./domain/review-session.js"

type CliOptions = {
  directory: string | null
  language: ReportLanguage | null
  scope: ScopeRequest | null
  timeoutMinutes: number
  showHelp: boolean
}

type CliOptionsResult =
  { ok: true; options: CliOptions } | { ok: false; error: string }

export const usage = `Usage: ai-review-council [options]

Options:
  -d, --dir <path>     Project folder to review; skips the folder step
  -l, --lang <code>    Report language: ${reportLanguages.join(", ")}; skips the language step
  -s, --scope <value>  uncommitted, codebase for the entire codebase, or a commit hash to review the changes after it;
                       skips the scope step
  -t, --timeout <min>  Minutes each agent may run before it fails (default ${defaultTimeoutMinutes}, max ${maxTimeoutMinutes})
  -h, --help           Show this help`

type RawOptions = {
  dir?: string
  lang?: string
  scope?: string
  timeout?: string
  help?: boolean
}

const readRawOptions = (args: readonly string[]): RawOptions =>
  parseArgs({
    args: [...args],
    options: {
      dir: { type: "string", short: "d" },
      lang: { type: "string", short: "l" },
      scope: { type: "string", short: "s" },
      timeout: { type: "string", short: "t" },
      help: { type: "boolean", short: "h" },
    },
    strict: true,
    allowPositionals: false,
  }).values

const uncommittedScope = "uncommitted"
const codebaseScope = "codebase"

const parseScope = (
  value: string | undefined,
): ScopeRequest | null | "invalid" => {
  if (value === undefined) {
    return null
  }
  const trimmed = value.trim()
  if (trimmed.toLowerCase() === uncommittedScope) {
    return { kind: "uncommitted" }
  }
  if (trimmed.toLowerCase() === codebaseScope) {
    return { kind: "full" }
  }

  return isCommitHashFormat(trimmed)
    ? { kind: "since-commit", commitRef: trimmed }
    : "invalid"
}

export const parseCliOptions = (args: readonly string[]): CliOptionsResult => {
  let values: RawOptions
  try {
    values = readRawOptions(args)
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }

  const language =
    values.lang === undefined
      ? null
      : reportLanguageSchema.safeParse(values.lang.toLowerCase())
  if (language !== null && !language.success) {
    return {
      ok: false,
      error: `Unsupported language "${values.lang}". Use one of: ${reportLanguages.join(", ")}.`,
    }
  }
  if (values.dir !== undefined && values.dir.trim() === "") {
    return { ok: false, error: "The --dir option needs a path." }
  }
  const scope = parseScope(values.scope)
  if (scope === "invalid") {
    return {
      ok: false,
      error:
        "The --scope option needs `uncommitted`, `codebase` or a commit hash (4 to 40 hexadecimal characters).",
    }
  }
  // plain digits only: `Number` would also take `1e1`, `0x5` or padded values
  const isPlainNumber =
    values.timeout === undefined || /^\d+$/.test(values.timeout)
  const timeout = timeoutMinutesSchema.safeParse(
    values.timeout === undefined
      ? defaultTimeoutMinutes
      : Number(values.timeout),
  )
  if (!isPlainNumber || !timeout.success) {
    return {
      ok: false,
      error: `The --timeout option needs whole minutes from 1 to ${maxTimeoutMinutes}.`,
    }
  }

  return {
    ok: true,
    options: {
      directory: values.dir ?? null,
      language: language === null ? null : language.data,
      scope,
      timeoutMinutes: timeout.data,
      showHelp: values.help ?? false,
    },
  }
}
