import type { ProviderId } from '../domain/review-session.js'
import type { RunCommand } from '../process/run-command.js'
import { isSuccessful } from '../process/run-command.js'
import type { ProviderStatus } from './provider-adapter.js'

type CliStatusCheck = {
  provider: ProviderId
  command: string
  versionArgs?: readonly string[]
  // null when the CLI has no command that reads the login without starting it
  loginStatusArgs: readonly string[] | null
  installFix: string
  loginFix: string
}

// Reads the existing CLI login only; never starts a login flow.
export const checkCliStatus = async (run: RunCommand, check: CliStatusCheck): Promise<ProviderStatus> => {
  const versionArgs = check.versionArgs ?? ['--version']
  const versionResult = await run(check.command, versionArgs)
  if (versionResult.failure === 'not-found') {
    return {
      provider: check.provider,
      version: null,
      problem: `\`${check.command}\` was not found in PATH.`,
      fix: check.installFix,
      loginChecked: false,
    }
  }
  if (!isSuccessful(versionResult)) {
    return {
      provider: check.provider,
      version: null,
      problem: `\`${check.command} ${versionArgs.join(' ')}\` failed: ${versionResult.stderr.trim()}`,
      fix: check.installFix,
      loginChecked: false,
    }
  }
  const version = versionResult.stdout.trim()
  if (check.loginStatusArgs === null) {
    return { provider: check.provider, version, problem: null, fix: null, loginChecked: false }
  }
  const loginResult = await run(check.command, check.loginStatusArgs)
  if (!isSuccessful(loginResult)) {
    return { provider: check.provider, version, problem: 'Not logged in.', fix: check.loginFix, loginChecked: true }
  }

  return { provider: check.provider, version, problem: null, fix: null, loginChecked: true }
}
