import { homedir } from "node:os"

import type { AppInfo } from "./app-info.js"
import { createClipboardReader } from "./clipboard/read-clipboard.js"
import { createClipboardWriter } from "./clipboard/write-clipboard.js"
import { runAgent } from "./execution/run-agent.js"
import { createGitRepository } from "./git/git-repository.js"
import {
  findMissingInstructionFiles,
  instructionsDirectory,
  readInstructions,
} from "./instructions/instruction-files.js"
import {
  currentDesktopSession,
  desktopCommandsFor,
} from "./platform/desktop-commands.js"
import { startJsonLineProcess } from "./process/json-line-process.js"
import { launchCommand } from "./process/launch-command.js"
import { pipeToCommand } from "./process/pipe-to-command.js"
import { runCommand } from "./process/run-command.js"
import { createClaudeAdapter } from "./providers/claude-adapter.js"
import { createCodexAdapter } from "./providers/codex-adapter.js"
import { createCopilotAdapter } from "./providers/copilot-adapter.js"
import { createReportOpener } from "./review/open-report.js"
import { createWorkspacePreparer } from "./review/review-workspace.js"
import type { AppServices } from "./ui/app.js"

// The real services: local CLIs, Git, the shipped instructions and the desktop clipboard and opener.
export const createAppServices = (
  cwd: string,
  appInfo: AppInfo,
): AppServices => {
  const git = createGitRepository(runCommand)
  const copilot = createCopilotAdapter(runCommand)
  const desktop = desktopCommandsFor(currentDesktopSession())

  return {
    git,
    adapters: [
      createCodexAdapter(runCommand, startJsonLineProcess, appInfo),
      createClaudeAdapter(runCommand, startJsonLineProcess),
      copilot,
    ],
    findMissingInstructionFiles: () =>
      findMissingInstructionFiles(instructionsDirectory),
    readClipboard: createClipboardReader(runCommand, desktop.paste),
    writeClipboard: createClipboardWriter(pipeToCommand, desktop.copy),
    openReport: createReportOpener(launchCommand, desktop.open),
    review: {
      runAgent: (launch, options) =>
        runAgent({ ...launch, copilotCommand: copilot.command() }, options),
      prepareWorkspace: createWorkspacePreparer(git),
      readInstructions: files => readInstructions(instructionsDirectory, files),
      now: Date.now,
    },
    cwd,
    homeDirectory: homedir(),
  }
}
