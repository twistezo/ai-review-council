# Codebase design assessment

Static assessment dated 2026-11-01. Scope: the application and test structure, excluding the intentionally buggy `demo/bug-farm/`. Tests were not run. The proposals below have not been implemented.

The greatest benefit would come from concentrating ownership of the review lifecycle and state. Explicit dependencies, result types, and the `runReview`, `buildReviewScope`, and `runAgentProcess` modules provide a sound foundation.

## Priorities

| Order | Module | Goal |
| --- | --- | --- |
| 1 | Review execution | Stop agents before removing their inputs |
| 2 | Review progress | One owner of identities, ordering, and state |
| 3 | Provider adapters | Concentrate provider-specific behavior |
| 4 | Report interpretation | Shared rules for orchestration and preview |
| 5 | Wizard transitions | Explicit navigation and answer invalidation rules |

## 1. Review lifecycle

- **Location:** [`run-review.ts`](../../src/review/run-review.ts).
- **Problem:** `Promise.all` can reject after an instruction-loading error while another agent is still running. `finally` then removes the shared workspace before that agent finishes. The interface distinguishes returned agent failures from dependency exceptions without a common guarantee that work has ended.
- **Change:** the review module should own cancellation, waiting for started agents, and cleanup. When the call settles, its agents should have stopped and its workspace should be removed.
- **Validation:** fail one agent during setup while another remains active; remove inputs only after work ends. Preserve cancellation and partial-failure coverage.

## 2. Progress ownership

- **Location:** [`run-review.ts`](../../src/review/run-review.ts), [`run-screen.tsx`](../../src/ui/steps/run-screen.tsx), [`run-progress.ts`](../../src/ui/run-progress.ts).
- **Problem:** the review emits functions that transform caller-owned state. The UI and tests must initialize matching state, know agent identities, and apply updates. Reviewer numbering and table sorting are maintained separately.
- **Change:** the review module should own agent identities, ordering, and progress, and emit snapshots. The UI should format and display them.
- **Validation:** numbering agrees with the report, and progress is observable on success, failure, and cancellation without tests recreating the update mechanism.
- **Dependency:** implement after lifecycle ownership; both changes affect the `runReview` interface.

## 3. Provider adapter locality

- **Location:** [`provider-adapter.ts`](../../src/providers/provider-adapter.ts), [`agent-commands.ts`](../../src/execution/agent-commands.ts), [`agent-events.ts`](../../src/execution/agent-events.ts), [`run-agent.ts`](../../src/execution/run-agent.ts).
- **Problem:** provider detection and model discovery use adapters, while execution uses separate command-builder and parser maps. Provider knowledge is spread across parallel structures.
- **Change:** keep detection, launch configuration, and event interpretation together for each adapter. Expose execution through a narrow interface, retaining the shared process runner inside the implementation. Codex and Claude justify the existing seam with two concrete adapters.
- **Validation:** exercise each adapter through its interface using a controlled test process; preserve checks for launch restrictions and error interpretation.

## 4. Report interpretation

- **Location:** [`run-review.ts`](../../src/review/run-review.ts), [`report-preview.ts`](../../src/review/report-preview.ts).
- **Problem:** orchestration owns Markdown parsing, text trimming, and finding counts. Preview imports its parser from the orchestration module.
- **Change:** concentrate report interpretation in one module used by orchestration and preview.
- **Validation:** exercise preambles, fenced code blocks, missing titles, and finding headings through the shared interpretation interface.

## 5. Wizard transitions

- **Location:** [`app.tsx`](../../src/ui/app.tsx), [`wizard-steps.ts`](../../src/ui/wizard-steps.ts).
- **Problem:** rendering shares responsibility with navigation, recovery from invalid CLI presets, and invalidation of dependent answers. `complete(Partial<WizardState>)` requires callers to know which fields must change together.
- **Change:** when navigation next changes, extract a small transition function accepting explicit events. Concentrate transition rules and answer dependencies there.
- **Validation:** test returning to an earlier step, changing repositories, and recovering from invalid CLI presets without rendering. Preserve end-to-end keyboard interaction tests.
- **Timing:** lower priority; the current flow remains understandable.

## What to preserve

- The scope-resolution interface in [`build-review-scope.ts`](../../src/scope/build-review-scope.ts).
- Injected process dependencies and test adapters.
- Separation of agent instructions in `docs/` from orchestration; the flow description remains in [`ARCHITECTURE.md`](../../ARCHITECTURE.md).
- Small UI modules with clear responsibilities at their interfaces; a short implementation alone does not justify merging.
