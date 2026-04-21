import semver from 'semver'
import { LockFileInterface } from './lockFileInterface.js'

export class YarnLockFile implements LockFileInterface {
  private readonly packages: Map<string, { version: string; repository?: string }>

  constructor(lockFileContent: string) {
    this.packages = this.parsePackages(lockFileContent)
  }

  getPackages(): Map<string, { version: string; repository?: string }> {
    return this.packages
  }

  getVersion(packageName: string): string | null {
    return this.packages.get(packageName)?.version ?? null
  }

  getRepositoryUrl(packageName: string): string | null {
    return this.packages.get(packageName)?.repository ?? null
  }

  getAllVersions(): Record<string, string> {
    const versions: Record<string, string> = {}
    for (const [name, data] of this.packages.entries()) {
      versions[name] = data.version
    }
    return versions
  }

  private parsePackages(content: string): Map<string, { version: string; repository?: string }> {
    const packages = new Map<string, { version: string; repository?: string }>()
    const lines = content.split(/\r?\n/)

    let currentKeys: string[] = []
    for (const line of lines) {
      if (!line.trim()) {
        continue
      }

      if (!line.startsWith(' ') && line.endsWith(':')) {
        const raw = line.slice(0, -1)
        const segments = raw.split(',').map((segment) => segment.trim())
        currentKeys = segments
          .map((segment) => segment.replace(/^"|"$/g, ''))
          .map((segment) => extractPackageName(segment))
          .filter((name): name is string => Boolean(name))
        continue
      }

      if (line.trim().startsWith('version')) {
        const trimmed = line.trim()
        const match = trimmed.match(/^version\s+"([^"]+)"/)
        const yamlMatch = trimmed.match(/^version:\s+"?([^"]+)"?/)
        const version = match ? match[1] : yamlMatch ? yamlMatch[1] : null
        if (!version) {
          continue
        }
        for (const name of currentKeys) {
          const existing = packages.get(name)
          if (!existing || isHigherVersion(version, existing.version)) {
            packages.set(name, { version })
          }
        }
      }
    }

    return packages
  }
}

function extractPackageName(key: string): string | null {
  const normalized = key.replace(/^"|"$/g, '')
  const atIndex = normalized.lastIndexOf('@')
  if (atIndex <= 0) {
    return null
  }
  return normalized.slice(0, atIndex)
}

function isHigherVersion(candidate: string, existing: string): boolean {
  const a = semver.coerce(candidate)
  const b = semver.coerce(existing)
  if (!a || !b) {
    return candidate > existing
  }
  return semver.gt(a, b)
}
