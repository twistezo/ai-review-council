import { afterEach, describe, expect, it, vi } from "vitest"

import { printOutcome } from "./print-outcome.js"
import type { ReviewerReport } from "./review/review-messages.js"

const failedReviewer: ReviewerReport = {
  reviewer: {
    number: 1,
    configuration: {
      provider: "claude",
      model: "haiku",
      modelLabel: "Haiku 5.5",
      effort: "low",
    },
    reviewType: "code",
  },
  report: null,
  error: "auth expired",
}

const captureStderr = () =>
  vi.spyOn(console, "error").mockImplementation(() => undefined)

afterEach(() => {
  vi.restoreAllMocks()
})

describe("printOutcome", () => {
  it("exits 0 and prints nothing after a clean report", () => {
    const stderr = captureStderr()

    expect(
      printOutcome({
        kind: "finished",
        result: { kind: "reported", report: "# Review", reviewerReports: [] },
      }),
    ).toBe(0)
    expect(stderr).not.toHaveBeenCalled()
  })

  it("exits 0 and names failed reviewers when the council still reported", () => {
    const stderr = captureStderr()

    expect(
      printOutcome({
        kind: "finished",
        result: {
          kind: "reported",
          report: "# Review",
          reviewerReports: [failedReviewer],
        },
      }),
    ).toBe(0)
    expect(stderr).toHaveBeenCalledExactlyOnceWith(
      "\nSome reviewers failed:\nReviewer 1 · Claude · Haiku 5.5 · low · code: auth expired\n",
    )
  })

  it("exits 1 with the reason when the council failed", () => {
    const stderr = captureStderr()

    expect(
      printOutcome({
        kind: "finished",
        result: {
          kind: "council-failed",
          error: "timeout",
          reviewerReports: [failedReviewer],
        },
      }),
    ).toBe(1)
    expect(stderr).toHaveBeenCalledExactlyOnceWith(
      "\nThe council failed: timeout\n",
    )
  })

  it("exits 1 when every reviewer failed", () => {
    const stderr = captureStderr()

    expect(
      printOutcome({
        kind: "finished",
        result: { kind: "reviewers-failed", reviewerReports: [failedReviewer] },
      }),
    ).toBe(1)
    expect(stderr).toHaveBeenCalledExactlyOnceWith(
      "\nEvery reviewer failed, so the council did not run:\nReviewer 1 · Claude · Haiku 5.5 · low · code: auth expired\n",
    )
  })

  it("exits 130 when the run was cancelled", () => {
    const stderr = captureStderr()

    expect(
      printOutcome({ kind: "finished", result: { kind: "cancelled" } }),
    ).toBe(130)
    expect(stderr).toHaveBeenCalledExactlyOnceWith("\nReview cancelled.\n")
  })

  it("exits 1 with the error when the review could not run", () => {
    const stderr = captureStderr()

    expect(
      printOutcome({
        kind: "failed",
        error: "Could not read the diff from Git",
      }),
    ).toBe(1)
    expect(stderr).toHaveBeenCalledExactlyOnceWith(
      "\nThe review could not run: Could not read the diff from Git",
    )
  })

  it("exits 130 without a message when the wizard was cancelled", () => {
    const stderr = captureStderr()

    expect(printOutcome({ kind: "cancelled" })).toBe(130)
    expect(stderr).not.toHaveBeenCalled()
  })

  it("exits 1 without a message when preflight blocked the run", () => {
    const stderr = captureStderr()

    expect(printOutcome({ kind: "blocked" })).toBe(1)
    expect(stderr).not.toHaveBeenCalled()
  })
})
