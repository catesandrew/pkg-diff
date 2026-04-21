import fs from 'node:fs/promises'
import path from 'node:path'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'

const APP_DIR = '.package-diff'
const LEGACY_APP_DIR = '.whatsdiff'

export class ConfigService {
  private readonly configPath: string
  private config: Record<string, unknown> = {}
  private readonly defaults: Record<string, unknown> = {
    cache: {
      enabled: true,
      'min-time': 300,
      'max-time': 86400,
    },
    tui: {
      mode: 'summary',
    },
  }

  constructor(configPath?: string) {
    this.configPath = configPath ?? this.getDefaultConfigPath()
  }

  async init(): Promise<void> {
    await this.loadConfig()
  }

  get<T = unknown>(key: string, defaultValue?: T): T {
    const value = getNested(this.config, key)
    if (value === undefined || value === null) {
      const fallback = getNested(this.defaults, key)
      return (defaultValue ?? (fallback as T)) as T
    }
    return value as T
  }

  async set(key: string, value: unknown): Promise<void> {
    setNested(this.config, key, value)
    await this.saveConfig()
  }

  getAll(): Record<string, unknown> {
    return deepMerge(this.defaults, this.config)
  }

  getConfigPath(): string {
    return this.configPath
  }

  private getDefaultConfigPath(): string {
    const home = process.env.HOME ?? process.env.USERPROFILE
    if (!home) {
      throw new Error('Cannot determine home directory')
    }
    return path.join(home, APP_DIR, 'config.yaml')
  }

  private async loadConfig(): Promise<void> {
    await this.ensureConfigExists()
    try {
      const content = await fs.readFile(this.configPath, 'utf8')
      this.config = (parseYaml(content) as Record<string, unknown>) ?? {}
    } catch {
      this.config = {}
    }
  }

  private async saveConfig(): Promise<void> {
    await this.ensureConfigExists()
    const yaml = stringifyYaml(this.config, { indent: 2 })
    await fs.writeFile(this.configPath, yaml, 'utf8')
  }

  private async ensureConfigExists(): Promise<void> {
    const dir = path.dirname(this.configPath)
    await fs.mkdir(dir, { recursive: true })
    try {
      await fs.access(this.configPath)
    } catch {
      // Best-effort migration for users coming from the legacy name/location.
      const legacy = this.getLegacyConfigPath()
      if (legacy) {
        try {
          await fs.access(legacy)
          await fs.copyFile(legacy, this.configPath)
          return
        } catch {
          // ignore and fall back to defaults
        }
      }
      const yaml = stringifyYaml(this.defaults, { indent: 2 })
      await fs.writeFile(this.configPath, yaml, 'utf8')
    }
  }

  private getLegacyConfigPath(): string | null {
    const home = process.env.HOME ?? process.env.USERPROFILE
    if (!home) {
      return null
    }
    return path.join(home, LEGACY_APP_DIR, 'config.yaml')
  }
}

function getNested(obj: Record<string, unknown>, key: string): unknown {
  if (!key) return obj
  return key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part]
    }
    return undefined
  }, obj)
}

function setNested(obj: Record<string, unknown>, key: string, value: unknown): void {
  const parts = key.split('.').filter(Boolean)
  if (parts.length === 0) {
    return
  }
  let current: Record<string, unknown> = obj
  for (const part of parts.slice(0, -1)) {
    const next = current[part]
    if (!next || typeof next !== 'object') {
      current[part] = {}
    }
    current = current[part] as Record<string, unknown>
  }
  const last = parts.at(-1)
  if (!last) {
    return
  }
  current[last] = value
}

function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(override)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof base[key] === 'object' &&
      base[key] &&
      !Array.isArray(base[key])
    ) {
      result[key] = deepMerge(
        base[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      )
    } else {
      result[key] = value as unknown
    }
  }
  return result
}
