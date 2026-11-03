import { render } from "ink-testing-library"
import { useState } from "react"
import type { JSX } from "react"
import { describe, expect, it } from "vitest"

import {
  terminalKeys,
  typeKeys,
  waitUntil,
} from "../../test-support/terminal-input.js"
import { TextInput } from "./text-input.js"

const { left, backspace, forwardDelete } = terminalKeys

type HarnessProps = {
  onSubmit: (value: string) => void
}

// Tab stands in for folder completion: it appends a slash to the whole value.
const Harness = ({ onSubmit }: HarnessProps): JSX.Element => {
  const [value, setValue] = useState("")

  return (
    <TextInput
      value={value}
      onChange={setValue}
      onSubmit={() => onSubmit(value)}
      onTab={() => setValue(previous => `${previous}/`)}
    />
  )
}

// Types the keys, then submits with Enter.
const submitTyped = async (keys: readonly string[]): Promise<string[]> => {
  const submitted: string[] = []
  const rendered = render(<Harness onSubmit={value => submitted.push(value)} />)
  await typeKeys(rendered, keys)
  rendered.stdin.write("\r")
  await waitUntil("the submit", () => submitted.length > 0)

  return submitted
}

describe("TextInput", () => {
  it("fixes a typo in the middle of a path", async () => {
    expect(await submitTyped(["~/projcts", left, left, left, "e"])).toEqual([
      "~/projects",
    ])
  })

  it("removes the character before the cursor with Backspace", async () => {
    expect(await submitTyped(["abXc", left, backspace])).toEqual(["abc"])
  })

  it("removes the character after the cursor with forward Delete", async () => {
    expect(await submitTyped(["abXc", left, left, forwardDelete])).toEqual([
      "abc",
    ])
  })

  it("keeps an accented folder name whole when moving over it", async () => {
    expect(await submitTyped(["~/zdjęcia", left, left, left, "X"])).toEqual([
      "~/zdjęXcia",
    ])
  })

  it("keeps typing at the end after Tab completion", async () => {
    expect(await submitTyped(["src", left, "\t", "x"])).toEqual(["src/x"])
  })

  it("puts a pasted path on one line at the cursor", async () => {
    expect(await submitTyped(["/a", "\u001b[200~b\nc\u001b[201~"])).toEqual([
      "/ab c",
    ])
  })
})
