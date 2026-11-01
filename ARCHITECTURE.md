# Architecture

## Repository layout

| Path                    | Holds                                   |
| ----------------------- | --------------------------------------- |
| [`src/`](src)           | App source and tests                    |
| [`docs/`](docs)         | Agent instructions shipped with the app |
| [`demo/`](demo)         | Demo recording and its review target    |
| [`dev-docs/`](dev-docs) | Documentation for developing this repo  |

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
- The diff is frozen; agents read current repository files. Reviewers do not see each other's reports; the council receives their results and failures.

## Agent permissions

Agents run unattended with read-only access and restricted tools. Provider-specific launch flags and restrictions live in [`agent-commands.ts`](src/execution/agent-commands.ts).

## Review instructions

All agents receive [`docs/common.md`](docs/common.md), their role and review type (`code`, `security`, `ui-ux`):

| Role                     | Instructions                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| Reviewer: find issues    | [`reviewer.md`](docs/reviewer/reviewer.md) + `docs/reviewer/<type>-review.md`            |
| Council: verify findings | [`council.md`](docs/council/council.md) + selected `docs/council/<type>-review.md` files |
