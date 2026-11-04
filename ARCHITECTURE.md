# Architecture

## Repository layout

| Path                            | Holds                                   |
| ------------------------------- | --------------------------------------- |
| [`src/`](src)                   | App source and tests                    |
| [`instructions/`](instructions) | Agent instructions shipped with the app |
| [`demo/`](demo)                 | Demo recording and its review target    |
| [`docs/`](docs)                 | Documentation for developing this repo  |

## Flow

Independent reviews become one verified, actionable report.

```text
CLI options + wizard
         │
         ▼
  validated session
  repository, scope, agents, task description
         │
         ▼
  review workspace
  frozen diff + changed-file list
         │
         ├──► reviewer 1 ──┐
         ├──► reviewer 2 ──┤  independent, parallel
         └──► reviewer N ──┘
                           │
                           ▼
                  reports + failures
                           │
              ┌────────────┴─────────────┐
              │                          │
       at least one report           all failed
              │                          │
              ▼                          ▼
           council                 stop with error
   verify against repository
   merge and prioritize findings
              │
       ┌──────┴────────┐
       │               │
    success          failure
       │               │
       ▼               ▼
 verified report   unverified reviewer reports
       │               │
       └───────┬───────┘
               ▼
       terminal preview
       copy / open Markdown
```

- [`scope/`](src/scope) resolves the review scope; [`review/`](src/review) prepares inputs, coordinates agents and handles reports.
- [`instructions/`](src/instructions) assembles each agent's rules; [`execution/`](src/execution) runs the CLI processes and handles progress, timeouts and cancellation.
- [`platform/`](src/platform) picks the copy, paste and open tools for macOS or desktop Linux; add a platform there.
- The diff is frozen; agents read current repository files. Reviewers do not see each other's reports; the council receives their results and failures.

## Review instructions

All agents receive [`instructions/common.md`](instructions/common.md), their role and review type (`code`, `security`, `ui-ux`):

| Role                     | Instructions                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| Reviewer: find issues    | [`reviewer.md`](instructions/reviewer/reviewer.md) + `instructions/reviewer/<type>-review.md`            |
| Council: verify findings | [`council.md`](instructions/council/council.md) + selected `instructions/council/<type>-review.md` files |
