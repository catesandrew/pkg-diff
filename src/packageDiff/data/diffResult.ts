import { DependencyDiff } from './dependencyDiff.js'

export class DiffResult {
  constructor(
    public readonly diffs: DependencyDiff[],
    public readonly hasUncommittedChanges = false,
  ) {}

  hasDiffs(): boolean {
    return this.diffs.length > 0
  }

  hasAnyChanges(): boolean {
    return this.diffs.some((diff) => diff.hasChanges())
  }

  getAllChanges() {
    return this.diffs.flatMap((diff) => diff.changes)
  }
}
