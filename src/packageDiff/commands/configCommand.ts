import { Command } from 'commander'
import { ConfigService } from '../services/configService.js'
import { stringify as stringifyYaml } from 'yaml'

interface ConfigDeps {
  config: ConfigService
}

export function createConfigCommand({ config }: ConfigDeps): Command {
  const command = new Command('config')
    .description('Get or set configuration values')
    .argument('[key]', 'Configuration key (use dot notation for nested values)')
    .argument('[value]', 'Value to set')

  command.action(async (key?: string, value?: string) => {
    if (!key) {
      process.stdout.write(stringifyYaml(config.getAll(), { indent: 2 }) + '\n')
      return
    }

    if (value === undefined) {
      const configValue = config.get(key)
      if (configValue === undefined || configValue === null) {
        process.stderr.write(`Configuration key '${key}' not found\n`)
        process.exitCode = 1
        return
      }

      if (typeof configValue === 'object') {
        process.stdout.write(
          stringifyYaml(configValue as Record<string, unknown>, { indent: 2 }) + '\n',
        )
      } else {
        process.stdout.write(String(configValue) + '\n')
      }
      return
    }

    const parsedValue = parseValue(value)
    await config.set(key, parsedValue)
    process.stdout.write(`Configuration updated: ${key} = ${value}\n`)
  })

  return command
}

function parseValue(value: string): string | number | boolean {
  if (value.toLowerCase() === 'true') return true
  if (value.toLowerCase() === 'false') return false
  if (!Number.isNaN(Number(value))) {
    return value.includes('.') ? Number.parseFloat(value) : Number.parseInt(value, 10)
  }
  return value
}
