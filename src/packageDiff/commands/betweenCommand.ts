import { Command } from 'commander'
import { addSharedOptions, parsePackageJsonSections, parsePackageManagerTypes } from './sharedOptions.js'
import { TextOutput } from '../outputs/textOutput.js'
import { JsonOutput } from '../outputs/jsonOutput.js'
import { MarkdownOutput } from '../outputs/markdownOutput.js'
import { CommandErrorHandler } from '../helpers/commandErrorHandler.js'
import { DiffCalculator } from '../services/diffCalculator.js'
import { CacheService } from '../services/cacheService.js'

interface BetweenDeps {
  cache: CacheService
  diffCalculator: DiffCalculator
}

export function createBetweenCommand({ cache, diffCalculator }: BetweenDeps): Command {
  const command = new Command('between')
    .description('Compare dependency changes between two commits, branches, or tags')
    .argument('<from>', 'The starting commit, branch, or tag to compare from (older version)')
    .argument(
      '[to]',
      'The ending commit, branch, or tag to compare to (newer version, defaults to HEAD)',
      'HEAD',
    )
    .option(
      '--fail-on <rules>',
      'Exit with code 1 if any change matches the rule(s) (comma-separated: any, major, minor, patch, added, removed, updated, downgraded, changed)',
    )

  addSharedOptions(command)

  command.action(async (fromArg, toArg) => {
    const options = command.opts()
    const format = String(options.format ?? 'text')
    const showEmpty = Boolean(options.showEmpty)
    const noCache = Boolean(options.cache === false || options.noCache)
    const includeTypes = options.include as string | undefined
    const excludeTypes = options.exclude as string | undefined
    const sectionsOption = options.sections as string | undefined
    const explain = Boolean(options.explain)
    const failOn = options.failOn as string | undefined

    if (options.ignoreLast) {
      process.stderr.write('Cannot use --ignore-last with between command\n')
      process.exitCode = 1
      return
    }

    if (includeTypes && excludeTypes) {
      process.stderr.write('Cannot use both --include and --exclude options\n')
      process.exitCode = 1
      return
    }

    try {
      if (noCache) {
        cache.disableCache()
      }

      const { types, error } = parsePackageManagerTypes(includeTypes, excludeTypes)
      if (!types) {
        process.stderr.write(`${error}\n`)
        process.exitCode = 1
        return
      }

      const { sections, error: sectionsError } = parsePackageJsonSections(sectionsOption)
      if (sectionsError) {
        process.stderr.write(`${sectionsError}\n`)
        process.exitCode = 1
        return
      }
      diffCalculator.packageJsonOnlySections(sections)

      for (const type of types) {
        diffCalculator.for(type)
      }
      if (showEmpty) {
        diffCalculator.includeEmptyDiffsWhenNoChanges()
      }

      diffCalculator.fromCommitRef(fromArg)
      diffCalculator.toCommitRef(toArg ?? 'HEAD')

      const showProgress = format === 'text' && process.stdout.isTTY === true && !options.noProgress
      if (showProgress) {
        const { total, generator } = (await diffCalculator.run(true)) as {
          total: number
          generator: AsyncGenerator<unknown>
        }

        if (total > 0) {
          await showProgressBar(total, generator)
        } else {
          for await (const _ of generator) {
            // drain
          }
        }

        const result = diffCalculator.getResult()
        const formatter = getFormatter(format, process.stdout.isTTY ?? false, showEmpty)
        process.stdout.write(formatter.format(result) + '\n')
        if (explain) {
          writeExplain(result)
        }
        if (failOn) {
          if (shouldFailOn(result, failOn)) {
            process.exitCode = 1
          }
        }
      } else {
        const result = (await diffCalculator.run(false)) as ReturnType<DiffCalculator['getResult']>
        const formatter = getFormatter(format, process.stdout.isTTY ?? false, showEmpty)
        process.stdout.write(formatter.format(result) + '\n')
        if (explain) {
          writeExplain(result)
        }
        if (failOn) {
          if (shouldFailOn(result, failOn)) {
            process.exitCode = 1
          }
        }
      }
    } catch (error) {
      const exitCode = CommandErrorHandler.handle(error as Error, format)
      process.exitCode = exitCode
    }
  })

  return command
}

function getFormatter(format: string, useAnsi: boolean, showEmpty: boolean) {
  switch (format) {
    case 'json':
      return new JsonOutput()
    case 'markdown':
      return new MarkdownOutput(showEmpty)
    default:
      return new TextOutput(useAnsi, showEmpty)
  }
}

async function showProgressBar(total: number, generator: AsyncGenerator<unknown>): Promise<void> {
  let processed = 0
  const start = Date.now()
  let progressStarted = false

  for await (const _ of generator) {
    processed += 1
    const elapsed = Date.now() - start
    if (!progressStarted && elapsed >= 1000) {
      progressStarted = true
    }
    if (progressStarted) {
      const percent = Math.min(100, Math.round((processed / total) * 100))
      process.stdout.write(`\rAnalysing changes.. ${processed}/${total} (${percent}%)`)
    }
  }

  if (progressStarted) {
    process.stdout.write('\n')
  }
}

function writeExplain(result: ReturnType<DiffCalculator['getResult']>): void {
  for (const diff of result.diffs) {
    const from = diff.fromCommit ?? 'unknown'
    const to = diff.toCommit ?? 'working tree'
    process.stderr.write(`[explain] ${diff.filename}: ${from} -> ${to}\n`)
  }
}

function shouldFailOn(result: ReturnType<DiffCalculator['getResult']>, failOn: string): boolean {
  const rules = new Set(
    failOn
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  )
  if (rules.size === 0) return false
  if (rules.has('none')) return false

  const changes = result.getAllChanges()
  if (rules.has('any')) {
    return changes.length > 0
  }

  for (const change of changes) {
    if (rules.has(change.status)) {
      return true
    }
    if (change.semver && rules.has(change.semver)) {
      return true
    }
  }

  return false
}
