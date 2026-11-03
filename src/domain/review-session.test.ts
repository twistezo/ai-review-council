import { describe, expect, it } from "vitest"

import type { AgentConfiguration } from "./review-session.js"
import { reviewSessionDraftSchema } from "./review-session.js"

const copilotAuto: AgentConfiguration = {
  provider: "copilot",
  model: "auto",
  modelLabel: "Auto",
  effort: null,
}
const codexHigh: AgentConfiguration = {
  provider: "codex",
  model: "gpt-6-luna",
  modelLabel: "GPT-6-Luna",
  effort: "high",
}

const validScope: Record<string, unknown> = {
  kind: "full",
  base: { hash: "a".repeat(40), subject: "Base" },
  diffBase: "empty",
  changedFiles: [{ path: "cart.ts", previousPath: null, change: "modified" }],
  excludedFiles: [],
}

const draft = (
  council: AgentConfiguration,
  reviewer: AgentConfiguration,
): Record<string, unknown> => ({
  language: "en",
  repository: { root: "/repo", branch: "main", hasChanges: true },
  scope: validScope,
  council,
  reviewers: [{ configuration: reviewer, reviewType: "code" }],
  prompt: "",
  timeoutMinutes: 10,
})

const isValid = (input: Record<string, unknown>): boolean =>
  reviewSessionDraftSchema.safeParse(input).success

const withScope = (
  scope: Record<string, unknown>,
): Record<string, unknown> => ({
  ...draft(codexHigh, codexHigh),
  scope: { ...validScope, ...scope },
})

const withReviewers = (count: number): Record<string, unknown> => ({
  ...draft(codexHigh, codexHigh),
  reviewers: Array.from({ length: count }, () => ({
    configuration: codexHigh,
    reviewType: "code",
  })),
})

const errorMessages = (input: Record<string, unknown>): string[] =>
  reviewSessionDraftSchema
    .safeParse(input)
    .error?.issues.map(issue => issue.message) ?? []

describe("reviewSessionDraftSchema", () => {
  it("accepts a Copilot Auto reviewer with a Codex council", () => {
    expect(
      reviewSessionDraftSchema.safeParse(draft(codexHigh, copilotAuto)).success,
    ).toBe(true)
  })

  it("rejects Copilot as the council agent", () => {
    expect(errorMessages(draft(copilotAuto, copilotAuto))).toEqual([
      "The council agent must be Codex or Claude.",
    ])
  })

  it.each([
    {
      name: "an explicit effort",
      reviewer: { ...copilotAuto, effort: "high" },
    },
    {
      name: "a named model",
      reviewer: { ...copilotAuto, model: "gpt-6-luna" },
    },
  ])("rejects a Copilot reviewer with $name", ({ reviewer }) => {
    expect(errorMessages(draft(codexHigh, reviewer))).toEqual([
      "Copilot supports only Auto without reasoning effort.",
    ])
  })

  it.each([1, 10])("accepts %i reviewers", count => {
    expect(isValid(withReviewers(count))).toBe(true)
  })

  it.each([0, 11])("rejects %i reviewers", count => {
    expect(isValid(withReviewers(count))).toBe(false)
  })

  it("rejects a scope with no files to review", () => {
    expect(isValid(withScope({ changedFiles: [] }))).toBe(false)
  })

  it.each(["abc1234", "a".repeat(41), ""])(
    "rejects a base commit hash that is not a full hash: %s",
    hash => {
      expect(isValid(withScope({ base: { hash, subject: "Base" } }))).toBe(
        false,
      )
    },
  )

  it.each([0, 31, 1.5])("rejects a timeout of %s minutes", timeoutMinutes => {
    expect(isValid({ ...draft(codexHigh, codexHigh), timeoutMinutes })).toBe(
      false,
    )
  })

  it("rejects an unknown review type or report language", () => {
    expect(
      isValid({
        ...draft(codexHigh, codexHigh),
        reviewers: [{ configuration: codexHigh, reviewType: "style" }],
      }),
    ).toBe(false)
    expect(isValid({ ...draft(codexHigh, codexHigh), language: "de" })).toBe(
      false,
    )
  })

  it("trims a prompt made of whitespace to an empty prompt", () => {
    const parsed = reviewSessionDraftSchema.parse({
      ...draft(codexHigh, codexHigh),
      prompt: "  \n ",
    })

    expect(parsed.prompt).toBe("")
  })
})
