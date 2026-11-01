# Local issue tracker

Use these repository paths instead of skill defaults such as `.scratch/`.

- Feature directory: `dev-docs/issues/<feature-slug>/`.
- Spec: `<feature-directory>/spec.md`.
- Tickets: `<feature-directory>/<NN>-<slug>.md`, numbered from `01` in dependency order; one file per ticket.
- Each ticket includes acceptance criteria, `Status:` and `Blocked by:` with ticket numbers or `None`.
- `Status:` is a [triage status](triage-labels.md), or `done` once closed; a ticket blocked only by `done` tickets is on the frontier.
- Append discussion under `## Comments`.

Publishing means writing local files. Fetching means reading the referenced ticket.
When only a ticket number is provided, resolve it within the current feature.
Closing means ticking the met acceptance criteria, appending the outcome under `## Comments` and setting `Status: done`.
