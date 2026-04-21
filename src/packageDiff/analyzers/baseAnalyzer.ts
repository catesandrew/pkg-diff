import { AnalyzerInterface, PackageDiffInfo } from './analyzerInterface.js'
import { LockFileInterface } from './lockFile/lockFileInterface.js'
import { RegistryInterface } from './registries/registryInterface.js'

export abstract class BaseAnalyzer implements AnalyzerInterface {
  protected readonly registry: RegistryInterface

  protected constructor(registry: RegistryInterface) {
    this.registry = registry
  }

  abstract getType(): import('./packageManagerType.js').PackageManagerType

  extractPackageVersions(lockContent: Record<string, unknown>): Record<string, string> {
    const json = JSON.stringify(lockContent ?? {})
    const parser = this.createLockFileParser(json)
    return parser.getAllVersions()
  }

  calculateDiff(
    lastLockContent: string,
    previousLockContent: string | null,
  ): Record<string, PackageDiffInfo> {
    let lastLockArray: Record<string, unknown> = {}
    let previousLockArray: Record<string, unknown> = {}
    try {
      lastLockArray = (JSON.parse(lastLockContent) as Record<string, unknown>) ?? {}
    } catch {
      lastLockArray = {}
    }
    try {
      previousLockArray = (JSON.parse(previousLockContent ?? '{}') as Record<string, unknown>) ?? {}
    } catch {
      previousLockArray = {}
    }

    const current = this.createLockFileParser(lastLockContent)
    const previous = this.createLockFileParser(previousLockContent ?? '{}')

    const currentVersions = current.getAllVersions()
    const previousVersions = previous.getAllVersions()

    const diff: Record<string, PackageDiffInfo> = {}

    for (const [name, version] of Object.entries(previousVersions)) {
      diff[name] = {
        name,
        from: version,
        to: currentVersions[name] ?? null,
        ...this.getAdditionalPackageFields(name, lastLockArray, previousLockArray),
      }
    }

    for (const [name, version] of Object.entries(currentVersions)) {
      if (Object.prototype.hasOwnProperty.call(previousVersions, name)) {
        continue
      }
      diff[name] = {
        name,
        from: null,
        to: version,
        ...this.getAdditionalPackageFields(name, lastLockArray, previousLockArray),
      }
    }

    const filteredEntries = Object.entries(diff)
      .filter(([, info]) => info.from !== info.to)
      .sort(([a], [b]) => a.localeCompare(b))

    return Object.fromEntries(filteredEntries)
  }

  async getReleasesCount(
    packageName: string,
    fromVersion: string,
    toVersion: string,
    context: Record<string, unknown> = {},
  ): Promise<number | null> {
    try {
      const releases = await this.registry.getVersions(packageName, fromVersion, toVersion, context)
      return releases.length
    } catch {
      return null
    }
  }

  protected abstract createLockFileParser(content: string): LockFileInterface

  protected getAdditionalPackageFields(
    _packageName: string,
    _lastLockArray: Record<string, unknown>,
    _previousLockArray: Record<string, unknown>,
  ): Record<string, unknown> {
    return {}
  }
}
