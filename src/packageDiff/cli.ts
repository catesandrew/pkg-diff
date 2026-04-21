#!/usr/bin/env node
import { Command } from 'commander'
import { createServices } from './app.js'
import { createAnalyseCommand } from './commands/analyseCommand.js'
import { createBetweenCommand } from './commands/betweenCommand.js'
import { createCheckCommand } from './commands/checkCommand.js'
import { createConfigCommand } from './commands/configCommand.js'
import { createChangelogCommand } from './commands/changelogCommand.js'
import { createTuiCommand } from './commands/tuiCommand.js'
import { moveLeadingCommandOptionsAfterCommand, shouldDefaultToAnalyse } from './utils/argv.js'

async function main() {
  const services = await createServices()

  const program = new Command('package-diff')
    .description('package-diff is a CLI tool to inspect dependency changes')
    .version('dev', '-v, --version')

  program.addCommand(
    createAnalyseCommand({ cache: services.cache, diffCalculator: services.diffCalculator }),
  )
  program.addCommand(
    createBetweenCommand({ cache: services.cache, diffCalculator: services.diffCalculator }),
  )
  program.addCommand(createCheckCommand({ diffCalculator: services.diffCalculator }))
  program.addCommand(createConfigCommand({ config: services.config }))
  program.addCommand(
    createChangelogCommand({
      gitRepository: services.gitRepository,
      packagistRegistry: services.packagistRegistry,
      npmRegistry: services.npmRegistry,
      cache: services.cache,
      releaseNotesResolver: services.releaseNotesResolver,
    }),
  )
  program.addCommand(
    createTuiCommand({
      cache: services.cache,
      diffCalculator: services.diffCalculator,
      gitRepository: services.gitRepository,
      packagistRegistry: services.packagistRegistry,
      npmRegistry: services.npmRegistry,
      releaseNotesResolver: services.releaseNotesResolver,
    }),
  )

  const knownCommands = new Set(['analyse', 'between', 'check', 'config', 'changelog', 'tui'])

  // Support `pnpm dev -- ...` and similar patterns.
  if (process.argv[2] === '--') {
    process.argv.splice(2, 1)
  }

  // Commander expects subcommand options after the subcommand name. Users often do:
  // `package-diff --from develop tui`
  // Normalize args so those "leading" options apply to the intended command.
  const rawArgs = process.argv.slice(2)
  const normalizedArgs = moveLeadingCommandOptionsAfterCommand(rawArgs, knownCommands)
  process.argv.splice(2, process.argv.length - 2, ...normalizedArgs)

  // Default to analyse only when the user didn't ask for help/version.
  const effectiveArgs = process.argv.slice(2)
  if (shouldDefaultToAnalyse(effectiveArgs, knownCommands)) {
    process.argv.splice(2, 0, 'analyse')
  }

  await program.parseAsync(process.argv)
}

main().catch((error) => {
  process.stderr.write(`Error: ${(error as Error).message}\n`)
  process.exit(1)
})
