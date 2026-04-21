import { BaseAnalyzer } from './baseAnalyzer.js'
import { PackageManagerType, getRegistryUrl } from './packageManagerType.js'
import { LockFileInterface } from './lockFile/lockFileInterface.js'
import { ComposerLockFile } from './lockFile/composerLockFile.js'
import { PackagistRegistry } from './registries/packagistRegistry.js'

export class ComposerAnalyzer extends BaseAnalyzer {
  constructor(registry: PackagistRegistry) {
    super(registry)
  }

  override getType(): PackageManagerType {
    return PackageManagerType.Composer
  }

  protected override createLockFileParser(content: string): LockFileInterface {
    return new ComposerLockFile(content)
  }

  protected override getAdditionalPackageFields(
    packageName: string,
    lastLockArray: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      infos_url: this.getPackageUrl(packageName, lastLockArray),
    }
  }

  private getPackageUrl(name: string, composerLock: Record<string, unknown>): string {
    let url = getRegistryUrl(PackageManagerType.Composer, name)
    const packages = Array.isArray(composerLock['packages'])
      ? (composerLock['packages'] as Array<Record<string, unknown>>)
      : []
    const devPackages = Array.isArray(composerLock['packages-dev'])
      ? (composerLock['packages-dev'] as Array<Record<string, unknown>>)
      : []

    const packageInfo = [...packages, ...devPackages].find((pkg) => pkg['name'] === name)
    if (!packageInfo) {
      return url
    }

    const dist = packageInfo['dist'] as Record<string, unknown> | undefined
    const distUrl = dist && typeof dist['url'] === 'string' ? dist['url'] : ''
    let host = ''
    if (distUrl) {
      try {
        host = new URL(distUrl).host
      } catch {
        host = ''
      }
    }

    if (host && host !== 'repo.packagist.org' && host !== 'api.github.com') {
      return `https://${host}/p2/${name}.json`
    }

    return url
  }
}
