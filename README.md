# ai-review-council

Runs independent Codex and Claude Code reviewers on a code change. A council agent verifies their findings and prints one Markdown report, also copied to the clipboard.

Changes: [CHANGELOG.md](CHANGELOG.md). Internals: [ARCHITECTURE.md](ARCHITECTURE.md).

## Requirements

- macOS, Node.js 24, `git`
- `codex` and/or `claude` on `PATH`, logged in

## Run

```bash
npm install
```

```bash
# every option is optional and skips its wizard question
npm run dev -- --dir ~/projects/my-app --lang pl --scope uncommitted --reviewers 2
```

| Option | Value | Default |
|---|---|---|
| `-d, --dir` | folder inside a Git repository | asked |
| `-l, --lang` | `en`, `pl` | asked, `en` |
| `-s, --scope` | `uncommitted`, or a commit hash: changes after it, uncommitted included | asked |
| `-r, --reviewers` | 1 to 6 | asked |
| `-t, --timeout` | minutes per agent, 1 to 120 | `10` |

The review covers the branch checked out; switch branches before starting.

| Key | Action |
|---|---|
| `↑` `↓` / `←` `→` | row / column |
| `Enter` | confirm; new line in the prompt |
| `Ctrl+D` | confirm the prompt |
| `Ctrl+V` | paste into the prompt |
| `Esc` | back |

| Exit code | Meaning |
|---|---|
| `0` | Report printed; failed reviewers named on stderr |
| `1` | Requirements not met, or no verified report |
| `2` | Invalid options; usage printed on stderr |
| `130` / `129` / `143` | `Ctrl+C` / terminal closed / `kill`; agents stop and temp files go, confirmed by a message where the terminal remains |

## Agents

Agents only read files, run no project code and answer their own questions. Each gets [`docs/common.md`](docs/common.md), its role file and its review type:

| Agent | Role | Review types |
|---|---|---|
| Reviewer | [`docs/reviewer/reviewer.md`](docs/reviewer/reviewer.md) | its own: `docs/reviewer/<type>-review.md` |
| Council | [`docs/council/council.md`](docs/council/council.md) | the reviewers': `docs/council/<type>-review.md` |

A new review type needs a file in both folders and an entry in `reviewTypes` in [`src/domain/review-session.ts`](src/domain/review-session.ts).

## Develop

```bash
npm test
```

```bash
npm run typecheck
```

```bash
npm run build
```
