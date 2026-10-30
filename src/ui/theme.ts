// ANSI color names, so the terminal theme sets the exact shade. On Dracula, blue renders purple and magenta pink.
export const theme = {
  // app and step titles
  title: 'blue',
  // the column or list in focus, and work in progress
  focus: 'blue',
  // the highlighted option where the cursor is
  selection: 'magenta',
  // the text cursor in input fields
  cursor: 'blue',
  // options already chosen in columns out of focus
  chosen: 'blue',
  success: 'green',
  warning: 'yellow',
  failure: 'red',
  muted: 'gray',
} as const

export type ThemeRole = keyof typeof theme
