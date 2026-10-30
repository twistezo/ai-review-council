import type { ProviderId } from '../domain/review-session.js'
import type { RunCommand } from '../process/run-command.js'
import { isSuccessful } from '../process/run-command.js'
import type { ProviderStatus } from './provider-adapter.js'

export type CliStatusCheck = {
  provider: ProviderId
  command: string
  loginStatusArgs: readonly string[]
  installFix: string
  loginFix: string
}

// Reads the existing CLI login only; never starts a login flow.
export const checkCliStatus = async (run: RunCommand, check: CliStatusCheck): Promise<ProviderStatus> => {
  const versionResult = await run(check.command, ['--version'])
  if (versionResult.failure === 'not-found') {
    return {
      provider: check.provider,
      version: null,
      problem: `\`${check.command}\` was not found in PATH.`,
      fix: check.installFix,
    }
  }
  if (!isSuccessful(versionResult)) {
    return {
      provider: check.provider,
      version: null,
      problem: `\`${check.command} --version\` failed: ${versionResult.stderr.trim()}`,
      fix: check.installFix,
    }
  }
  const version = versionResult.stdout.trim()
  const loginResult = await run(check.command, check.loginStatusArgs)
  if (!isSuccessful(loginResult)) {
    return { provider: check.provider, version, problem: 'Not logged in.', fix: check.loginFix }
  }

  return { provider: check.provider, version, problem: null, fix: null }
}
