# Security model

The app uses your existing provider logins. It does not manage passwords or tokens.

## Providers during review

App-imposed restrictions during review, not general CLI capabilities:

- 🟢 Allowed
- 🔴 Blocked by app
- 🟡 Limited

| Action       | Codex                   | Claude Code        | Copilot            |
| ------------ | ----------------------- | ------------------ | ------------------ |
| Read/search  | 🟢                      | 🟢                 | 🟢                 |
| Shell        | 🟡 - read-only, offline | 🔴                 | 🔴                 |
| Write        | 🔴                      | 🔴                 | 🔴                 |
| Network      | 🟡 - search not blocked | 🔴                 | 🔴                 |
| MCP          | 🔴                      | 🔴                 | 🔴                 |
| Hooks        | 🔴                      | 🔴                 | 🟢                 |
| Read secrets | 🟡 - CLI defaults       | 🔴 - matched files | 🟡 - CLI-dependent |

## What to know

- Keep passwords, tokens and other secrets out of reviewed files and prompts
- Provider history may remain after review

## Implementation

- [authentication checks](src/providers)
- [provider restrictions](src/execution/agent-commands.ts)
- [secret exclusions](src/scope/excluded-files.ts)
