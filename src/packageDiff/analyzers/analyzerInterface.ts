import { PackageManagerType } from './packageManagerType.js'

export interface AnalyzerInterface {
  getType(): PackageManagerType
  calculateDiff(
    lastLockContent: string,
    previousLockContent: string | null,
  ): Record<string, PackageDiffInfo>
  getReleasesCount(
    packageName: string,
    fromVersion: string,
    toVersion: string,
    context?: Record<string, unknown>,
  ): Promise<number | null> | number | null
}

export interface PackageDiffInfo {
  name: string
  from: string | null
  to: string | null
  infos_url?: string
  from_section?: string
  to_section?: string
}
