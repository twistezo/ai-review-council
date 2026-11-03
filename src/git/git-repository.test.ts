import { describe, expect, it } from "vitest"

import { commandResult, fakeRunCommand } from "../test-support/fakes.js"
import { parseNameStatus } from "./git-output.js"
import { createGitRepository, isCommitHashFormat } from "./git-repository.js"

const base = "b".repeat(40)

describe("parseNameStatus", () => {
  it("reads modified, added, deleted and renamed files including spaces in paths", () => {
    const output = [
      "M",
      "src/a.ts",
      "A",
      "docs/new file.md",
      "D",
      "old.ts",
      "R087",
      "src/before.ts",
      "src/after.ts",
      "",
    ].join("\0")

    expect(parseNameStatus(output)).toEqual([
      { path: "src/a.ts", previousPath: null, change: "modified" },
      { path: "docs/new file.md", previousPath: null, change: "added" },
      { path: "old.ts", previousPath: null, change: "deleted" },
      {
        path: "src/after.ts",
        previousPath: "src/before.ts",
        change: "renamed",
      },
    ])
  })

  it("reads a copied file with its source path", () => {
    const output = [
      "C075",
      "src/base.ts",
      "src/base copy.ts",
      "M",
      "src/a.ts",
      "",
    ].join("\0")

    expect(parseNameStatus(output)).toEqual([
      {
        path: "src/base copy.ts",
        previousPath: "src/base.ts",
        change: "copied",
      },
      { path: "src/a.ts", previousPath: null, change: "modified" },
    ])
  })

  it("returns nothing for an empty diff", () => {
    expect(parseNameStatus("")).toEqual([])
  })
})

describe("isCommitHashFormat", () => {
  it.each(["a1b2", "A1B2C3D", "f".repeat(40)])("accepts %s", value => {
    expect(isCommitHashFormat(value)).toBe(true)
  })

  it.each(["abc", "f".repeat(41), "HEAD~1", "main", "--output=x", ""])(
    "rejects %s",
    value => {
      expect(isCommitHashFormat(value)).toBe(false)
    },
  )
})

describe("createGitRepository", () => {
  it("combines tracked changes with untracked files, without duplicates", async () => {
    const git = createGitRepository(
      fakeRunCommand({
        [`git diff --name-status -z --find-renames ${base} --`]: commandResult({
          stdout: "M\0src/b.ts\0",
        }),
        "git ls-files --others --exclude-standard -z": commandResult({
          stdout: "src/a.ts\0src/b.ts\0",
        }),
      }),
    )

    expect(await git.listChangedFiles("/repo", base)).toEqual([
      { path: "src/a.ts", previousPath: null, change: "untracked" },
      { path: "src/b.ts", previousPath: null, change: "modified" },
    ])
  })

  it("fails instead of reporting an empty scope when Git cannot list changes", async () => {
    const git = createGitRepository(fakeRunCommand({}))

    await expect(git.listChangedFiles("/repo", base)).rejects.toThrow(
      "Could not read changed files",
    )
  })

  it("reports detached HEAD as no branch", async () => {
    const git = createGitRepository(
      fakeRunCommand({
        "git symbolic-ref --quiet --short HEAD": commandResult({ exitCode: 1 }),
        "git log -1 --format=%H%x00%s --end-of-options HEAD^{commit}":
          commandResult({ stdout: `${base}\0Fix bug\n` }),
        "git status --porcelain=v1 -z --untracked-files=normal": commandResult({
          stdout: "",
        }),
      }),
    )

    expect(await git.readState("/repo")).toEqual({
      root: "/repo",
      branch: null,
      head: { hash: base, subject: "Fix bug" },
      hasChanges: false,
    })
  })

  it("reports changes and the current branch", async () => {
    const git = createGitRepository(
      fakeRunCommand({
        "git symbolic-ref --quiet --short HEAD": commandResult({
          stdout: "feature/cart\n",
        }),
        "git log -1 --format=%H%x00%s --end-of-options HEAD^{commit}":
          commandResult({ stdout: `${base}\0Fix bug\n` }),
        "git status --porcelain=v1 -z --untracked-files=normal": commandResult({
          stdout: " M src/a.ts\0",
        }),
      }),
    )

    expect(await git.readState("/repo")).toMatchObject({
      branch: "feature/cart",
      hasChanges: true,
    })
  })

  it("reports no HEAD commit in a repository without commits", async () => {
    const git = createGitRepository(
      fakeRunCommand({
        "git symbolic-ref --quiet --short HEAD": commandResult({
          stdout: "main\n",
        }),
        "git status --porcelain=v1 -z --untracked-files=normal": commandResult({
          stdout: "?? a.ts\0",
        }),
      }),
    )

    expect(await git.readState("/repo")).toEqual({
      root: "/repo",
      branch: "main",
      head: null,
      hasChanges: true,
    })
  })

  it("fails instead of reporting a clean tree when git status cannot run", async () => {
    const git = createGitRepository(
      fakeRunCommand({
        "git symbolic-ref --quiet --short HEAD": commandResult({
          stdout: "main\n",
        }),
        "git log -1 --format=%H%x00%s --end-of-options HEAD^{commit}":
          commandResult({ stdout: `${base}\0Fix bug\n` }),
        "git status --porcelain=v1 -z --untracked-files=normal": commandResult({
          exitCode: 128,
          stderr: "index.lock",
        }),
      }),
    )

    await expect(git.readState("/repo")).rejects.toThrow(
      "Could not read the working tree with `git status`.",
    )
  })

  it("reads the repository root and the Git version, or nothing when Git fails", async () => {
    const git = createGitRepository(
      fakeRunCommand({
        "git rev-parse --show-toplevel": commandResult({ stdout: "/repo\n" }),
        "git --version": commandResult({ stdout: "git version 2.50.0\n" }),
      }),
    )
    const broken = createGitRepository(fakeRunCommand({}))

    expect(await git.resolveRoot("/repo/src")).toBe("/repo")
    expect(await git.readVersion()).toBe("git version 2.50.0")
    expect(await broken.resolveRoot("/tmp")).toBeNull()
    expect(await broken.readVersion()).toBeNull()
  })

  it("passes a user ref after the end of options so it cannot act as a flag", async () => {
    const git = createGitRepository(
      fakeRunCommand({
        "git log -1 --format=%H%x00%s --end-of-options abcd^{commit}":
          commandResult({ stdout: `${base}\0Fix bug\n` }),
      }),
    )

    expect(await git.resolveCommit("/repo", "abcd")).toEqual({
      hash: base,
      subject: "Fix bug",
    })
  })

  it("returns no commit when Git prints something other than a full hash", async () => {
    const git = createGitRepository(
      fakeRunCommand({
        "git log -1 --format=%H%x00%s --end-of-options abcd^{commit}":
          commandResult({ stdout: "abcd\0Fix bug\n" }),
      }),
    )

    expect(await git.resolveCommit("/repo", "abcd")).toBeNull()
  })

  it("reads the diff of the given paths only, and nothing for no paths", async () => {
    const git = createGitRepository(
      fakeRunCommand({
        [`git --literal-pathspecs diff --find-renames ${base} -- src/a.ts src/b.ts`]:
          commandResult({ stdout: "diff --git a/src/a.ts\n" }),
      }),
    )

    expect(await git.readDiff("/repo", base, ["src/a.ts", "src/b.ts"])).toBe(
      "diff --git a/src/a.ts\n",
    )
    expect(await git.readDiff("/repo", base, [])).toBe("")
    await expect(git.readDiff("/repo", base, ["src/c.ts"])).rejects.toThrow(
      "Could not read the diff",
    )
  })

  it("tells whether a commit is in the history of HEAD", async () => {
    const git = createGitRepository(
      fakeRunCommand({
        [`git merge-base --is-ancestor ${base} HEAD`]: commandResult({
          exitCode: 0,
        }),
      }),
    )

    expect(await git.isInHeadHistory("/repo", base)).toBe(true)
    expect(await git.isInHeadHistory("/repo", "c".repeat(40))).toBe(false)
  })

  it("returns no commit for an unknown ref", async () => {
    const git = createGitRepository(fakeRunCommand({}))

    expect(await git.resolveCommit("/repo", "deadbeef")).toBeNull()
  })

  it("reads the empty tree hash in the repository format, or nothing when Git fails", async () => {
    const sha256EmptyTree =
      "6ef19b41225c5369f1c104d45d8d85efa9b057b53b14b4b9b939dd74decc5321"
    const git = createGitRepository(
      fakeRunCommand({
        "git hash-object -t tree /dev/null": commandResult({
          stdout: `${sha256EmptyTree}\n`,
        }),
      }),
    )

    expect(await git.readEmptyTreeHash("/repo")).toBe(sha256EmptyTree)
    expect(
      await createGitRepository(fakeRunCommand({})).readEmptyTreeHash("/repo"),
    ).toBeNull()
  })
})
