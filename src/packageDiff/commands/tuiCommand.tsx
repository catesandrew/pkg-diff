import { Command } from 'commander'
import { DiffCalculator } from '../services/diffCalculator.js'
import { CacheService } from '../services/cacheService.js'
import { GitRepository } from '../services/gitRepository.js'
import { PackagistRegistry } from '../analyzers/registries/packagistRegistry.js'
import { NpmRegistry } from '../analyzers/registries/npmRegistry.js'
import { ReleaseNotesResolver } from '../analyzers/releaseNotes/releaseNotesResolver.js'
import { parsePackageJsonSections } from './sharedOptions.js'
import type { TuiPackageChange } from '../tuiNext/types.js'
import { launchPackageDiffTui } from '../tuiNext/launch.js'

interface TuiDeps {
  cache: CacheService
  diffCalculator: DiffCalculator
  gitRepository: GitRepository
  packagistRegistry: PackagistRegistry
  npmRegistry: NpmRegistry
  releaseNotesResolver: ReleaseNotesResolver
}

export function createTuiCommand({
  cache,
  diffCalculator,
  gitRepository,
  packagistRegistry,
  npmRegistry,
  releaseNotesResolver,
}: TuiDeps): Command {
  const command = new Command('tui')
    .description('Launch the Terminal User Interface to browse dependency changes')
    .option('--ignore-last', 'Ignore last commit when calculating changes')
    .option('--from <commit>', 'Commit hash, branch, or tag to compare from (older version)')
    .option(
      '--to <commit>',
      'Commit hash, branch, or tag to compare to (newer version, defaults to HEAD)',
    )
    .option('--no-cache', 'Disable cache')
    .option('--no-alt-screen', 'Disable alternate screen (ignored in TS TUI)')
    .option(
      '--sections <sections>',
      'Only include these package.json dependency sections (comma-separated)',
    )
    .option('--include-prerelease', 'Include pre-release versions in release notes')

  command.action(async () => {
    const options = command.opts()
    const ignoreLast = Boolean(options.ignoreLast)
    const noCache = Boolean(options.cache === false || options.noCache)
    const fromCommit = options.from ?? null
    const toCommit = options.to ?? null
    const sectionsOption = options.sections as string | undefined
    const includePrerelease = Boolean(options.includePrerelease)

    if ((fromCommit || toCommit) && ignoreLast) {
      process.stderr.write('Cannot use --ignore-last with --from or --to options\n')
      process.exitCode = 1
      return
    }

    try {
      if (noCache) {
        cache.disableCache()
      }

      if (ignoreLast) {
        diffCalculator.ignoreLastCommit()
      }

      const { sections, error: sectionsError } = parsePackageJsonSections(sectionsOption)
      if (sectionsError) {
        process.stderr.write(`${sectionsError}\n`)
        process.exitCode = 1
        return
      }
      diffCalculator.packageJsonOnlySections(sections)

      if (fromCommit) {
        diffCalculator.fromCommitRef(fromCommit)
      }

      if (toCommit) {
        diffCalculator.toCommitRef(toCommit)
      }

      const result = (await diffCalculator.run(false)) as ReturnType<DiffCalculator['getResult']>
      if (!result.hasAnyChanges()) {
        process.stdout.write('No dependency changes detected.\n')
        return
      }

      const packages: TuiPackageChange[] = []
      for (const diff of result.diffs) {
        for (const change of diff.changes) {
          packages.push({
            name: change.name,
            type: change.type,
            from: change.from,
            to: change.to,
            status: change.status,
            releases: change.releaseCount,
            semver: change.semver,
            filename: diff.filename,
          })
        }
      }
      await launchPackageDiffTui({
        packages,
        gitRepository,
        packagistRegistry,
        npmRegistry,
        releaseNotesResolver,
        includePrerelease,
      })
    } catch (error) {
      process.stderr.write(`${(error as Error).message}\n`)
      process.exitCode = 1
    }
  })

  return command
}
