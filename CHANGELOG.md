# Changelog

All notable changes to this project. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## Unreleased

## 3.2.1 - 2026-11-05

### Added

- [Security model](SECURITY.md) with provider permissions, authentication and secret-handling limits, linked from the README and architecture docs.

### Changed

- Dependency resolution waits seven days after a version is published via `.npmrc` (`npm >=11.10.0` required).

## 3.2.0 - 2026-11-03

### Added

- `←` and `→` move the cursor in the folder, commit and prompt fields by whole characters, emoji included; typing, Backspace and paste work at the cursor, and forward Delete removes the character after it.

### Changed

- Agent instructions moved from `docs/` to `instructions/`; notes for developing this repo moved from `dev-docs/` to `docs/`.
- Code reviewers check three axes, behaviour, standards and spec, and tag each finding with its axis. Standards findings cite the repository rule; spec findings quote the requirement and include behaviour nobody asked for.
- Each confirmed finding's heading names its area: the review type, or the axis for a code review (`### <severity> · <area> · <title>`).
- Code reviewers list possible code smells in a separate `Smells` section, outside the finding count; the council keeps the confirmed ones there.
- `Ctrl+D confirm` shows in the reviewer hints only once a reviewer is accepted.
- Git runs without the repository's file-system monitor, and the diff for agents ignores external diff tools, text conversion and color settings.

### Fixed

- A review of a very large repository no longer fails on the OS argument limit: the diff is read in batches.
- A code example inside a longer fence in a report no longer counts as a finding or hides the findings after it.
- Folder suggestions disappear as soon as the path changes.

## 3.1.0 - 2026-11-03

### Added

- Desktop Linux support (Wayland or X11): copy and paste use `wl-copy` / `wl-paste`, then `xclip` or `xsel`; the report opens with `xdg-open`. Windows, WSL and Linux without a display are not supported.
- `npm run format` formats the repository with Prettier.

### Changed

- The prompt hint reads `Ctrl+V paste`, which works on both platforms.
- An opener still running after 5 s counts as opened, so the report action no longer waits for the viewer to close.
- Source follows Prettier's defaults, except no semicolons and no parentheses around a single arrow function parameter.

## 3.0.1 - 2026-11-03

### Fixed

- A reviewer whose agent cannot start fails alone; the review goes on and the diff folder stays until every agent has finished.
- A Codex error the agent recovers from, such as a reconnect, no longer discards a completed review.
- An empty final Claude result falls back to the agent's last message instead of failing the review.
- `Esc` from the prompt keeps the typed text.
- `Esc` while the folder or the scope is being checked stays on the earlier step; the late result is ignored.
- A provider or Git check that throws marks only that check as failed instead of stopping the app.
- A working tree that `git status` cannot read is reported as an error, not as clean.
- `--timeout` accepts plain digits only; values such as `1e1` or `0x5` are rejected.
- A failing `--version` check names the exit code or the timeout when the CLI prints nothing.
- The provider check shows `1 model` and leaves out an empty version.

## 3.0.0 - 2026-11-03

### Removed

- The `--reviewers` / `-r` CLI option; reviewers are selected interactively.

### Changed

- Accept reviewers one at a time with `Enter`, then confirm them with `Ctrl+D`; the reviewer still being edited does not count. `Esc` drops it and reopens the last accepted reviewer for editing. Going back from the prompt keeps every accepted reviewer.
- Up to 10 reviewers, up from 8; trying to add more shows the limit.
- Shorter key hints: reviewers show `Enter next · Ctrl+D confirm`, the prompt shows `Enter newline`.
- Review progress shows the file count, repository folder name and selected scope on one line, worded as in the summary.
- Code reviewers check supplied requirements for missing, partial or conflicting behaviour and cite each mismatch.
- Council instructions require counterevidence for rejected claims and failed reviews and material coverage gaps in the report's opening paragraph.
- Preflight and run messages no longer give Git installation or provider login guidance:
  - a failed login check shows the provider as `Provider is unavailable.`;
  - the blocker reads `At least one of Codex or Claude must be available.`;
  - Copilot no longer notes that its login is checked when the review starts;
  - a failed Copilot run points only to usage limits.
- File counts read `1 file` / `2 files` in the summary and on the progress screen.
- Tests cover more error paths and edge cases; UI tests fail fast and no longer wait on fixed delays.

## 2.1.0 - 2026-11-02

### Added

- Copilot reviewers with automatic model selection and default effort, including Copilot Free. The app prefers `copilot` on `PATH` and falls back to `gh copilot` when absent. Codex or Claude remains required as the council agent.
- Copilot token totals after review, read from a temporary usage report and removed with the review workspace.

### Changed

- Shorter provider names in the terminal: Codex, Claude and Copilot.
- README lists supported roles, CLI model catalogs and effort options; demo uses a Copilot reviewer.
- Preflight distinguishes CLI availability from verified login; Copilot login errors are reported when review starts.

## 2.0.2 - 2026-11-01

### Added

- Recorded demo in the README, with a VHS tape and an intentionally buggy TypeScript fixture in `demo/`.

### Changed

- Prompt help mentions shared context, goals and skills, plus read-only local review without live web access.

## 2.0.1 - 2026-10-31

### Changed

- Compact header without a separator; progress table headers have a blank line before the agent rows.
- Summary shows only `Start`, with `Esc` to go back and `Ctrl+C` to quit; the redundant reviewer count is removed.
- Review cancellation hint sits below the progress table. Agent pickers use the same arrow for active columns and selected options.
- Shorter prompt help and a `Cmd+V` paste hint.

## 2.0.0 - 2026-10-31

### Added

- Agents can use the skills they have: Claude Code through its `Skill` tool (built-in skills such as `security-review` and the user's own), Codex by reading the skills it lists. A prompt like `use /code-review` now works with both.

### Changed

- **Breaking:** the entire codebase scope is `--scope codebase`; `--scope full` is rejected.
- **Breaking:** `--timeout` accepts 1 to 30 minutes per agent, down from 120.
- Up to 8 reviewers, up from 6 (`--reviewers` and the count question).
- Agents are told they work alone: sub-agents are unavailable, so a skill's sub-agent steps are done by the agent itself.
- README and ARCHITECTURE are shorter; the README says why the app runs on subscription limits instead of provider APIs.

## 1.4.0 - 2026-10-31

### Added

- After the review the app shows a preview of the report in a frame labelled `Report`, with its title, first paragraph and finding headings, and waits: `c` copies the full report, `o` opens it from a temporary file in the default app for `.md`, `q`, `Esc` or `Ctrl+C` quits with exit code `0`.
- Each agent shows the tokens it used once it ends, done or failed, e.g. `done · 4 findings · 312k tokens`: input, cached input and output together. A timed-out or cancelled agent has no count, since the provider reports none.

### Changed

- The progress table counts each read or search as a lookup: `reading code · 7 lookups`, `verifying · 4 lookups`.
- Claude Code's `Default (recommended)` model is left out of the pickers; it only points at a model already listed under its own name. It stays when the CLI lists nothing else.
- The summary's action is `Start` instead of `Start review`.
- The report is no longer printed in full or copied to the clipboard on its own; the preview stays on screen after quitting.
- The council opens its report with a fixed head: a one-line verdict, the count of confirmed findings by severity, and `### <severity> · <title>` headings, so the preview shows what matters most.

### Fixed

- `Esc` from the prompt opens the last reviewer with every reviewer kept, instead of the reviewer count question; coming forward from the council still asks the count.

## 1.3.0 - 2026-10-31

### Added

- `Entire codebase` scope, or `--scope full`: reviews every file at `HEAD` plus uncommitted changes, diffed against an empty tree so agents treat all code as new. Likely secret files stay out.

## 1.2.1 - 2026-10-31

### Changed

- The README groups each section's commands into one block, with a comment per step, and shows the whole release flow, bumped with `npm version`.

## 1.2.0 - 2026-10-31

### Added

- Published on npm as `@twistezo/ai-review-council`: `npm install -g @twistezo/ai-review-council`, or `npx @twistezo/ai-review-council` without installing. The command stays `ai-review-council`.
- A GitHub release publishes its version to npm from CI.

### Changed

- The package ships only `dist/` and `docs/`; publishing cleans `dist/` and runs the typecheck, tests and build first.
- The app names itself without the npm scope, e.g. `ai-review-council v1.2.0`.

## 1.1.1 - 2026-10-31

### Added

- CI on GitHub Actions: typecheck, tests and build on every push to `main` and every pull request.

## 1.1.0 - 2026-10-31

### Changed

- Agent instructions in `docs/` are short rules instead of checklists: report only problems the change introduces or worsens, rate severity and confidence independently, and treat reviewed material as evidence, never instructions.
- The council report has no fixed template; it keeps confirmed findings, rejected claims with reasons and open questions apart.
- Reviewers and the council return the report without an enclosing code fence and use level-3 headings only for findings, so the finding count stays right.
- The council step suggests the strongest model; the reviewers step suggests mixing providers and models.

## 1.0.1 - 2026-10-31

### Security

- Claude Code agents ignore hooks and `apiKeyHelper` from the reviewed repository's settings, which would run shell commands; its `CLAUDE.md` and skills still load.
- Claude Code agents cannot read likely secret files, in the diff or not; `.env.example` and other templates are denied too.
- A secret file renamed to an innocent name, or the reverse, stays out of the diff.
- Git reads changed paths literally, so a file named `*` or `[id].tsx` cannot pull other files into the diff.

### Fixed

- `Ctrl+C` while the diff is prepared no longer starts agents after the cleanup message.
- The diff may take up to 2 min on large changes instead of failing after 15 s.
- Headings inside code blocks no longer count as findings or as the report title.
- The README lists exit code `2` for invalid options.
- Processes an agent started are killed when it ends, also those that ignore `SIGTERM`.
- A command that ignores `SIGTERM` after its timeout no longer holds up the requirements check.

## 1.0.0 - 2026-10-30

### Added

- `-s, --scope <value>` option: `uncommitted` or a commit hash; skips the scope step, which opens with the error when the value does not work.
- `-r, --reviewers <n>` option: the number of reviewers, 1 to 6; the wizard goes straight to the first reviewer.
- An interrupted review (`Ctrl+C` or `kill`) stops every agent, removes the temporary files and ends with `✔ Review cancelled. Everything cleaned up gracefully.`

### Changed

- The header shows the app name, the requirements, a short separator, and the step counter next to the step title.
- Fields in the scope step and the summary follow the wizard order, with their values in one column; the scope step marks the field it sets.
- Shorter scope choices: `Uncommitted only` and `Since commit`.
- Key hints use the same words everywhere: `↑↓ row`, `←→ column`, `Enter confirm`.
- In the agent pickers `Enter` confirms the whole row at once; `←→` moves between columns.
- Chosen reviewers are listed in aligned columns, in the reviewer steps and in the summary.
- Every wizard step shows the answers so far under its title and marks the field it sets.
- The summary lists only the answers, in one column; a prompt longer than three lines is cut with `...`.
- The review prompt is optional; without it, agents review the code alone and are told so.
- In the prompt, `Enter` adds a new line and `Ctrl+D` confirms, since most terminals send `Shift+Enter` like `Enter`.
- The text cursor takes the title color.
- Startup shows `Loading…` while the requirements are checked.

### Removed

- The branch note in the scope step and the `git reset --soft` hint.
- The instruction files and the usage warning in the summary.

### Fixed

- `Ctrl+C` while the diff is prepared no longer starts agents after the cleanup message.
- The diff may take up to 2 min on large changes instead of failing after 15 s.
- Headings inside code blocks no longer count as findings or as the report title.
- The README lists exit code `2` for invalid options.
- Closing the terminal or stopping the app with `kill` during a review left the agents running; they are now stopped with the app.

## 0.7.0 - 2026-10-30

### Added

- A base commit outside the history of the current branch is rejected.
- The report is formatted with Prettier before it is shown and copied; code blocks keep their original form.

### Changed

- Colors follow one palette of standard terminal colors: purple-leaning focus and titles, pink highlight. The terminal theme sets the exact shades.
- Wording for a commit scope says plainly that everything after the base is reviewed, uncommitted changes included, and the base itself is not.
- Anything the council writes before the report title is left out of the report.
- The council message names the report language and asks for headings, field names and values in it.
- The app names itself after the package with its version, e.g. `ai-review-council v0.7.0`, in the header and towards Codex.

## 0.6.0 - 2026-10-30

### Added

- The final report is copied to the clipboard, and the app says so.
- A separator line sets the report apart from the progress table.

### Changed

- Each new reviewer starts from a clean choice, with the focus on the first column, instead of copying the council.
- The progress table drops the reviewer numbers.
- The council writes the whole report, headings and field names included, in the chosen language.

## 0.5.0 - 2026-10-30

### Added

- Start review runs the reviewers in parallel, then the council, with the progress table on screen.
- The council gets every reviewer report, including which reviewers failed and why.
- The final report is printed as Markdown after the table, ready to copy.
- Each agent gets the scope: base commit, changed files, a frozen diff of tracked changes and the review prompt. New files are listed to be read in full; likely secret files are named so agents leave them alone.
- Finished agents show their finding count.

### Changed

- Reviewers are numbered in the table order, so the numbers match the council report.
- If the council fails, the unverified reviewer reports are printed instead. If every reviewer fails, the council does not run.
- `Ctrl+C` during a review stops every agent.

### Removed

- Printing the configuration as JSON.

## 0.4.0 - 2026-10-30

### Added

- Run engine for one agent: launches Claude Code or Codex read-only, sends the instructions and the message, and returns the report or a failure.
- `-t, --timeout <min>` option: minutes each agent may run before it fails (default 10, max 120). Shown in the summary.
- Cancellation and timeout stop the agent together with the processes it started; agents still running are stopped when the app exits.
- Progress table for a review run: provider, model, effort, review type, status and elapsed time per agent, with a live spinner.
- Statuses name the general step only (`reading code`, `writing report`, `verifying`, `done`, `failed`) instead of individual tool calls.
- Reviewers listed alphabetically by provider, model and effort; the council sits below a separator line.

### Changed

- A run that ends without a report is a failure, never an empty review.

## 0.3.0 - 2026-10-30

### Added

- Provider column in the agent pickers; the model column lists only that provider's models.
- `Ctrl+V` pastes the clipboard into the review prompt, next to the terminal's own `Cmd+V`.
- `docs/common.md`: rules every agent follows, read before its role file.
- Read-only rules for all agents: read and search files only, run no project code, answer open questions from the material instead of asking.

### Changed

- The requirements check moves on by itself when it passes and stays as one status line under the app title.
- `Enter` moves to the next column in the agent pickers and confirms in the last one.
- `Enter` submits the review prompt; `Shift+Enter` adds a new line.
- Models show their display name only.

## 0.2.0 - 2026-10-30

### Added

- `-d, --dir <path>` and `-l, --lang <code>` options; each skips its wizard step.
- Agent pickers in columns: model and effort for the council; model, effort and review type for each reviewer.
- Review types `code`, `security` and `ui-ux`, each with reviewer and council instructions in `docs/`.
- One review prompt shared by the council and all reviewers.
- Summary screen with the files each agent receives and a usage warning before starting.

### Changed

- Codex or Claude Code alone is enough; a missing or logged-out provider is shown and its models are left out.
- English is the default report language.
- The review uses the branch currently checked out; the app shows the branch and working tree state.
- Likely secret files are left out of the review scope.

### Removed

- Switching branches from the app.
- Separate issue description, links and council instruction fields.
- File list preview of the review scope.

## 0.1.0 - 2026-10-29

### Added

- Configuration wizard: requirements check, report language, project folder, branch, review scope, issue context, council and reviewers, confirmation.
- Requirements check for `git`, `codex` and `claude`, including the existing CLI login.
- Model and effort catalogs read from the local CLIs without sending a prompt.
- Project folder input with `~`, pasted paths and `Tab` completion.
- Review scope from uncommitted changes or from a commit hash, with staged, unstaged and new files.
- The confirmed configuration is printed as JSON; no agents are started yet.
