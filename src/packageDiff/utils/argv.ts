type OptionSpec = { names: string[]; takesValue: boolean }

const ROOT_ONLY_FLAGS = new Set(['-h', '--help', '-v', '--version'])

const COMMAND_OPTIONS: OptionSpec[] = [
  { names: ['--from'], takesValue: true },
  { names: ['--to'], takesValue: true },
  { names: ['--format'], takesValue: true },
  { names: ['--include'], takesValue: true },
  { names: ['--exclude'], takesValue: true },
  { names: ['--sections'], takesValue: true },
  { names: ['--type', '-t'], takesValue: true },
  { names: ['--ignore-last'], takesValue: false },
  { names: ['--no-cache'], takesValue: false },
  { names: ['--no-progress'], takesValue: false },
  { names: ['--show-empty'], takesValue: false },
  { names: ['--include-prerelease'], takesValue: false },
  { names: ['--summary', '-s'], takesValue: false },
  { names: ['--no-alt-screen'], takesValue: false },
  { names: ['-q', '--quiet'], takesValue: false },
  { names: ['--explain'], takesValue: false },
  { names: ['--fail-on'], takesValue: true },
]

function buildOptionIndex(optionSpecs: OptionSpec[]): Map<string, OptionSpec> {
  const index = new Map<string, OptionSpec>()
  for (const spec of optionSpecs) {
    for (const name of spec.names) {
      index.set(name, spec)
    }
  }
  return index
}

const COMMAND_OPTION_INDEX = buildOptionIndex(COMMAND_OPTIONS)

function isKnownCommandArg(arg: string, knownCommands: Set<string>): boolean {
  return !arg.startsWith('-') && knownCommands.has(arg)
}

export function shouldDefaultToAnalyse(args: string[], knownCommands: Set<string>): boolean {
  if (args.some((arg) => isKnownCommandArg(arg, knownCommands))) {
    return false
  }
  if (args.some((arg) => ROOT_ONLY_FLAGS.has(arg))) {
    return false
  }
  return true
}

export function moveLeadingCommandOptionsAfterCommand(
  args: string[],
  knownCommands: Set<string>,
): string[] {
  const commandIndex = args.findIndex((arg) => isKnownCommandArg(arg, knownCommands))
  if (commandIndex <= 0) {
    return args
  }

  const before = args.slice(0, commandIndex)
  const command = args[commandIndex]!
  const after = args.slice(commandIndex + 1)

  const kept: string[] = []
  const moved: string[] = []

  for (let i = 0; i < before.length; i += 1) {
    const token = before[i]!

    // Preserve root-only flags where they are.
    if (ROOT_ONLY_FLAGS.has(token)) {
      kept.push(token)
      continue
    }

    if (token.startsWith('--') && token.includes('=')) {
      const [name] = token.split('=', 1)
      const spec = name ? COMMAND_OPTION_INDEX.get(name) : undefined
      if (spec) {
        moved.push(token)
        continue
      }
      kept.push(token)
      continue
    }

    const spec = COMMAND_OPTION_INDEX.get(token)
    if (!spec) {
      kept.push(token)
      continue
    }

    moved.push(token)
    if (spec.takesValue) {
      const value = before[i + 1]
      if (value !== undefined) {
        moved.push(value)
        i += 1
      }
    }
  }

  return [...kept, command, ...moved, ...after]
}
