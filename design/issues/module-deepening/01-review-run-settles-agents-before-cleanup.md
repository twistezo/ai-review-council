# 01: Review run settles every started agent before removing the workspace

**What to build:** when a review run settles, whether with a result, a dependency exception or cancellation, every agent it started has stopped, and only then is the shared workspace with the prepared diff removed. Today, if reading one reviewer's instructions throws while another reviewer is still reading the review scope, the run rejects and deletes the workspace under the active reviewer. The review module owns cancellation, waiting for started agents and cleanup; the caller's interface stays the same.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A test through the review run interface reproduces the sequence first: reviewer A stays active while loading reviewer B's instructions throws; it fails before the fix (the risk comes from control-flow analysis and was never reproduced)
- [ ] After the fix, workspace cleanup happens only after reviewer A finishes, and the run still surfaces the original error
- [ ] Remaining agents are cancelled when one agent's setup throws, rather than left running to completion
- [ ] Existing cancellation and partial-failure coverage still passes
- [ ] No new seam: the test uses the existing injected execution and workspace dependencies

## Comments
