import { mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { render } from "ink-testing-library"
import { afterAll, describe, expect, it } from "vitest"

import type { AgentLaunch } from "../execution/agent-commands.js"
import type { ReviewRunDependencies } from "../review/run-review.js"
import {
  fakeAdapter,
  fakeGitRepository,
  headCommit,
} from "../test-support/fakes.js"
import type { AppPresets, AppServices, WizardOutcome } from "./app.js"
import { App } from "./app.js"

const keys = {
  enter: "\r",
  backspace: "\x7f",
  tab: "\t",
  ctrlD: "\x04",
  ctrlV: "\x16",
  down: "\x1b[B",
  right: "\x1b[C",
  escape: "\x1b",
} as const

const delay = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms))

// Agents answer on the next turn of the event loop, after the run screen rendered.
const fakeReview = (launches: AgentLaunch[] = []): ReviewRunDependencies => ({
  runAgent: async (launch, options) => {
    launches.push(launch)
    options.onEvent?.({ kind: "read", target: "src/checkout.ts" })
    await new Promise(resolve => setImmediate(resolve))
    const isCouncil = launch.message.startsWith("# Council session")

    return {
      ok: true,
      report: isCouncil
        ? "# Review: VAT missing\n### VAT not added"
        : "### VAT not added",
      sessionId: "s",
    }
  },
  prepareWorkspace: async () => ({
    directory: "/tmp/council-test",
    diffPath: "/tmp/council-test/change.diff",
    cleanup: async () => undefined,
  }),
  readInstructions: async files => files.join(" + "),
  now: Date.now,
})

const waitTimeoutMs = 2_000
// how long a key that changes nothing on screen is given before the next one
const quietMs = 150
// lets a step that just appeared register its input handlers
const settleMs = 20

// a step title with its counter, e.g. ` Reviewer 1 • step 5 of 7`
const stepTitle = (title: string): RegExp =>
  new RegExp(`^ ${title} • step`, "m")
// an answers or summary line, e.g. ` Reviewers     1`
const fieldLine = (label: string, value: string): RegExp =>
  new RegExp(`^ +${label} +${value} *$`, "m")

type Session = {
  press: (...inputs: string[]) => Promise<void>
  waitFor: (description: string, isReady: () => boolean) => Promise<void>
  waitForText: (text: string) => Promise<void>
  waitForStep: (title: string) => Promise<void>
  frame: () => string
  // every frame rendered so far, including the last one before the app exits
  frames: () => readonly string[]
  hasExited: () => boolean
  outcomes: WizardOutcome[]
}

const startApp = async (
  services: Partial<AppServices> = {},
  presets: AppPresets = { language: null, directory: null, scope: null },
): Promise<Session> => {
  const outcomes: WizardOutcome[] = []
  const { stdin, frames } = render(
    <App
      title="ai-review-council v9.9.9"
      services={{
        git: fakeGitRepository(),
        adapters: [fakeAdapter("codex"), fakeAdapter("claude")],
        findMissingInstructionFiles: async () => [],
        readClipboard: async () => "Pasted line 1\r\nPasted line 2",
        writeClipboard: async () => true,
        openReport: async () => "/tmp/review.md",
        review: fakeReview(),
        cwd: tmpdir(),
        homeDirectory: tmpdir(),
        ...services,
      }}
      presets={presets}
      timeoutMinutes={10}
      onFinish={outcome => outcomes.push(outcome)}
    />,
  )
  // Ink clears the output on exit, so the last frame drawn is the last non-empty one.
  const frame = (): string =>
    frames.findLast(rendered => rendered.trim() !== "") ?? ""
  const waitFor = async (
    description: string,
    isReady: () => boolean,
  ): Promise<void> => {
    const deadline = Date.now() + waitTimeoutMs
    while (!isReady()) {
      if (Date.now() > deadline) {
        throw new Error(
          `Timed out waiting for ${description}. Last frame:\n${frame()}`,
        )
      }
      await delay(5)
    }
    await delay(settleMs)
  }
  const waitForText = (text: string): Promise<void> =>
    waitFor(`"${text}"`, () => frame().includes(text))
  const waitForStep = (title: string): Promise<void> =>
    waitFor(`the "${title}" step`, () => stepTitle(title).test(frame()))
  await waitFor(
    "the first step",
    () =>
      frame().includes("step 1 of") || frame().includes("Requirements not met"),
  )

  return {
    press: async (...inputs) => {
      for (const input of inputs) {
        const previous = frame()
        stdin.write(input)
        const deadline = Date.now() + quietMs
        while (frame() === previous && Date.now() < deadline) {
          await delay(5)
        }
        await delay(settleMs)
      }
    },
    waitFor,
    waitForText,
    waitForStep,
    frame,
    frames: () => frames,
    // Ink stops reading the input once the app has exited.
    hasExited: () => stdin.listenerCount("readable") === 0,
    outcomes,
  }
}

const allPresets: AppPresets = {
  language: "pl",
  directory: tmpdir(),
  scope: { kind: "uncommitted" },
}

// language, project and scope, each waiting for the next step
const toCouncil = async (app: Session): Promise<void> => {
  await app.press(keys.enter)
  await app.waitForStep("Project folder")
  await app.press(keys.enter)
  await app.waitForStep("Review scope")
  await app.press(keys.enter)
  await app.waitForStep("Council agent")
}

const startAtCouncil = async (
  services: Partial<AppServices> = {},
): Promise<Session> => {
  const app = await startApp(services, allPresets)
  await app.waitForStep("Council agent")

  return app
}

// the default council and one default reviewer
const toPrompt = async (app: Session): Promise<void> => {
  await app.press(keys.enter, keys.enter, keys.ctrlD)
  await app.waitForStep("Review prompt")
}

const projectsDirectory = mkdtempSync(join(tmpdir(), "ai-review-council-ui-"))
for (const folder of ["alpha-one", "alpha-two", "beta", "other"]) {
  mkdirSync(join(projectsDirectory, folder))
}

afterAll(() => rmSync(projectsDirectory, { recursive: true, force: true }))

describe.concurrent("App", () => {
  it("walks the whole flow and runs the review with the chosen agents", async () => {
    const launches: AgentLaunch[] = []
    const copied: string[] = []
    const opened: string[] = []
    const app = await startApp({
      review: fakeReview(launches),
      writeClipboard: async text => {
        copied.push(text)

        return true
      },
      openReport: async report => {
        opened.push(report)

        return "/tmp/review.md"
      },
    })
    // compact header, then one blank line before the step
    expect(app.frame()).toMatch(
      /^ ai-review-council v9\.9\.9\n ✔ Git · ✔ Codex · ✔ Claude\n\n Report language • step 1 of 7\n/,
    )

    await toCouncil(app)
    // answers so far, then the field this step sets
    expect(app.frame()).toContain(
      "Scope         uncommitted changes on aaaaaaa (1 file, 1 likely secret file excluded)",
    )
    expect(app.frame()).toContain("Council       ← selecting")
    expect(app.frame()).not.toContain("Reviewers")
    // → to the effort column, medium -> high, Enter confirms
    await app.press(keys.right, keys.right, keys.down, keys.enter)
    await app.waitForStep("Reviewer 1")
    await app.press(keys.enter, keys.ctrlD)
    await app.waitForStep("Review prompt")

    expect(app.frame()).toContain("Council       Codex · codex-large · high")
    expect(app.frame()).toMatch(fieldLine("Reviewers", "1"))
    expect(app.frame()).toContain("Prompt        ← selecting")
    expect(app.frame()).toContain(
      "Enter newline · Ctrl+D confirm · Ctrl+V paste",
    )
    await app.press(
      "Checkout total must include VAT",
      keys.enter,
      "Rounding to 2 places",
      keys.ctrlD,
    )
    await app.waitForStep("Summary")
    const frame = app.frame()
    expect(frame).toContain("Codex · codex-large · high")
    // no instruction files and no usage warning in the summary
    expect(frame).not.toContain("council.md")
    expect(frame).not.toContain("Starting launches")
    expect(frame).toContain("1 likely secret file excluded")
    expect(frame).toContain("Timeout       10 min per agent")
    const summaryLines = frame.split("\n")
    const summaryOrder = [
      "Language",
      "Project",
      "Branch",
      "Scope",
      "Council",
      "Reviewers",
      "Prompt",
      "Timeout",
    ].map(label =>
      summaryLines.findIndex(line => line.trimStart().startsWith(label)),
    )
    expect(summaryOrder.every(position => position >= 0)).toBe(true)
    expect(summaryOrder).toEqual(
      [...summaryOrder].sort((left, right) => left - right),
    )
    expect(frame).toContain("Working tree  currently has uncommitted changes")
    expect(frame).toContain("Enter confirm · Esc back")

    await app.press(keys.escape)
    await app.waitForStep("Review prompt")
    expect(app.frame()).toContain("Checkout total must include VAT")
    await app.press(keys.ctrlD)
    await app.waitForStep("Summary")

    await app.press(keys.enter)
    await app.waitForText("c copy · o open · q quit")
    // a preview of the report under the finished table; the app waits for a key
    expect(app.frame()).toContain(
      "Reviewed 1 file · repo · uncommitted changes on aaaaaaa",
    )
    // framed, labelled as the report, with a blank line above the frame
    expect(app.frame()).toMatch(
      /00\s*\n\n ╭─+╮\n │ Report +│\n │ +│\n │ Review: VAT missing/,
    )
    expect(app.frame()).toContain("• VAT not added")
    expect(app.frame()).toContain("… 2 lines in the full report")
    // known already, so quitting with Ctrl+C here ends as a finished review
    expect(app.outcomes).toHaveLength(1)

    await app.press("c")
    await app.waitForText("✔ Report copied to the clipboard.")
    expect(copied).toEqual(["# Review: VAT missing\n\n### VAT not added"])
    await app.press("o")
    await app.waitForText("✔ Report opened: /tmp/review.md")
    expect(opened).toEqual(copied)

    await app.press("q")
    await app.waitFor("the app to exit", app.hasExited)
    // the last frame keeps the preview without the hints
    expect(app.frame()).toContain("✔ Report opened: /tmp/review.md")
    expect(app.frame()).not.toContain("q quit")

    const activeFrame =
      app
        .frames()
        .find(rendered =>
          rendered.includes(
            "Reviewing 1 file · repo · uncommitted changes on aaaaaaa",
          ),
        ) ?? ""
    expect(activeFrame).toContain("Ctrl+C cancels all agents")
    expect(activeFrame.indexOf("Ctrl+C cancels all agents")).toBeGreaterThan(
      activeFrame.indexOf("council"),
    )
    expect(activeFrame).not.toContain("file(s) · Ctrl+C")
    expect(app.frame()).toMatch(
      /\n {2}Codex +codex-large +medium +code +✔ done · 1 finding/,
    )
    expect(app.frame()).toMatch(
      /\n {2}Codex +codex-large +high +council +✔ done · 1 finding/,
    )
    expect(app.outcomes).toEqual([
      {
        kind: "finished",
        result: expect.objectContaining({
          kind: "reported",
          report: "# Review: VAT missing\n### VAT not added",
        }),
      },
    ])
    const councilLaunch = launches.find(launch =>
      launch.message.startsWith("# Council session"),
    )
    expect(councilLaunch).toMatchObject({
      configuration: {
        provider: "codex",
        model: "codex-large",
        effort: "high",
      },
      cwd: "/repo",
      readableDirectories: ["/tmp/council-test"],
    })
    expect(councilLaunch?.message).toContain(
      "Language of the final report: English.",
    )
    expect(councilLaunch?.message).toContain(
      "## Review prompt\nCheckout total must include VAT\nRounding to 2 places",
    )
    expect(launches).toHaveLength(2)
  })

  it("writes the report in the language picked in the first step", async () => {
    const launches: AgentLaunch[] = []
    const app = await startApp({ review: fakeReview(launches) })
    await app.press(keys.down, keys.enter)
    await app.waitForStep("Project folder")
    expect(app.frame()).toMatch(fieldLine("Language", "Polish"))

    await app.press(keys.enter)
    await app.waitForStep("Review scope")
    await app.press(keys.enter)
    await app.waitForStep("Council agent")
    await toPrompt(app)
    await app.press(keys.ctrlD)
    await app.waitForStep("Summary")
    expect(app.frame()).toMatch(fieldLine("Language", "Polish"))
    await app.press(keys.enter)
    await app.waitForText("q quit")

    const councilLaunch = launches.find(launch =>
      launch.message.startsWith("# Council session"),
    )
    expect(councilLaunch?.message).toContain(
      "Language of the final report: Polish.",
    )
  })

  it("lists only the models of the selected provider", async () => {
    const app = await startAtCouncil()
    expect(app.frame()).toContain("codex-large")
    expect(app.frame()).not.toContain("claude-large")

    await app.press(keys.down)
    expect(app.frame()).toContain("claude-large")
    expect(app.frame()).not.toContain("codex-large")
  })

  it("offers Copilot to reviewers but not as the council agent", async () => {
    const app = await startAtCouncil({
      adapters: [
        fakeAdapter("codex"),
        fakeAdapter("copilot", {
          models: [{ id: "auto", label: "Auto", efforts: [] }],
        }),
      ],
    })
    // the header lists every provider; the picker follows the step title
    const picker = (title: string): string =>
      app.frame().slice(app.frame().indexOf(title))
    expect(picker("Council agent")).toContain("Codex")
    expect(picker("Council agent")).not.toContain("Copilot")

    await app.press(keys.enter)
    await app.waitForStep("Reviewer 1")
    expect(picker("Reviewer 1")).toContain("Copilot")
  })

  it("skips the language and folder steps given as options", async () => {
    const app = await startApp(
      {},
      { language: "pl", directory: tmpdir(), scope: null },
    )

    expect(app.frame()).toMatch(/^ Review scope • step 1 of 5$/m)
    // values line up in one column
    const lines = app.frame().split("\n")
    const valueColumn = (label: string): number => {
      const line =
        lines.find(candidate => candidate.trimStart().startsWith(label)) ?? ""

      return (
        line.length -
        line.slice(line.indexOf(label) + label.length).trimStart().length
      )
    }
    expect(app.frame()).toContain("Branch        main")
    expect(app.frame()).toContain("Language      Polish")
    expect(app.frame()).toContain("Scope         ← selecting")
    expect(app.frame()).not.toContain("Working tree")
    // fields follow the wizard steps
    const order = ["Language", "Project", "Branch", "Scope"].map(label =>
      lines.findIndex(line => line.trimStart().startsWith(label)),
    )
    expect(order).toEqual([...order].sort((left, right) => left - right))
    expect(
      new Set([
        valueColumn("Project"),
        valueColumn("Branch"),
        valueColumn("Language"),
      ]).size,
    ).toBe(1)
  })

  it("shows the folder step with the error when the --dir path is invalid", async () => {
    const app = await startApp(
      {},
      { language: null, directory: "/no/such/folder", scope: null },
    )
    await app.press(keys.enter)
    await app.waitForText("Not a directory: /no/such/folder")

    expect(app.frame()).toMatch(stepTitle("Project folder"))
  })

  it("skips the scope step given as an option", async () => {
    const app = await startApp({}, allPresets)
    await app.waitForStep("Council agent")

    expect(app.frame()).toContain("Council agent • step 1 of 4")
  })

  it("shows the scope step with the error and the hash when the --scope commit is wrong", async () => {
    const app = await startApp(
      { git: fakeGitRepository({ isInHeadHistory: async () => false }) },
      {
        language: "pl",
        directory: tmpdir(),
        scope: { kind: "since-commit", commitRef: "aaaa" },
      },
    )
    await app.waitForText("not in the history")

    expect(app.frame()).toMatch(stepTitle("Review scope"))
    expect(app.frame()).toContain(
      "Changes after this commit, uncommitted included:",
    )
    expect(app.frame()).toContain("aaaa")
  })

  it("continues with only Claude Code when Codex is not available", async () => {
    const app = await startApp({
      adapters: [
        fakeAdapter("codex", {
          status: { problem: "Provider is unavailable." },
        }),
        fakeAdapter("claude"),
      ],
    })
    expect(app.frame()).toContain(
      "– Codex (Provider is unavailable.) · ✔ Claude",
    )
    await toCouncil(app)

    expect(app.frame()).toContain("claude-large")
    expect(app.frame()).not.toContain("codex-large")
  })

  it("ends when no provider is available", async () => {
    const app = await startApp({
      adapters: [
        fakeAdapter("codex", {
          status: { problem: "Provider is unavailable." },
        }),
        fakeAdapter("claude", {
          status: { problem: "`claude` was not found in PATH." },
        }),
      ],
    })
    await app.waitForText("Requirements not met")

    expect(app.frame()).toContain(
      "At least one of Codex or Claude must be available.",
    )
    await app.press(keys.enter)
    expect(app.outcomes).toEqual([{ kind: "blocked" }])
  })

  it.each([
    [
      { kind: "since-commit", commitRef: "aaaa" },
      "changes after aaaaaaa Add checkout form, uncommitted included",
    ],
    [{ kind: "full" }, "entire codebase on aaaaaaa, uncommitted included"],
  ] as const)(
    "shows the selected scope in the running and finished summary: %s",
    async (scope, label) => {
      const app = await startApp(
        {
          git: fakeGitRepository({
            readState: async () => ({
              root: "/projects/ai-review-council/",
              branch: "main",
              head: { hash: "a".repeat(40), subject: "Subject" },
              hasChanges: true,
            }),
            listChangedFiles: async () => [
              { path: "src/one.ts", previousPath: null, change: "modified" },
              { path: "src/two.ts", previousPath: null, change: "added" },
            ],
          }),
        },
        { language: "pl", directory: tmpdir(), scope },
      )
      await app.waitForStep("Council agent")
      await toPrompt(app)
      await app.press(keys.ctrlD)
      await app.waitForStep("Summary")
      await app.press(keys.enter)
      await app.waitForText("q quit")
      // the scope line wraps at the test terminal width
      const unwrap = (frame: string): string => frame.split(/\s+/).join(" ")
      expect(
        app
          .frames()
          .some(frame =>
            unwrap(frame).includes(
              `Reviewing 2 files · ai-review-council · ${label}`,
            ),
          ),
      ).toBe(true)
      expect(unwrap(app.frame())).toContain(
        `Reviewed 2 files · ai-review-council · ${label}`,
      )
    },
  )
})

describe.concurrent("App project step", () => {
  it("lists matching folders on Tab and completes a single match", async () => {
    const app = await startApp({ cwd: projectsDirectory })
    await app.press(keys.enter)
    await app.waitForStep("Project folder")

    await app.press("/al", keys.tab)
    await app.waitForText("alpha-two/")
    expect(app.frame()).toContain(`${projectsDirectory}/alpha-`)
    expect(app.frame()).toMatch(/^ +alpha-one\/$/m)
    expect(app.frame()).not.toContain("beta/")

    await app.press("o", keys.tab)
    await app.waitForText(`${projectsDirectory}/alpha-one/`)
    expect(app.frame()).not.toContain("alpha-two/")
  })

  it("stays where Esc led when the repository check finishes after the user left", async () => {
    let finishCheck = (): void => undefined
    const git = fakeGitRepository({
      resolveRoot: () =>
        new Promise(resolve => {
          finishCheck = () => resolve("/repo")
        }),
    })
    const app = await startApp({ git })
    await app.press(keys.enter)
    await app.waitForStep("Project folder")
    await app.press(keys.enter)
    await app.waitForText("Checking repository")
    await app.press(keys.escape)
    await app.waitForStep("Report language")

    finishCheck()
    await delay(100)
    expect(app.frame()).toMatch(stepTitle("Report language"))
  })

  it("stays on the folder step when the folder is not in a Git repository", async () => {
    const app = await startApp({
      git: fakeGitRepository({ resolveRoot: async () => null }),
    })
    await app.press(keys.enter)
    await app.waitForStep("Project folder")
    await app.press(keys.enter)
    await app.waitForText("Not inside a Git repository")

    expect(app.frame()).toMatch(stepTitle("Project folder"))
  })

  it("stays on the folder step when the working tree cannot be read", async () => {
    const git = fakeGitRepository({
      readState: async () => {
        throw new Error("Could not read the working tree with `git status`.")
      },
    })
    const app = await startApp({ git })
    await app.press(keys.enter)
    await app.waitForStep("Project folder")
    await app.press(keys.enter)
    await app.waitForText("Could not read the working tree")

    expect(app.frame()).toMatch(stepTitle("Project folder"))
  })

  it("stays on the folder step when the repository has no commits", async () => {
    const git = fakeGitRepository({
      readState: async () => ({
        root: "/repo",
        branch: "main",
        head: null,
        hasChanges: true,
      }),
    })
    const app = await startApp({ git })
    await app.press(keys.enter)
    await app.waitForStep("Project folder")
    await app.press(keys.enter)
    await app.waitForText(
      "The repository has no commits, so there is nothing to compare against.",
    )

    expect(app.frame()).toMatch(stepTitle("Project folder"))
  })

  it("keeps the scope for the same repository and resets it for another one", async () => {
    const git = fakeGitRepository({
      resolveRoot: async directory =>
        directory.endsWith("other") ? "/other" : "/repo",
      readState: async root => ({
        root,
        branch: "main",
        head: headCommit,
        hasChanges: true,
      }),
    })
    const app = await startApp({ git, cwd: projectsDirectory })
    await app.press(keys.enter)
    await app.waitForStep("Project folder")
    await app.press(keys.enter)
    await app.waitForStep("Review scope")
    await app.press(keys.down, keys.down, keys.enter)
    await app.waitForStep("Council agent")

    await app.press(keys.escape, keys.escape)
    await app.waitForStep("Project folder")
    await app.press(keys.enter)
    await app.waitForStep("Review scope")
    expect(app.frame()).toContain("› Entire codebase")

    await app.press(keys.escape)
    await app.waitForStep("Project folder")
    await app.press("/other", keys.enter)
    await app.waitForStep("Review scope")
    expect(app.frame()).toMatch(fieldLine("Project", "/other"))
    expect(app.frame()).toContain("› Uncommitted only")
  })
})

describe.concurrent("App scope step", () => {
  it("reviews the entire codebase", async () => {
    const app = await startApp()
    await app.press(keys.enter, keys.enter)
    await app.waitForStep("Review scope")

    await app.press(keys.down, keys.down, keys.enter)
    await app.waitForStep("Council agent")
    expect(app.frame()).toContain(
      "Scope         entire codebase on aaaaaaa, uncommitted included (1 file",
    )
  })

  it("stays where Esc led when the changes finish loading after the user left", async () => {
    let finishLoading = (): void => undefined
    const git = fakeGitRepository({
      listChangedFiles: () =>
        new Promise(resolve => {
          finishLoading = () =>
            resolve([
              {
                path: "src/checkout.ts",
                previousPath: null,
                change: "modified",
              },
            ])
        }),
    })
    const app = await startApp({ git })
    await app.press(keys.enter, keys.enter)
    await app.waitForStep("Review scope")
    await app.press(keys.enter)
    await app.waitForText("Reading changes")
    await app.press(keys.escape)
    await app.waitForStep("Project folder")

    finishLoading()
    await delay(100)
    expect(app.frame()).toMatch(stepTitle("Project folder"))
    expect(app.frame()).not.toContain("Scope         uncommitted")
  })

  it("stays on the scope step when there is nothing to review", async () => {
    const app = await startApp({
      git: fakeGitRepository({ listChangedFiles: async () => [] }),
    })
    await app.press(keys.enter, keys.enter)
    await app.waitForStep("Review scope")
    await app.press(keys.enter)
    await app.waitForText("There are no uncommitted changes to review.")

    expect(app.frame()).toMatch(stepTitle("Review scope"))
  })

  it("takes a commit hash typed by hand, keeping a wrong one for correction", async () => {
    const app = await startApp()
    await app.press(keys.enter, keys.enter)
    await app.waitForStep("Review scope")
    await app.press(keys.down, keys.enter)
    await app.waitForText("Changes after this commit, uncommitted included:")

    await app.press("bbbb", keys.enter)
    await app.waitForText('Commit "bbbb" was not found or is ambiguous.')
    expect(app.frame()).toContain("Changes after this commit")
    expect(app.frame()).toMatch(/^ bbbb/m)

    // Esc leaves the hash for the list of scope kinds, still on this step
    await app.press(keys.escape)
    expect(app.frame()).toMatch(stepTitle("Review scope"))
    expect(app.frame()).toContain("Entire codebase")
    expect(app.frame()).not.toContain("Changes after this commit")

    await app.press(keys.down, keys.enter)
    await app.waitForText("Changes after this commit")
    await app.press(
      keys.backspace,
      keys.backspace,
      keys.backspace,
      keys.backspace,
      "aaaa",
      keys.enter,
    )
    await app.waitForStep("Council agent")
    expect(app.frame()).toContain(
      "Scope         changes after aaaaaaa Add checkout form",
    )
  })
})

describe.concurrent("App reviewers step", () => {
  it("shows the reviewer hints", async () => {
    const app = await startAtCouncil()
    await app.press(keys.enter)
    await app.waitForStep("Reviewer 1")

    expect(app.frame()).toContain(
      "↑↓ row · ←→ column · Enter next · Ctrl+D confirm · Esc back",
    )
    expect(app.frame()).not.toContain("How many reviewers")
  })

  it("confirms only the reviewers accepted with Enter", async () => {
    const app = await startAtCouncil()
    await app.press(keys.enter)
    await app.waitForStep("Reviewer 1")

    await app.press(keys.enter, keys.enter)
    expect(app.frame()).toMatch(stepTitle("Reviewer 3"))
    await app.press(keys.ctrlD)
    await app.waitForStep("Review prompt")
    expect(app.frame()).toMatch(fieldLine("Reviewers", "2"))
  })

  it("ignores Ctrl+D until a reviewer is accepted", async () => {
    const app = await startAtCouncil()
    await app.press(keys.enter)
    await app.waitForStep("Reviewer 1")

    await app.press(keys.ctrlD)
    expect(app.frame()).toMatch(stepTitle("Reviewer 1"))

    await app.press(keys.enter, keys.ctrlD)
    await app.waitForStep("Review prompt")
    expect(app.frame()).toMatch(fieldLine("Reviewers", "1"))
  })

  it("opens each next reviewer with a fresh choice", async () => {
    const app = await startAtCouncil()
    await app.press(keys.enter)
    await app.waitForStep("Reviewer 1")
    // → to the model column, a model without efforts
    await app.press(keys.right, keys.down, keys.enter)

    expect(app.frame()).toMatch(stepTitle("Reviewer 2"))
    expect(app.frame()).toContain("Codex • codex-small • default • code")
    // focus on the left column, first model, its default effort
    expect(app.frame()).toContain("› Provider")
    expect(app.frame()).toContain("› codex-large")
    expect(app.frame()).toContain("› medium")
  })

  it("drops the draft and reopens the last accepted reviewer on Esc", async () => {
    const app = await startAtCouncil()
    await app.press(keys.enter)
    await app.waitForStep("Reviewer 1")
    await app.press(keys.right, keys.down, keys.enter)
    expect(app.frame()).toMatch(stepTitle("Reviewer 2"))

    await app.press(keys.escape)
    expect(app.frame()).toMatch(stepTitle("Reviewer 1"))
    expect(app.frame()).toContain("› codex-small")

    // with nothing accepted, Esc goes to the council and the draft waits there
    await app.press(keys.escape)
    await app.waitForStep("Council agent")
    await app.press(keys.enter)
    await app.waitForStep("Reviewer 1")
    expect(app.frame()).toContain("› codex-small")
    await app.press(keys.enter, keys.ctrlD)
    await app.waitForStep("Review prompt")
    expect(app.frame()).toMatch(fieldLine("Reviewers", "1"))
  })

  it("keeps every accepted reviewer when going back from the prompt", async () => {
    const app = await startAtCouncil()
    await app.press(keys.enter)
    await app.waitForStep("Reviewer 1")
    // two reviewers: the first with codex-small, the second with ui-ux
    await app.press(keys.right, keys.down, keys.enter)
    await app.press(
      keys.right,
      keys.right,
      keys.right,
      keys.down,
      keys.enter,
      keys.ctrlD,
    )
    await app.waitForStep("Review prompt")
    expect(app.frame()).toMatch(fieldLine("Reviewers", "2"))

    await app.press(keys.escape)
    await app.waitForStep("Reviewer 3")
    expect(app.frame()).toContain("Codex • codex-small • default • code")
    expect(app.frame()).toContain("Codex • codex-large • medium  • ui-ux")
    await app.press(keys.ctrlD)
    await app.waitForStep("Review prompt")
    expect(app.frame()).toMatch(fieldLine("Reviewers", "2"))

    // further Esc presses reopen the accepted reviewers one by one
    await app.press(keys.escape)
    await app.waitForStep("Reviewer 3")
    await app.press(keys.escape)
    expect(app.frame()).toMatch(stepTitle("Reviewer 2"))
    expect(app.frame()).toContain("› ui-ux")
    await app.press(keys.escape)
    expect(app.frame()).toMatch(stepTitle("Reviewer 1"))
    expect(app.frame()).toContain("› codex-small")
  })

  it("keeps edited reviewer choices when escaping to the council before accepting", async () => {
    const app = await startAtCouncil()
    await app.press(keys.enter)
    await app.waitForStep("Reviewer 1")
    await app.press(keys.right, keys.down, keys.escape)
    await app.waitForStep("Council agent")

    await app.press(keys.enter)
    await app.waitForStep("Reviewer 1")
    expect(app.frame()).toContain("› codex-small")
    await app.press(keys.enter, keys.ctrlD)
    await app.waitForStep("Review prompt")
    expect(app.frame()).toMatch(fieldLine("Reviewers", "1"))
  })

  it("stops at ten accepted reviewers and says so", async () => {
    const app = await startAtCouncil()
    await app.press(keys.enter)
    await app.waitForStep("Reviewer 1")
    for (let index = 0; index < 10; index += 1) {
      await app.press(keys.enter)
    }
    expect(app.frame()).toContain("Maximum 10 reviewers")
    expect(app.frame()).toMatch(stepTitle("Reviewers"))
    await app.press(keys.enter)
    expect(app.frame()).toMatch(stepTitle("Reviewers"))

    await app.press(keys.escape)
    expect(app.frame()).toMatch(stepTitle("Reviewer 10"))
    await app.press(keys.enter)
    expect(app.frame()).toContain("Maximum 10 reviewers")
    await app.press(keys.ctrlD)
    await app.waitForStep("Review prompt")
    expect(app.frame()).toMatch(fieldLine("Reviewers", "10"))

    await app.press(keys.escape)
    await app.waitForText("Maximum 10 reviewers")
  })
})

describe.concurrent("App prompt step", () => {
  it("pastes the clipboard with Ctrl+V as separate lines", async () => {
    const launches: AgentLaunch[] = []
    const app = await startAtCouncil({ review: fakeReview(launches) })
    await toPrompt(app)
    await app.press("Context: ", keys.ctrlV)
    await app.waitForText("Pasted line 2")
    expect(app.frame()).toMatch(/│ Context: Pasted line 1 +│/)

    await app.press(keys.ctrlD)
    await app.waitForStep("Summary")
    await app.press(keys.enter)
    await app.waitForText("q quit")
    const councilLaunch = launches.find(launch =>
      launch.message.startsWith("# Council session"),
    )
    expect(councilLaunch?.message).toContain(
      "## Review prompt\nContext: Pasted line 1\nPasted line 2",
    )
  })

  it("leaves the prompt as it is when the clipboard has no text", async () => {
    const app = await startAtCouncil({ readClipboard: async () => null })
    await toPrompt(app)
    await app.press("Context", keys.ctrlV, keys.ctrlD)
    await app.waitForStep("Summary")

    expect(app.frame()).toMatch(fieldLine("Prompt", "Context"))
  })

  it("keeps the typed prompt when going back to the reviewers", async () => {
    const app = await startAtCouncil()
    await toPrompt(app)
    await app.press("Keep the VAT rule")
    await app.press(keys.escape)
    await app.waitForStep("Reviewer 2")
    await app.press(keys.ctrlD)
    await app.waitForStep("Review prompt")

    expect(app.frame()).toContain("Keep the VAT rule")
  })

  it("removes the last character with Backspace", async () => {
    const app = await startAtCouncil()
    await toPrompt(app)
    await app.press("VAX", keys.backspace, "T", keys.ctrlD)
    await app.waitForStep("Summary")

    expect(app.frame()).toMatch(fieldLine("Prompt", "VAT"))
  })

  it("shows only the first three lines of a long prompt in the summary", async () => {
    const app = await startAtCouncil()
    await toPrompt(app)
    await app.press(
      "One",
      keys.enter,
      "Two",
      keys.enter,
      "Three",
      keys.enter,
      "Four",
      keys.ctrlD,
    )
    await app.waitForStep("Summary")

    expect(app.frame()).toMatch(fieldLine("Prompt", "One"))
    expect(app.frame()).toMatch(/^ +Two$/m)
    expect(app.frame()).toMatch(/^ +Three\.\.\.$/m)
    expect(app.frame()).not.toContain("Four")
  })

  it("accepts an empty prompt and reviews the code alone", async () => {
    const launches: AgentLaunch[] = []
    const app = await startAtCouncil({ review: fakeReview(launches) })
    await toPrompt(app)
    await app.press(keys.ctrlD)
    await app.waitForStep("Summary")

    expect(app.frame()).toContain(
      "Prompt        none, review of the code alone",
    )
    await app.press(keys.enter)
    await app.waitForText("q quit")
    expect(launches[0]?.message).toContain(
      "## Review prompt\nNone given. Review the change on its own merits",
    )
  })
})

describe.concurrent("App summary step", () => {
  it("names a detached HEAD and a clean working tree", async () => {
    const git = fakeGitRepository({
      readState: async () => ({
        root: "/repo",
        branch: null,
        head: headCommit,
        hasChanges: false,
      }),
    })
    const app = await startAtCouncil({ git })
    await toPrompt(app)
    await app.press(keys.ctrlD)
    await app.waitForStep("Summary")

    expect(app.frame()).toMatch(fieldLine("Branch", "detached HEAD"))
    expect(app.frame()).toMatch(fieldLine("Working tree", "currently clean"))
  })
})

describe.concurrent("App run", () => {
  const toRun = async (app: Session): Promise<void> => {
    await toPrompt(app)
    await app.press(keys.ctrlD)
    await app.waitForStep("Summary")
    await app.press(keys.enter)
  }

  it("ends as failed when the change cannot be prepared for the agents", async () => {
    const app = await startAtCouncil({
      review: {
        ...fakeReview(),
        prepareWorkspace: async () => {
          throw new Error("Could not read the diff from Git")
        },
      },
    })
    await toRun(app)
    await app.waitFor("the app to exit", app.hasExited)

    expect(app.outcomes).toEqual([
      { kind: "failed", error: "Could not read the diff from Git" },
    ])
  })

  it("shows an agent that cannot be started as failed", async () => {
    const app = await startAtCouncil({
      review: {
        ...fakeReview(),
        runAgent: async () => {
          throw new Error("spawn codex ENOENT")
        },
      },
    })
    await toRun(app)
    await app.waitFor("the app to exit", app.hasExited)

    expect(app.outcomes).toEqual([
      {
        kind: "finished",
        result: expect.objectContaining({ kind: "reviewers-failed" }),
      },
    ])
    expect(app.frame()).toMatch(/code +✘ failed · spawn codex ENOENT/)
  })

  it("ends without a report when every reviewer fails", async () => {
    const app = await startAtCouncil({
      review: {
        ...fakeReview(),
        runAgent: async () => ({
          ok: false,
          error: "quota exceeded",
          sessionId: null,
        }),
      },
    })
    await toRun(app)
    await app.waitFor("the app to exit", app.hasExited)

    expect(app.outcomes).toEqual([
      {
        kind: "finished",
        result: expect.objectContaining({ kind: "reviewers-failed" }),
      },
    ])
    expect(app.frame()).toMatch(/code +✘ failed · quota exceeded/)
    expect(app.frame()).toMatch(/council +✘ failed · no reviewer reports/)
    expect(app.frames().some(frame => frame.includes("q quit"))).toBe(false)
  })
})
