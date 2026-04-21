import { LockFileInterface } from './lockFileInterface.js'

const DEP_SECTIONS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
] as const

type DependencySection = (typeof DEP_SECTIONS)[number]

export class PackageJsonFile implements LockFileInterface {
  private readonly data: Record<string, unknown>
  private readonly packages: Map<string, { version: string; repository?: string }>

  constructor(packageJsonContent: string) {
    this.data = safeParseJsonObject(packageJsonContent)
    this.packages = this.parsePackages()
  }

  getPackages(): Map<string, { version: string; repository?: string }> {
    return this.packages
  }

  getVersion(packageName: string): string | null {
    return this.packages.get(packageName)?.version ?? null
  }

  getRepositoryUrl(_packageName: string): string | null {
    return null
  }

  getAllVersions(): Record<string, string> {
    const versions: Record<string, string> = {}
    for (const [name, info] of this.packages.entries()) {
      versions[name] = info.version
    }
    return versions
  }

  private parsePackages(): Map<string, { version: string; repository?: string }> {
    const packages = new Map<string, { version: string; repository?: string }>()

    for (const section of DEP_SECTIONS) {
      const deps = this.getDependencySection(section)
      if (!deps) continue

      for (const [name, version] of Object.entries(deps)) {
        // If a package appears in multiple sections, keep the first seen.
        if (!name || packages.has(name)) continue
        if (typeof version === 'string' && version) {
          packages.set(name, { version })
        }
      }
    }

    return packages
  }

  private getDependencySection(section: DependencySection): Record<string, unknown> | null {
    const node = this.data[section]
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      return null
    }
    return node as Record<string, unknown>
  }
}

function safeParseJsonObject(content: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(content) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return {}
  } catch {
    return {}
  }
}

