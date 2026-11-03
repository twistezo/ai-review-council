import { describe, expect, it } from "vitest"

import type {
  AgentConfiguration,
  ReviewerAssignment,
  ReviewScope,
} from "../domain/review-session.js"
import type { CatalogModel } from "../providers/model-catalog.js"
import { headCommit } from "../test-support/fakes.js"
import {
  catalogProviders,
  changeModel,
  changeProvider,
  choiceFromConfiguration,
  choiceToConfiguration,
  newReviewer,
  providerModelIndexes,
} from "./agent-choice.js"
import { describeScope } from "./describe-scope.js"
import { clampIndex, visibleWindow } from "./list-state.js"
import { summarizePrompt } from "./steps/summary-step.js"
import { nextStep, numberedSteps, previousStep } from "./wizard-steps.js"

const models: CatalogModel[] = [
  {
    provider: "codex",
    id: "sol",
    label: "Sol",
    efforts: ["low", "medium", "high"],
  },
  { provider: "codex", id: "luna", label: "Luna", efforts: ["low", "high"] },
  { provider: "claude", id: "default", label: "Default", efforts: [] },
]

const configuration: AgentConfiguration = {
  provider: "codex",
  model: "sol",
  modelLabel: "Sol",
  effort: "high",
}

describe("agent choice", () => {
  it("starts from the first model and its default effort", () => {
    expect(choiceFromConfiguration(models, null)).toEqual({
      modelIndex: 0,
      effort: "medium",
    })
  })

  it("restores an earlier configuration", () => {
    expect(choiceFromConfiguration(models, configuration)).toEqual({
      modelIndex: 0,
      effort: "high",
    })
  })

  it("starts over when the earlier model is no longer in the catalog", () => {
    const retired: AgentConfiguration = {
      provider: "codex",
      model: "nova",
      modelLabel: "Nova",
      effort: "low",
    }

    expect(choiceFromConfiguration(models, retired)).toEqual({
      modelIndex: 0,
      effort: "medium",
    })
  })

  it("has no effort to offer with an empty catalog", () => {
    expect(choiceFromConfiguration([], null)).toEqual({
      modelIndex: 0,
      effort: null,
    })
    expect(
      choiceToConfiguration([], { modelIndex: 0, effort: null }),
    ).toBeNull()
  })

  it("keeps the effort when the new model supports it, otherwise uses the model default", () => {
    expect(changeModel(models, { modelIndex: 0, effort: "high" }, 1)).toEqual({
      modelIndex: 1,
      effort: "high",
    })
    expect(changeModel(models, { modelIndex: 0, effort: "medium" }, 1)).toEqual(
      { modelIndex: 1, effort: "low" },
    )
    expect(changeModel(models, { modelIndex: 0, effort: "medium" }, 2)).toEqual(
      { modelIndex: 2, effort: null },
    )
  })

  it("keeps the choice when the model is not in the catalog", () => {
    expect(changeModel(models, { modelIndex: 0, effort: "high" }, 7)).toEqual({
      modelIndex: 0,
      effort: "high",
    })
  })

  it("builds the configuration of the chosen model", () => {
    expect(
      choiceToConfiguration(models, { modelIndex: 2, effort: null }),
    ).toEqual({
      provider: "claude",
      model: "default",
      modelLabel: "Default",
      effort: null,
    })
  })

  it("builds nothing for a model outside the catalog", () => {
    expect(
      choiceToConfiguration(models, { modelIndex: 3, effort: null }),
    ).toBeNull()
    expect(
      choiceToConfiguration(models, { modelIndex: -1, effort: null }),
    ).toBeNull()
  })
})

describe("providers in the catalog", () => {
  it("lists each provider once, in catalog order", () => {
    expect(catalogProviders(models)).toEqual(["codex", "claude"])
    expect(catalogProviders([...models].reverse())).toEqual(["claude", "codex"])
    expect(catalogProviders([])).toEqual([])
  })

  it("finds the catalog positions of one provider", () => {
    expect(providerModelIndexes(models, "codex")).toEqual([0, 1])
    expect(providerModelIndexes(models, "claude")).toEqual([2])
    expect(providerModelIndexes(models, "copilot")).toEqual([])
  })

  it("selects the first model of a newly picked provider with its default effort", () => {
    expect(
      changeProvider(models, { modelIndex: 1, effort: "high" }, "claude"),
    ).toEqual({ modelIndex: 2, effort: null })
    expect(
      changeProvider(models, { modelIndex: 2, effort: null }, "codex"),
    ).toEqual({ modelIndex: 0, effort: "medium" })
  })

  it("keeps the model when the provider stays the same", () => {
    expect(
      changeProvider(models, { modelIndex: 1, effort: "high" }, "codex"),
    ).toEqual({ modelIndex: 1, effort: "high" })
  })

  it("keeps the choice for a provider without models", () => {
    expect(
      changeProvider(models, { modelIndex: 0, effort: "low" }, "copilot"),
    ).toEqual({ modelIndex: 0, effort: "low" })
  })
})

describe("newReviewer", () => {
  it("cycles through the review types by position", () => {
    const reviewers: ReviewerAssignment[] = [0, 1, 2, 3].map(position =>
      newReviewer(configuration, position),
    )

    expect(reviewers.map(reviewer => reviewer.reviewType)).toEqual([
      "code",
      "security",
      "ui-ux",
      "code",
    ])
    expect(reviewers.map(reviewer => reviewer.configuration)).toEqual([
      configuration,
      configuration,
      configuration,
      configuration,
    ])
  })
})

describe("wizard steps", () => {
  it("skips steps answered by options in both directions", () => {
    const skipped = ["language", "project"] as const

    expect(nextStep("preflight", ["language"])).toBe("project")
    expect(previousStep("scope", skipped)).toBeNull()
    expect(previousStep("council", ["language", "project", "scope"])).toBeNull()
    expect(numberedSteps(skipped)).toEqual([
      "scope",
      "council",
      "reviewers",
      "prompt",
      "summary",
    ])
  })

  it("still runs preset project and scope steps forward so they get resolved", () => {
    expect(nextStep("preflight", ["language", "project"])).toBe("project")
    expect(nextStep("project", ["language", "project", "scope"])).toBe("scope")
    expect(nextStep("scope", ["language", "project", "scope"])).toBe("council")
  })

  it("never goes back to the requirements check", () => {
    expect(previousStep("language", [])).toBeNull()
    expect(previousStep("project", [])).toBe("language")
    expect(previousStep("summary", [])).toBe("prompt")
  })
})

describe("summarizePrompt", () => {
  it("keeps a short prompt as it is", () => {
    expect(summarizePrompt("One\nTwo\nThree")).toEqual(["One", "Two", "Three"])
  })

  it("cuts a long prompt to three lines ending with an ellipsis", () => {
    expect(summarizePrompt("One\nTwo\nThree\nFour\nFive")).toEqual([
      "One",
      "Two",
      "Three...",
    ])
  })
})

describe("describeScope", () => {
  const scope = (excludedFiles: string[]): ReviewScope => ({
    kind: "uncommitted",
    base: headCommit,
    diffBase: headCommit.hash,
    changedFiles: [
      { path: "src/one.ts", previousPath: null, change: "modified" },
      { path: "src/two.ts", previousPath: null, change: "added" },
    ],
    excludedFiles,
  })

  it("leaves out the excluded files when there are none", () => {
    expect(describeScope(scope([]))).toBe(
      "uncommitted changes on aaaaaaa (2 files)",
    )
  })

  it("counts the excluded secret files", () => {
    expect(describeScope(scope([".env", ".env.local"]))).toBe(
      "uncommitted changes on aaaaaaa (2 files, 2 likely secret files excluded)",
    )
  })
})

describe("list state", () => {
  it("keeps an index inside the list", () => {
    expect(clampIndex(-1, 3)).toBe(0)
    expect(clampIndex(5, 3)).toBe(2)
    expect(clampIndex(1, 3)).toBe(1)
  })

  it("points at the start of an empty list", () => {
    expect(clampIndex(0, 0)).toBe(0)
    expect(clampIndex(4, 0)).toBe(0)
  })

  it("keeps the selected row inside the window", () => {
    expect(visibleWindow(30, 0, 10)).toEqual({ start: 0, end: 10 })
    expect(visibleWindow(30, 15, 10)).toEqual({ start: 10, end: 20 })
    expect(visibleWindow(30, 29, 10)).toEqual({ start: 20, end: 30 })
    expect(visibleWindow(3, 2, 10)).toEqual({ start: 0, end: 3 })
  })
})
