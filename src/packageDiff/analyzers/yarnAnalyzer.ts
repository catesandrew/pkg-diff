import { BaseAnalyzer } from './baseAnalyzer.js'
import { PackageManagerType } from './packageManagerType.js'
import { LockFileInterface } from './lockFile/lockFileInterface.js'
import { YarnLockFile } from './lockFile/yarnLockFile.js'
import { NpmRegistry } from './registries/npmRegistry.js'

export class YarnAnalyzer extends BaseAnalyzer {
  constructor(registry: NpmRegistry) {
    super(registry)
  }

  override getType(): PackageManagerType {
    return PackageManagerType.Yarn
  }

  protected override createLockFileParser(content: string): LockFileInterface {
    return new YarnLockFile(content)
  }

  protected override getAdditionalPackageFields(): Record<string, unknown> {
    return {}
  }
}
