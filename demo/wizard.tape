Output wizard.gif

Require node
Require npx
Require clear

Set Shell "bash"
Set Theme "Dracula"
Set FontSize 18
Set Width 1200
Set Height 900
Set Padding 20
Set Framerate 15
Set TypingSpeed 35ms

Hide
Type "clear && cd .. && exec npx --no-install tsx src/cli.tsx"
Enter
Wait+Screen@60s /Report language/
Show

# English, bug-farm project, entire codebase.
Sleep 500ms
Enter
Sleep 500ms
# Append the fixture path to the prefilled project root.
Type "/demo/bug-farm"
Sleep 500ms
Enter
Sleep 500ms
Down 2
Sleep 500ms
Enter
Sleep 500ms

# Council: Claude Code, Opus 5.5, low.
Down
Right
Right
Up
Sleep 500ms
Enter
Sleep 500ms

# Three reviewers.
Down 2
Sleep 500ms
Enter
Sleep 500ms

# Codex, GPT-6.1 Terra, low, code.
Right
Down 2
Right
Up
Sleep 500ms
Enter
Sleep 500ms

# Claude Code, Sonnet 5.5, low, security.
Down
Right
Down
Right
Up
Sleep 500ms
Enter
Sleep 500ms

# Codex, GPT-6-Luna, low, ui-ux.
Right
Down 4
Right
Up
Sleep 500ms
Enter
Sleep 500ms

Type "make no mistakes"
Sleep 500ms
Ctrl+D
Sleep 500ms
Enter

# Match the completion header
Wait+Screen@21m /Reviewed [0-9]+ file/
Sleep 5s
Hide
Type "q"
Sleep 500ms
