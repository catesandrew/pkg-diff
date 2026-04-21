import { BaseAnalyzer } from './baseAnalyzer.js'
import { PackageManagerType } from './packageManagerType.js'
import { LockFileInterface } from './lockFile/lockFileInterface.js'
import { PackageJsonFile } from './lockFile/packageJsonFile.js'
import { NpmRegistry } from './registries/npmRegistry.js'

export class PackageJsonAnalyzer extends BaseAnalyzer {
  constructor(registry: NpmRegistry) {
    super(registry)
  }

  override getType(): PackageManagerType {
    return PackageManagerType.PackageJson
  }

  protected override createLockFileParser(content: string): LockFileInterface {
    return new PackageJsonFile(content)
  }

  protected override getAdditionalPackageFields(
    packageName: string,
    lastLockArray: Record<string, unknown>,
    previousLockArray: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      from_section: findPackageJsonSection(previousLockArray, packageName),
      to_section: findPackageJsonSection(lastLockArray, packageName),
    }
  }
}

function findPackageJsonSection(
  packageJson: Record<string, unknown>,
  packageName: string,
): string | undefined {
  for (const key of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    const node = packageJson[key]
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      continue
    }
    if (packageName in (node as Record<string, unknown>)) {
      return key
    }
  }
  return undefined
}
