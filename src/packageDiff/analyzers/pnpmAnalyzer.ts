import { BaseAnalyzer } from './baseAnalyzer.js'
import { PackageManagerType } from './packageManagerType.js'
import { LockFileInterface } from './lockFile/lockFileInterface.js'
import { PnpmLockFile } from './lockFile/pnpmLockFile.js'
import { NpmRegistry } from './registries/npmRegistry.js'

export class PnpmAnalyzer extends BaseAnalyzer {
  constructor(registry: NpmRegistry) {
    super(registry)
  }

  override getType(): PackageManagerType {
    return PackageManagerType.Pnpm
  }

  protected override createLockFileParser(content: string): LockFileInterface {
    return new PnpmLockFile(content)
  }

  protected override getAdditionalPackageFields(): Record<string, unknown> {
    return {}
  }
}
