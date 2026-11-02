# Copilot reviewer

Status: implemented, 2026-11-02. Live launch smoke remains manual under repository guardrails.

Implementation deviations:

- The current dependency list no longer includes the Copilot SDK. Authentication is checked by the runtime at review start; preflight explicitly reports this instead of claiming a successful login check.
- Per maintainer decision, do not inspect or block Copilot hooks and do not require global settings changes. No documented per-process hooks override was found.
- Token usage remains unknown because the captured JSONL result contains no verified token total.
- The report is the `assistant.message` with `phase: "final_answer"`; `session.error` is not mapped because the capture has none. Failures arrive as a non-zero `result.exitCode`.
- `--no-custom-instructions` is not passed: the reviewed repository's `AGENTS.md` and skills load, as for Codex and Claude Code.
- CLI 1.0.105 help documents `shell`, `write`, MCP and `url` permission kinds only. `--allow-tool=read` and the `read(...)` secret deny rules stay unverified until a live smoke.
- Sanitized event shapes from the capture live in [`agent-events.test.ts`](../../src/execution/agent-events.test.ts).
- Automated typecheck/build and tests are used for integration. The live fixture JSONL supplied by the maintainer establishes the parser contract; no additional account-backed review is launched by the agent.

Add GitHub Copilot as a reviewer using the existing provider and CLI execution patterns. Keep Codex or Claude Code as the council agent.

## Scope

| Decision           | First version                                                                  |
| ------------------ | ------------------------------------------------------------------------------ |
| Role               | Reviewer only; never council agent                                             |
| Account baseline   | The tested Copilot Free account; no plan detection or subscription management  |
| Model              | One option: `auto`, displayed as `Auto`                                        |
| Effort             | `null`; never send a reasoning-effort argument for Auto                        |
| Review types       | Existing `code`, `security`, and `ui-ux` instructions                          |
| Review scope       | Existing uncommitted, since-commit, and full-codebase scopes                   |
| Execution          | Noninteractive Copilot CLI, through the existing process runner                |
| Authentication     | Existing local Copilot login or its `gh` fallback; no application-owned tokens |
| Limits and billing | Out of scope; runtime failures are reported through existing error handling    |

Free is the supported test baseline, not a promise that an arbitrary signed-in account is free or cannot incur charges. Do not infer the plan from an empty model catalog or a GitHub login.

Use the terms in [GLOSSARY.md](GLOSSARY.md). Development plans belong here; `docs/` contains shipped agent instructions.

## Existing integration points

| File                                           | Required change                                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/domain/review-session.ts`                 | Add `copilot`; constrain its configuration to Auto/no effort and reject it as council       |
| `src/providers/copilot-adapter.ts`             | Add status detection and the fixed Auto option                                              |
| `src/providers/provider-adapter.ts`            | Add the display name                                                                        |
| `src/app-services.ts`                          | Register the adapter                                                                        |
| `src/preflight/run-preflight.ts`               | Report Copilot availability; require a working council-capable provider                     |
| `src/ui/app.tsx`                               | Pass council-eligible models to the council step; all reviewer models to the reviewers step |
| `src/execution/agent-commands.ts`              | Add the Copilot command builder and dispatch entries                                        |
| `src/execution/agent-events.ts`                | Parse Copilot JSONL into the existing event contract                                        |
| `README.md`, `package.json`, `ARCHITECTURE.md` | Adjust provider requirements and descriptions where affected                                |

`ProviderAdapter` currently owns status and catalog only. Execution stays in the existing builder/parser maps. Do not move other providers or implement the unrelated provider-adapter refactor.

`@github/copilot-sdk` was present during planning but is absent from the current dependency list. Reuse it only if needed for a metadata-only authentication check; no dependency upgrade, new SDK execution layer, or SDK worker is part of this feature.

## Implementation steps

The maintainer authorized all implementation steps without intermediate confirmation; review each step and the complete change.

### 1. Verify the minimal CLI contract

- Inspect the installed CLI version/help and capture a small sanitized JSONL review result using `demo/bug-farm` only as the explicit test target. Preserve its planted defects.
- Verify prompt delivery through stdin, streaming JSONL, explicit `auto`, final-report boundaries, and the minimum read/search permissions needed for the prepared diff and source files.
- Prefer `copilot` on `PATH`; only when missing, detect `gh copilot --`. Keep the selected command for execution. GitHub CLI may download Copilot if absent; document first-run setup in README.
- Determine the metadata-only login check supported by that CLI version. If there is no suitable CLI command, use SDK `getAuthStatus()` against the selected runtime where supported; do not use a model prompt as a login probe or silently check a different account/runtime.
- Verify how to pass the shipped reviewer instructions without a TUI. Prefer a supported instruction channel; otherwise include the instructions explicitly before the existing reviewer message.
- Identify the actual read/search, hook, MCP, and write controls. Match the protections already used by the other providers; do not introduce a broader security redesign.

Acceptance: record the supported command, auth-check mechanism, instruction delivery, and sanitized event examples next to the implementation tests. If the installed CLI cannot satisfy these contracts, report that concrete blocker before adding abstractions or weakening permissions.

### 2. Add the provider and restrict its role

- Add `copilot` to provider IDs and display names.
- Return one fixed model `{ id: 'auto', label: 'Auto', efforts: [] }` after a successful status check. Do not query `listModels()`; the user explicitly restricted this version to Auto.
- Treat missing CLI, failed authentication, and metadata timeouts through the existing unavailable-provider flow.
- Keep Copilot failures nonfatal when Codex or Claude Code is usable.
- Require at least one available Codex or Claude Code model for council. Copilot alone cannot satisfy preflight.
- Filter the council picker and reject a Copilot council configuration in domain validation, not only in the UI.
- Reject a Copilot named model or non-null effort in domain validation. Keep the existing default effort presentation rather than adding a new selector behavior.

Acceptance: reviewers can select Copilot/Auto/default; council cannot. Copilot-only installation gets an actionable council-provider requirement, not an empty council screen.

### 3. Add execution and progress parsing

- Add `buildCopilotProcess` using the verified CLI contract and existing `AgentLaunch` fields. Send the review message through stdin, as with the other providers.
- Use the existing reviewer instructions, scope, diff, and optional prompt. Do not prepend `/review`: the app already assigns the reviewer role and review type, and no Copilot-specific workflow is required for provider parity.
- Pass `--model auto`; omit effort entirely. Keep tools read-only and noninteractive using the controls verified in step 1. Allow access to the prepared review directory as needed, without broadening other providers.
- Add `parseCopilotLine` and map verified events to `session`, `read`, `message`, `usage`, `completed`, and `error`.
- Use authoritative final text rather than a reasoning fragment or an unfinished streaming delta. If deltas require accumulation, use the smallest Copilot-specific change needed.
- Preserve `runAgentProcess` timeout, process-group cancellation, stderr handling, and report validation. No second runner, resume feature, automatic retry, or new shutdown framework.
- Emit token usage once from a verified total, or as non-overlapping increments. `applyAgentEvent` adds usage values, so repeated cumulative counters must not be forwarded unchanged. If no trustworthy total is available, leave usage unknown.
- Surface authentication, quota, permission, network, and unsupported-option failures through existing reviewer failure handling. Do not treat them as an empty successful review.

Acceptance: a Copilot reviewer returns a report through the existing pipeline; Codex or Claude Code verifies it as council. Cancellation and timeout use the same path as existing providers.

### 4. Validate and update user documentation

| Use case                                        | Required coverage                                               |
| ----------------------------------------------- | --------------------------------------------------------------- |
| Copilot logged in, no named model catalog       | Auto remains selectable; no catalog request needed              |
| Missing CLI or failed auth                      | Actionable unavailable status; working providers remain usable  |
| Only Copilot available                          | Preflight blocks because council requires Codex or Claude Code  |
| Copilot council / named model / explicit effort | Invalid configuration rejected                                  |
| Reviewer scope and instructions                 | Existing diff/message/readable-directory contract is preserved  |
| Successful / empty / failed output              | Correct report or existing failure path                         |
| Streaming and usage                             | No partial final report or double-counted tokens                |
| Cancel / timeout                                | Existing cleanup behavior includes the Copilot process tree     |
| Mixed-provider review                           | Copilot reviewer and Codex/Claude council complete the pipeline |

- Extend existing provider, preflight, command, event, wizard, and execution tests where the behavior belongs. Reuse existing fake processes; no live-account tests in the normal suite.
- Run `npm run typecheck`, relevant tests, then `npm test` and `npm run build` once the integration is complete.
- Manually smoke-test the intentional fixture with Copilot Free/Auto and one existing provider as council. Check all scope builders with automated tests; do not require multiple paid live runs merely to repeat them.
- Update requirements: Copilot is optional for reviewers; Codex or Claude Code remains required for council. Replace the README claim that all usage necessarily falls under 5h/weekly limits with provider-dependent subscription usage.
- Do not change the release version, publish, modify Git state, or add quota UI.

Acceptance: checks pass, fixture remains unchanged, and the documented setup matches the tested runtime.

## Self-grill

Applied Matt Pocock's installed `grilling` skill as a self-interview, as requested. Answers below are proposed implementation decisions; user constraints take precedence over the skill's normal interactive interview.

### Round 1: product boundaries

| Question                                               | Answer                                                                             |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Are we reproducing GitHub PR review?                   | No. This is a local reviewer provider inside this application's existing workflow. |
| Can Copilot be council?                                | No; excluded from both selection and valid configuration.                          |
| What happens with only Copilot installed?              | Block at preflight and explain the council requirement.                            |
| Does Free require plan detection?                      | No. Support the tested Free/Auto flow without guessing plan or payer.              |
| Do we implement limits, spend, or model discovery now? | No. These were explicitly left outside this provider change.                       |

### Round 2: integration choices

| Question                                              | Answer                                                                                                                       |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Does “effort auto” mean a literal effort argument?    | No. Model is `auto`; effort is absent. The real CLI rejected `high` for Auto.                                                |
| Is an empty SDK model list a blocker?                 | No. This version deliberately exposes only the Auto route; auth still must succeed.                                          |
| Why not an SDK worker or a new execution abstraction? | Existing process builders and parsers already fit the task. Extend them.                                                     |
| Why not use `/review` automatically?                  | Our instructions already define code/security/UI-UX review and exact scope. Preserve that contract like the other providers. |
| Must `gh` alone be sufficient?                        | No new installer/discovery layer. Follow the existing CLI-on-PATH prerequisite and provide manual setup guidance.            |
| Can we assume `gh` and Copilot use the same account?  | No. Let the selected runtime resolve login; do not extract tokens or infer identity from repository ownership.               |

### Round 3: failure and completion

| Question                                                     | Answer                                                                                                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| What if Auto chooses a different underlying model next time? | The selected configuration remains Auto. Do not relabel it as a fixed model or promise repeatability.                                      |
| Does no report mean no findings?                             | No. Keep existing empty-report failure semantics.                                                                                          |
| What if usage fields cannot be reconciled?                   | Keep tokens unknown; do not invent totals or convert request cost to USD.                                                                  |
| Do we fix existing lifecycle/security issues while here?     | No. Use existing mechanisms; change shared code only where Copilot integration requires it.                                                |
| Is the runtime/event contract fully verified already?        | No. Step 1 must verify JSONL/auth/instruction details; earlier terminal smoke tests prove Auto review works, not every integration detail. |
| What is done?                                                | Reviewer-only Auto works in the existing pipeline, council restrictions hold, failures behave consistently, and checks/manual smoke pass.  |

## Evidence

- Local tests in this chat: authenticated Free account; SDK returned `models: []`; CLI Auto produced a review; explicit effort with Auto failed.
- [Copilot programmatic CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/automate-copilot-cli/run-cli-programmatically)
- [Copilot authentication precedence](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli)
- Installed SDK types in `node_modules/@github/copilot-sdk/dist/types.d.ts`; use the installed version's API, not snippets from another release.
