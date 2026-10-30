import { homedir } from 'node:os'

import type { AppInfo } from './app-info.js'
import { createClipboardReader } from './clipboard/read-clipboard.js'
import { runAgent } from './execution/run-agent.js'
import { createGitRepository } from './git/git-repository.js'
import { findMissingInstructionFiles, instructionsDirectory, readInstructions } from './instructions/instruction-files.js'
import { startJsonLineProcess } from './process/json-line-process.js'
import { runCommand } from './process/run-command.js'
import { createClaudeAdapter } from './providers/claude-adapter.js'
import { createCodexAdapter } from './providers/codex-adapter.js'
import { createWorkspacePreparer } from './review/review-workspace.js'
import type { AppServices } from './ui/app.js'

// The real services: local CLIs, Git, the shipped instructions and the macOS clipboard.
export const createAppServices = (cwd: string, appInfo: AppInfo): AppServices => {
  const git = createGitRepository(runCommand)

  return {
    git,
    adapters: [
      createCodexAdapter(runCommand, startJsonLineProcess, appInfo),
      createClaudeAdapter(runCommand, startJsonLineProcess),
    ],
    findMissingInstructionFiles: () => findMissingInstructionFiles(instructionsDirectory),
    readClipboard: createClipboardReader(runCommand),
    review: {
      runAgent,
      prepareWorkspace: createWorkspacePreparer(git),
      readInstructions: (files) => readInstructions(instructionsDirectory, files),
      now: Date.now,
    },
    cwd,
    homeDirectory: homedir(),
  }
}
