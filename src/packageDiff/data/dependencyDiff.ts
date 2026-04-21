import { PackageManagerType } from '../analyzers/packageManagerType.js'
import { ChangeStatus } from '../enums/changeStatus.js'
import { PackageChange } from './packageChange.js'

export class DependencyDiff {
  constructor(
    public readonly filename: string,
    public readonly type: PackageManagerType,
    public readonly fromCommit: string | null,
    public readonly toCommit: string | null,
    public readonly changes: PackageChange[],
    public readonly isNew = false,
    public readonly workspaceName: string | null = null,
  ) {}

  hasChanges(): boolean {
    return this.changes.length > 0
  }

  getAddedPackages(): PackageChange[] {
    return this.changes.filter((change) => change.status === ChangeStatus.Added)
  }

  getRemovedPackages(): PackageChange[] {
    return this.changes.filter((change) => change.status === ChangeStatus.Removed)
  }

  getUpdatedPackages(): PackageChange[] {
    return this.changes.filter((change) => change.status === ChangeStatus.Updated)
  }

  getDowngradedPackages(): PackageChange[] {
    return this.changes.filter((change) => change.status === ChangeStatus.Downgraded)
  }

  getChangedPackages(): PackageChange[] {
    return this.changes.filter((change) => change.status === ChangeStatus.Changed)
  }
}
