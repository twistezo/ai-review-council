#!/usr/bin/env node
import { render } from 'ink'

import { formatAppTitle, readAppInfo } from './app-info.js'
import { createAppServices } from './app-services.js'
import { parseCliOptions, usage } from './cli-options.js'
import { printOutcome } from './print-outcome.js'
import { cleanUpAfterCancel, describeCleanup, installShutdownCleanup } from './shutdown.js'
import type { WizardOutcome } from './ui/app.js'
import { App } from './ui/app.js'

const main = async (): Promise<void> => {
  installShutdownCleanup()
  const parsed = parseCliOptions(process.argv.slice(2))
  if (!parsed.ok) {
    console.error(`${parsed.error}\n\n${usage}`)
    process.exitCode = 2

    return
  }
  if (parsed.options.showHelp) {
    console.log(usage)

    return
  }

  const appInfo = readAppInfo()
  const result: { outcome: WizardOutcome } = { outcome: { kind: 'cancelled' } }
  const instance = render(
    <App
      title={formatAppTitle(appInfo)}
      services={createAppServices(process.cwd(), appInfo)}
      presets={{
        language: parsed.options.language,
        directory: parsed.options.directory,
        scope: parsed.options.scope,
        reviewerCount: parsed.options.reviewerCount,
      }}
      timeoutMinutes={parsed.options.timeoutMinutes}
      onFinish={(outcome) => {
        result.outcome = outcome
      }}
    />,
  )
  await instance.waitUntilExit()

  if (result.outcome.kind === 'cancelled') {
    const message = describeCleanup(await cleanUpAfterCancel())
    if (message !== null) {
      console.log(`\n${message}\n`)
    }
  }
  process.exitCode = printOutcome(result.outcome)
}

await main()
