import { LockFileInterface } from './lockFileInterface.js'

export class ComposerLockFile implements LockFileInterface {
  private readonly lockData: Record<string, unknown>
  private readonly packages: Map<string, { version: string; repository?: string }>

  constructor(lockFileContent: string) {
    this.lockData = (JSON.parse(lockFileContent) as Record<string, unknown>) ?? {}
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
    const regular = Array.isArray((this.lockData as Record<string, unknown>)['packages'])
      ? ((this.lockData as Record<string, unknown>)['packages'] as Array<Record<string, unknown>>)
      : []
    const dev = Array.isArray((this.lockData as Record<string, unknown>)['packages-dev'])
      ? ((this.lockData as Record<string, unknown>)['packages-dev'] as Array<
          Record<string, unknown>
        >)
      : []

    const allPackages = [...regular, ...dev]

    for (const pkg of allPackages) {
      const name = typeof pkg['name'] === 'string' ? pkg['name'] : null
      const version = typeof pkg['version'] === 'string' ? pkg['version'] : null
      if (!name || !version) {
        continue
      }
      const data: { version: string; repository?: string } = { version }
      if (pkg['source'] && typeof (pkg['source'] as Record<string, unknown>)['url'] === 'string') {
        data.repository = (pkg['source'] as Record<string, unknown>)['url'] as string
      } else if (
        pkg['dist'] &&
        typeof (pkg['dist'] as Record<string, unknown>)['url'] === 'string'
      ) {
        data.repository = (pkg['dist'] as Record<string, unknown>)['url'] as string
      }
      packages.set(name, data)
    }

    return packages
  }
}
