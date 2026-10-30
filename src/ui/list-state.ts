export const clampIndex = (index: number, length: number): number => Math.max(0, Math.min(index, length - 1))

export type ListWindow = {
  start: number
  end: number
}

// Keeps the selected row near the middle of a fixed-height window.
export const visibleWindow = (length: number, selected: number, size: number): ListWindow => {
  const start = clampIndex(selected - Math.floor(size / 2), Math.max(0, length - size + 1))

  return { start, end: Math.min(length, start + size) }
}
