# ai-review-council

Runs independent Codex and Claude Code reviewers on a code change. A council agent verifies their findings and writes one Markdown report, previewed in the terminal, ready to copy or open.

Changes: [CHANGELOG.md](CHANGELOG.md). Internals: [ARCHITECTURE.md](ARCHITECTURE.md).

## Requirements

- macOS, Node.js 24, `git`
- `codex` and/or `claude` on `PATH`, logged in

## Run

```bash
# install
npm install -g @twistezo/ai-review-council

# run; every option is optional and skips its wizard question
ai-review-council --dir ~/projects/my-app --lang pl --scope uncommitted --reviewers 2

# or run without installing
npx @twistezo/ai-review-council
```

| Option | Value | Default |
|---|---|---|
| `-d, --dir` | folder inside a Git repository | asked |
| `-l, --lang` | `en`, `pl` | asked, `en` |
| `-s, --scope` | `uncommitted`; `full`: the entire codebase, every file as new; or a commit hash: changes after it, uncommitted included | asked |
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
| `c` / `o` / `q` | after the review: copy the report / open it in the default `.md` app / quit |

| Exit code | Meaning |
|---|---|
| `0` | Report shown, then `q`, `Esc` or `Ctrl+C`; failed reviewers named on stderr |
| `1` | Requirements not met, or no verified report |
| `2` | Invalid options; usage printed on stderr |
| `130` / `129` / `143` | `Ctrl+C` before the report / terminal closed / `kill`; agents stop and temp files go, confirmed by a message where the terminal remains |

## Agents

Agents only read files, run no project code and answer their own questions. Each gets [`docs/common.md`](docs/common.md), its role file and its review type:

| Agent | Role | Review types |
|---|---|---|
| Reviewer | [`docs/reviewer/reviewer.md`](docs/reviewer/reviewer.md) | its own: `docs/reviewer/<type>-review.md` |
| Council | [`docs/council/council.md`](docs/council/council.md) | the reviewers': `docs/council/<type>-review.md` |

A new review type needs a file in both folders and an entry in `reviewTypes` in [`src/domain/review-session.ts`](src/domain/review-session.ts).

## Develop

```bash
# install dependencies
npm install

# run from source; same options as the installed command
npm run dev -- --dir ~/projects/my-app

# tests, typecheck, build into `dist/`
npm test
npm run typecheck
npm run build
```

Release: a GitHub release for the tag publishes the version to npm ([`publish.yml`](.github/workflows/publish.yml)).

```bash
# version to release; add its section to CHANGELOG.md first
VERSION=1.2.1

# bump package.json and package-lock.json, no Git commit or tag
npm version "$VERSION" --no-git-tag-version

# commit, tag and push
git add CHANGELOG.md package.json package-lock.json
git commit -m "Release v$VERSION"
git tag "v$VERSION"
git push origin main "v$VERSION"

# GitHub release with the version's CHANGELOG section as notes; CI publishes to npm
gh release create "v$VERSION" --title "v$VERSION" --notes "$(awk -v v="## $VERSION " '/^## [0-9]/{p=index($0, v)==1} p' CHANGELOG.md)"
```
