# 02: Review run owns reviewer identities, ordering and progress

**What to build:** the review run emits progress snapshots of every agent (reviewers and the council agent) instead of update functions that transform state owned by the caller. Reviewer identities, numbering and table order are defined in one place, so the numbers on the progress table always match those in the final report. The run screen only formats and displays the snapshots.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] The run screen no longer builds initial rows, knows agent identities or applies updates
- [ ] Reviewer numbering and progress table ordering come from a single rule; a test shows the numbers agree with the reviewer numbers in the council message
- [ ] Progress is observable through the run interface on success, partial failure (including the council agent's "no reviewer reports" state), cancellation and token usage
- [ ] Tests no longer recreate the update mechanism to observe progress
- [ ] Moving the event-to-progress transition alone does not satisfy this ticket: callers must need less knowledge, not the same knowledge in another module
- [ ] Presentation tests for status text, elapsed time and tones stay

## Comments
