# Ticket workflow

When the maintainer asks in words to do a ticket from `dev-docs/issues/<feature>/`, run Matt Pocock's current main flow for that one ticket, from grilling through retro. Read the flow from the `ask-matt` skill and each step from its own skill file. A skill the maintainer types leads instead; the repo rules below still apply.

A skill you cannot invoke (user-only): read its `SKILL.md` and follow it, or ask the maintainer to type it when it must run in this session, such as a retro.

## Repo rules on top of the flow

- **Gate:** start only when `Status:` is `ready-for-agent` and every ticket in `Blocked by:` is closed; otherwise report which gate fails.
- **Grill the ticket first:** specs here may not have been grilled. When a decision changes scope, edit the ticket's acceptance criteria, so the spec review sees it; the reasoning goes under `## Comments`.
- **Phases:** stop at each phase boundary, report, and wait for the maintainer's go-ahead.
- **Git:** the maintainer commits. Review the uncommitted working tree, then hand one ready-to-paste commit command.
- **Close:** as the [tracker conventions](issue-tracker.md) define it.
