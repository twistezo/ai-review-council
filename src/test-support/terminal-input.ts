export const terminalKeys = {
  left: "\u001b[D",
  right: "\u001b[C",
  backspace: "\x7f",
  forwardDelete: "\u001b[3~",
} as const

const delay = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms))

export const waitUntil = async (
  description: string,
  isReady: () => boolean,
): Promise<void> => {
  const deadline = Date.now() + 2_000
  while (!isReady()) {
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for ${description}`)
    }
    await delay(5)
  }
}

type RenderedInput = {
  stdin: {
    write: (data: string) => void
    listenerCount: (eventName: string) => number
  }
  lastFrame: () => string | undefined
}

// Tests render without color, so a moved cursor leaves the frame as it was.
const cursorKeys = new Set<string>([terminalKeys.left, terminalKeys.right])

// Types each key once the previous one is on screen.
export const typeKeys = async (
  { stdin, lastFrame }: RenderedInput,
  keys: readonly string[],
): Promise<void> => {
  await waitUntil(
    "the input to listen",
    () => stdin.listenerCount("readable") > 0,
  )
  for (const key of keys) {
    const previous = lastFrame()
    stdin.write(key)
    if (cursorKeys.has(key)) {
      continue
    }
    await waitUntil(
      `the frame after ${JSON.stringify(key)}`,
      () => lastFrame() !== previous,
    )
  }
}
