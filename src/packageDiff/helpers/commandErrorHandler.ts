export class CommandErrorHandler {
  static handle(error: Error, format?: string, exitCode = 1): number {
    const message = error.message
    if (format === 'json') {
      process.stdout.write(JSON.stringify({ error: message }, null, 2) + '\n')
    } else {
      process.stderr.write(`Error: ${message}\n`)
    }
    return exitCode
  }

  static handleQuiet(error: Error, quiet: boolean, exitCode = 2): number {
    if (!quiet) {
      process.stderr.write(`Error: ${error.message}\n`)
    }
    return exitCode
  }
}
