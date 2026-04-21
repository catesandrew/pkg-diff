import { PackageManagerType } from '../analyzers/packageManagerType.js'

export class DependencyFile {
  constructor(
    public readonly file: string,
    public readonly type: PackageManagerType,
    public readonly hasBeenRecentlyUpdated: boolean,
    public readonly hasCommitLogs: boolean,
    public readonly commitLogs: string[],
  ) {}

  static create(type: PackageManagerType, file: string): DependencyFile {
    return new DependencyFile(file, type, false, false, [])
  }

  withUpdatedStatus(
    hasBeenRecentlyUpdated: boolean,
    hasCommitLogs: boolean,
    commitLogs: string[],
  ): DependencyFile {
    return new DependencyFile(
      this.file,
      this.type,
      hasBeenRecentlyUpdated,
      hasCommitLogs,
      commitLogs,
    )
  }

  withFile(file: string): DependencyFile {
    return new DependencyFile(
      file,
      this.type,
      this.hasBeenRecentlyUpdated,
      this.hasCommitLogs,
      this.commitLogs,
    )
  }
}
