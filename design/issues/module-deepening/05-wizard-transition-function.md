# 05: Wizard navigation through an explicit transition function

**What to build:** wizard navigation is decided by a small transition function that accepts explicit events. It owns which step comes next, going back, recovery from invalid CLI presets and which dependent answers are invalidated when an earlier answer changes. Rendering no longer shares that responsibility, and callers no longer need to know which answer fields must change together.

**Blocked by:** None (can start immediately)

**Status:** needs-triage

The assessment defers this until wizard navigation next changes; the current flow remains understandable. Promote to `ready-for-agent` when that change is planned.

- [ ] Returning to an earlier step, changing the repository, and recovering from an invalid CLI preset are tested without rendering
- [ ] Changing an answer invalidates exactly the answers that depend on it
- [ ] Keyboard interaction tests that run end to end still pass

## Comments
