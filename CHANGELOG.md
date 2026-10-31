# Changelog

All notable changes to this project. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

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

