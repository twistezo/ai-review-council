# ai-review-council

Runs independent AI reviewers on a code change.

A council agent verifies their findings and writes one Markdown report, previewed in the terminal, ready to copy or open.

Similar tools usually bill per token through provider APIs. This one runs locally on **your logged-in AI coding agents**.

Docs:

- [CHANGELOG.md](CHANGELOG.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)

## Supported Agents

| Agent   | CLI                      | Reviewer | Council | Models | Effort  | Plan                                |
| ------- | ------------------------ | :------: | :-----: | ------ | ------- | ----------------------------------- |
| Codex   | `codex`                  |    ✓     |    ✓    | All    | All     | Codex CLI access                    |
| Claude  | `claude`                 |    ✓     |    ✓    | All    | All     | Claude Code access                  |
| Copilot | `copilot` / `gh copilot` |    ✓     |    —    | Auto   | Default | Copilot CLI access (Free supported) |

CLIs must be available on `PATH` and logged in. Usage and availability depend on your plan and organization settings.

## Demo

<img src="demo/wizard.gif" alt="AI Review Council demo" width="600">

## Requirements

- macOS, or desktop Linux
- Node.js
- git

## Run

```bash
# install
npm install -g @twistezo/ai-review-council

# run with optional args
ai-review-council --dir ~/projects/my-app --lang pl --scope codebase

```

| Option          | Value                                  | Default |
| --------------- | -------------------------------------- | ------- |
| `-d, --dir`     | folder inside a Git repository         | -       |
| `-l, --lang`    | `en`, `pl`                             | `en`    |
| `-s, --scope`   | `uncommitted`, `codebase`, commit hash | -       |
| `-t, --timeout` | minutes per agent, 1 to 30             | `10`    |

## Develop

```bash
npm install
npm run dev
npm test
npm run typecheck
npm run build # dist/
```

## Docs

[`docs/`](docs) is the domain memory for agents and people. Written in the [Matt Pocock skills](https://github.com/mattpocock/skills) style:

- [`docs/GLOSSARY.md`](docs/GLOSSARY.md): Generated and kept up to date with the `domain-modeling` skill.
