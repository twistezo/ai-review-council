# Agent notes

- `docs/` holds the instructions the app ships to its review agents; notes for working on this repo go in `dev-docs/`.
- `demo/bug-farm/` is an intentionally buggy TypeScript fixture for review demos. Exclude it from app reviews and fixes unless the task explicitly targets the fixture; preserve its planted defects.
- Release: bump with `npm version --no-git-tag-version`, then hand the maintainer one command for commit, tag, push and `gh release create` with the version's `CHANGELOG.md` section as notes. The tag must be pushed before the release, or GitHub tags the wrong commit.
- Never `npm publish`: the GitHub release runs [`publish.yml`](.github/workflows/publish.yml).

## Docs

`docs/` follows the [Matt Pocock skills](https://github.com/mattpocock/skills) flow. Details: [README](README.md#dev-docs).
