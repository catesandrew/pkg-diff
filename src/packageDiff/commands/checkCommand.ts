import { Command } from 'commander'
import { CheckType } from '../enums/checkType.js'
import { ChangeStatus } from '../enums/changeStatus.js'
import { CommandErrorHandler } from '../helpers/commandErrorHandler.js'
import { DiffCalculator } from '../services/diffCalculator.js'

interface CheckDeps {
  diffCalculator: DiffCalculator
}

export function createCheckCommand({ diffCalculator }: CheckDeps): Command {
  const command = new Command('check')
    .description('Check if a specific package has changed')
    .argument('<package>', 'Package name to check (e.g., livewire/livewire)')
    .option('--has-any-change', 'Check if package has any change (default)')
    .option('--is-updated', 'Check if package was updated')
    .option('--is-downgraded', 'Check if package was downgraded')
    .option('--is-removed', 'Check if package was removed')
    .option('--is-added', 'Check if package was added')
    .option('--is-changed', 'Check if package changed but is not a semver upgrade/downgrade')
    .option('-q, --quiet', 'Suppress all output')

  command.action(async (packageName: string) => {
    const options = command.opts()
    const quiet = Boolean(options.quiet)
    const checkType = determineCheckType(options)

    try {
      const result = (await diffCalculator.skipReleaseCountFetch().run(false)) as ReturnType<
        DiffCalculator['getResult']
      >

      let packageChange = null
      for (const diff of result.diffs) {
        for (const change of diff.changes) {
          if (change.name === packageName) {
            packageChange = change
            break
          }
        }
        if (packageChange) break
      }

      const isMatch = evaluatePackageChange(packageChange, checkType)
      if (!quiet) {
        process.stdout.write(`${isMatch ? 'true' : 'false'}\n`)
      }
      process.exitCode = isMatch ? 0 : 1
    } catch (error) {
      const exitCode = CommandErrorHandler.handleQuiet(error as Error, quiet, 2)
      process.exitCode = exitCode
    }
  })

  return command
}

function determineCheckType(options: Record<string, unknown>): CheckType {
  if (options['is-updated']) return CheckType.Updated
  if (options['is-downgraded']) return CheckType.Downgraded
  if (options['is-removed']) return CheckType.Removed
  if (options['is-added']) return CheckType.Added
  if (options['is-changed']) return CheckType.Changed
  return CheckType.Any
}

function evaluatePackageChange(
  packageChange: { status: ChangeStatus } | null,
  checkType: CheckType,
): boolean {
  if (!packageChange) {
    return false
  }

  switch (checkType) {
    case CheckType.Any:
      return true
    case CheckType.Updated:
      return packageChange.status === ChangeStatus.Updated
    case CheckType.Downgraded:
      return packageChange.status === ChangeStatus.Downgraded
    case CheckType.Removed:
      return packageChange.status === ChangeStatus.Removed
    case CheckType.Added:
      return packageChange.status === ChangeStatus.Added
    case CheckType.Changed:
      return packageChange.status === ChangeStatus.Changed
  }
}
