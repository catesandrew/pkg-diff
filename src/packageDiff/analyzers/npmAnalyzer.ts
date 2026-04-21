import { BaseAnalyzer } from './baseAnalyzer.js'
import { PackageManagerType } from './packageManagerType.js'
import { LockFileInterface } from './lockFile/lockFileInterface.js'
import { NpmPackageLockFile } from './lockFile/npmPackageLockFile.js'
import { NpmRegistry } from './registries/npmRegistry.js'

export class NpmAnalyzer extends BaseAnalyzer {
  constructor(registry: NpmRegistry) {
    super(registry)
  }

  override getType(): PackageManagerType {
    return PackageManagerType.Npm
  }

  protected override createLockFileParser(content: string): LockFileInterface {
    return new NpmPackageLockFile(content)
  }

  protected override getAdditionalPackageFields(): Record<string, unknown> {
    return {}
  }
}
