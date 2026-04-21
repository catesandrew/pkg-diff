import { DiffResult } from '../data/diffResult.js'

export class JsonOutput {
  format(result: DiffResult): string {
    const data = {
      schema_version: 1,
      has_uncommitted_changes: result.hasUncommittedChanges,
      diffs: result.diffs.map((diff) => ({
        filename: diff.filename,
        type: diff.type,
        from_commit: diff.fromCommit,
        to_commit: diff.toCommit,
        is_new: diff.isNew,
        workspace_name: diff.workspaceName,
        changes: diff.changes.map((change) => ({
          name: change.name,
          type: change.type,
          from: change.from,
          to: change.to,
          status: change.status,
          semver: change.semver,
          release_count: change.releaseCount,
          from_section: change.fromSection,
          to_section: change.toSection,
        })),
      })),
    }

    return JSON.stringify(data, null, 2)
  }
}
