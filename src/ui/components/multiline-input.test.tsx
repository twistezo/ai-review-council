import { render } from "ink-testing-library"
import { useState } from "react"
import type { JSX } from "react"
import { describe, expect, it } from "vitest"

import {
  terminalKeys,
  typeKeys,
  waitUntil,
} from "../../test-support/terminal-input.js"
import { MultilineInput } from "./multiline-input.js"

const { left, right, backspace, forwardDelete } = terminalKeys

type HarnessProps = {
  onSubmit: (value: string) => void
  readClipboard: () => Promise<string | null>
}

const Harness = ({ onSubmit, readClipboard }: HarnessProps): JSX.Element => {
  const [value, setValue] = useState("")

  return (
    <MultilineInput
      value={value}
      onChange={setValue}
      onSubmit={() => onSubmit(value)}
      readClipboard={readClipboard}
    />
  )
}

// Types each key once the previous one is on screen, then submits with Ctrl+D.
const submitTyped = async (
  keys: readonly string[],
  readClipboard: () => Promise<string | null> = async () => null,
): Promise<string[]> => {
  const submitted: string[] = []
  const rendered = render(
    <Harness
      onSubmit={value => submitted.push(value)}
      readClipboard={readClipboard}
    />,
  )
  await typeKeys(rendered, keys)
  rendered.stdin.write("\x04")
  await waitUntil("the submit", () => submitted.length > 0)

  return submitted
}

describe("MultilineInput", () => {
  it("adds a new line with Enter and submits with Ctrl+D", async () => {
    expect(await submitTyped(["one", "\r", "two"])).toEqual(["one\ntwo"])
  })

  it("also takes Shift+Enter from terminals that report it as a new line", async () => {
    expect(await submitTyped(["one", "\u001b[13;2u", "two"])).toEqual([
      "one\ntwo",
    ])
  })

  it("removes the last character with Backspace, across a line break too", async () => {
    expect(await submitTyped(["one", "\r", backspace, backspace, "X"])).toEqual(
      ["onX"],
    )
  })

  it("pastes the clipboard with Ctrl+V, turning Windows line endings into new lines", async () => {
    expect(
      await submitTyped(["A: ", "\x16"], async () => "one\r\ntwo\rthree"),
    ).toEqual(["A: one\ntwo\nthree"])
  })

  it("fixes a typo in the middle without retyping the rest", async () => {
    expect(
      await submitTyped(["Totl VAT", left, left, left, left, left, "a"]),
    ).toEqual(["Total VAT"])
  })

  it("removes the character before the cursor with Backspace", async () => {
    expect(await submitTyped(["abXc", left, backspace])).toEqual(["abc"])
  })

  it("moves the cursor across a line break", async () => {
    expect(
      await submitTyped(["one", "\r", "two", left, left, left, left, "!"]),
    ).toEqual(["one!\ntwo"])
  })

  it("moves back to the end with the right arrow", async () => {
    expect(await submitTyped(["ab", left, left, right, right, "c"])).toEqual([
      "abc",
    ])
  })

  it("pastes at the cursor", async () => {
    expect(await submitTyped(["ac", left, "\u001b[200~b\u001b[201~"])).toEqual([
      "abc",
    ])
  })

  it("removes the character after the cursor with forward Delete", async () => {
    expect(await submitTyped(["abXc", left, left, forwardDelete])).toEqual([
      "abc",
    ])
  })

  it("moves over and removes an emoji as one character", async () => {
    expect(await submitTyped(["a😀b", left, left, "X"])).toEqual(["aX😀b"])
    expect(await submitTyped(["a😀b", left, backspace])).toEqual(["ab"])
    expect(await submitTyped(["a👍🏽b", left, left, forwardDelete])).toEqual([
      "ab",
    ])
  })

  it("applies keys from one input chunk in order", async () => {
    expect(await submitTyped(["xy", `a${left}b`])).toEqual(["xyba"])
    expect(await submitTyped([`a${left}b`])).toEqual(["ba"])
  })

  it("takes a terminal paste with its line breaks", async () => {
    expect(await submitTyped(["\u001b[200~one\r\ntwo\u001b[201~"])).toEqual([
      "one\ntwo",
    ])
  })
})
