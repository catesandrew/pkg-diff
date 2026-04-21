import { PackageManagerType } from '../analyzers/packageManagerType.js'
import { ChangeStatus } from '../enums/changeStatus.js'
import { SemverChange } from '../enums/semver.js'

export class PackageChange {
  constructor(
    public readonly name: string,
    public readonly type: PackageManagerType,
    public readonly from: string | null,
    public readonly to: string | null,
    public readonly status: ChangeStatus,
    public readonly releaseCount: number | null = null,
    public readonly semver: SemverChange | null = null,
    public readonly fromSection: string | null = null,
    public readonly toSection: string | null = null,
  ) {}

  static added(
    name: string,
    type: PackageManagerType,
    version: string,
    toSection: string | null = null,
  ): PackageChange {
    return new PackageChange(name, type, null, version, ChangeStatus.Added, null, null, null, toSection)
  }

  static removed(
    name: string,
    type: PackageManagerType,
    version: string,
    fromSection: string | null = null,
  ): PackageChange {
    return new PackageChange(name, type, version, null, ChangeStatus.Removed, null, null, fromSection, null)
  }

  static updated(
    name: string,
    type: PackageManagerType,
    fromVersion: string,
    toVersion: string,
    releaseCount: number | null = null,
    semver: SemverChange | null = null,
    fromSection: string | null = null,
    toSection: string | null = null,
  ): PackageChange {
    return new PackageChange(
      name,
      type,
      fromVersion,
      toVersion,
      ChangeStatus.Updated,
      releaseCount,
      semver,
      fromSection,
      toSection,
    )
  }

  static downgraded(
    name: string,
    type: PackageManagerType,
    fromVersion: string,
    toVersion: string,
    releaseCount: number | null = null,
    semver: SemverChange | null = null,
    fromSection: string | null = null,
    toSection: string | null = null,
  ): PackageChange {
    return new PackageChange(
      name,
      type,
      fromVersion,
      toVersion,
      ChangeStatus.Downgraded,
      releaseCount,
      semver,
      fromSection,
      toSection,
    )
  }

  static changed(
    name: string,
    type: PackageManagerType,
    fromVersion: string,
    toVersion: string,
    fromSection: string | null = null,
    toSection: string | null = null,
  ): PackageChange {
    return new PackageChange(
      name,
      type,
      fromVersion,
      toVersion,
      ChangeStatus.Changed,
      null,
      null,
      fromSection,
      toSection,
    )
  }
}
