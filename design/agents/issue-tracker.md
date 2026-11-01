# Local issue tracker

Use these repository paths instead of skill defaults such as `.scratch/`.

- Feature directory: `design/issues/<feature-slug>/`.
- Spec: `<feature-directory>/spec.md`.
- Tickets: `<feature-directory>/<NN>-<slug>.md`, numbered from `01` in dependency order; one file per ticket.
- Each ticket includes acceptance criteria, `Status:` and `Blocked by:` with ticket numbers or `None`.
- Use [triage statuses](triage-labels.md).
- Append discussion under `## Comments`.

Publishing means writing local files. Fetching means reading the referenced ticket.
When only a ticket number is provided, resolve it within the current feature.
