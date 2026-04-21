import { parse as parseYaml } from 'yaml'
import semver from 'semver'
import { LockFileInterface } from './lockFileInterface.js'

export class PnpmLockFile implements LockFileInterface {
  private readonly lockData: Record<string, unknown>
  private readonly packages: Map<string, { version: string; repository?: string }>

  constructor(lockFileContent: string) {
    this.lockData = (parseYaml(lockFileContent) as Record<string, unknown>) ?? {}
    this.packages = this.parsePackages()
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

  private parsePackages(): Map<string, { version: string; repository?: string }> {
    const packages = new Map<string, { version: string; repository?: string }>()
    const packagesNode = this.lockData['packages'] as
      | Record<string, Record<string, unknown>>
      | undefined
    if (!packagesNode) {
      return packages
    }

    for (const [rawKey, info] of Object.entries(packagesNode)) {
      const { name, version } = parsePnpmPackageKey(rawKey, info)
      if (!name || !version) {
        continue
      }
      const existing = packages.get(name)
      if (!existing || isHigherVersion(version, existing.version)) {
        packages.set(name, { version })
      }
    }

    return packages
  }
}

function parsePnpmPackageKey(
  key: string,
  info: Record<string, unknown>,
): { name: string | null; version: string | null } {
  let normalized = key.startsWith('/') ? key.slice(1) : key
  normalized = normalized.split('(')[0] ?? normalized

  const explicitName = typeof info['name'] === 'string' ? info['name'] : null
  const explicitVersion = typeof info['version'] === 'string' ? info['version'] : null
  if (explicitName && explicitVersion) {
    return { name: explicitName, version: explicitVersion }
  }

  const atIndex = normalized.lastIndexOf('@')
  if (atIndex <= 0) {
    return { name: null, version: null }
  }

  const name = normalized.slice(0, atIndex)
  let version = normalized.slice(atIndex + 1)
  if (version.startsWith('npm:')) {
    version = version.slice(4)
  }

  return { name, version }
}

function isHigherVersion(candidate: string, existing: string): boolean {
  const a = semver.coerce(candidate)
  const b = semver.coerce(existing)
  if (!a || !b) {
    return candidate > existing
  }
  return semver.gt(a, b)
}
