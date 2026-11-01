# 04: Each provider adapter owns detection, launch and event interpretation

**What to build:** Codex and Claude Code each keep all their provider rules in their adapter: CLI detection, the model catalog, how an agent is launched and how its output lines are interpreted. Execution goes through a narrow adapter interface that hides the command and parser pair, while the shared process runner (timeout, cancellation, cleanup) stays one implementation behind it. Today execution selects behavior from separate command builder and line parser maps.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Changing one provider's behavior touches only its adapter
- [ ] Callers run an agent without knowing which command builder and parser belong together
- [ ] Each adapter is exercised through the execution interface with a controlled test process: command, events and result work together
- [ ] Launch restriction checks stay: read and search only tools, hooks and `apiKeyHelper` off, no MCP servers, secret read deny rules, readable directories
- [ ] Error interpretation checks stay
- [ ] Out of scope: resume support, a plugin registry or other hypothetical interface growth; two real adapters justify the seam

## Comments
