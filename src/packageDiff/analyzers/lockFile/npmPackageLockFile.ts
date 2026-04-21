import { LockFileInterface } from './lockFileInterface.js'

export class NpmPackageLockFile implements LockFileInterface {
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
    const packagesNode = (this.lockData as Record<string, unknown>)['packages']
    if (!packagesNode || typeof packagesNode !== 'object') {
      return packages
    }

    for (const [key, value] of Object.entries(
      packagesNode as Record<string, Record<string, unknown>>,
    )) {
      if (!key || !value || typeof value !== 'object') {
        continue
      }
      const version = typeof value['version'] === 'string' ? value['version'] : null
      if (!version) {
        continue
      }
      const packageName = key.replace(/^node_modules\//, '')
      if (!packageName) {
        continue
      }
      const data: { version: string; repository?: string } = { version }
      if (typeof value['resolved'] === 'string') {
        data.repository = value['resolved']
      }
      packages.set(packageName, data)
    }

    return packages
  }
}
