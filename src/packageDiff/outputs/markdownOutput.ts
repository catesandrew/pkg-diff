import { DiffResult } from '../data/diffResult.js'
import { DependencyDiff } from '../data/dependencyDiff.js'
import { SemverChange } from '../enums/semver.js'
import { PackageManagerType } from '../analyzers/packageManagerType.js'

export class MarkdownOutput {
  constructor(private readonly showEmpty = false) {}

  format(result: DiffResult): string {
    if (!result.hasAnyChanges()) {
      return this.showEmpty
        ? '# Dependency Changes\n\nNo dependency changes detected.'
        : 'No dependency changes detected.'
    }

    const lines: string[] = []
    lines.push('# Dependency Changes')
    lines.push('')

    if (result.hasUncommittedChanges) {
      lines.push('> **Note:** Showing uncommitted changes')
      lines.push('')
    }

    for (const diff of result.diffs) {
      lines.push(...this.formatDiff(diff))
    }

    return lines.join('\n')
  }

  private formatDiff(diff: DependencyDiff): string[] {
    if (!diff.hasChanges() && !this.showEmpty) {
      return []
    }

    const lines: string[] = []
    const workspaceSuffix =
      diff.type === PackageManagerType.PackageJson && diff.workspaceName
        ? ` (${diff.workspaceName})`
        : ''
    lines.push(`## ${diff.filename}${workspaceSuffix}`)

    if (diff.isNew) {
      lines.push('*File created*')
    } else {
      const fromCommit = diff.fromCommit ? diff.fromCommit.slice(0, 7) : 'unknown'
      const toCommit = diff.toCommit ? diff.toCommit.slice(0, 7) : 'uncommitted'
      lines.push(`*Changes from \`${fromCommit}\` to \`${toCommit}\`*`)
    }

    lines.push('')

    if (!diff.hasChanges()) {
      lines.push('No dependency changes detected.')
      lines.push('')
      return lines
    }

    const added = diff.getAddedPackages()
    if (added.length) {
      lines.push('### Added')
      lines.push('')
      lines.push('| Package | Version |')
      lines.push('|---------|---------|')
      for (const change of added) {
        lines.push(`| **${change.name}** | \`${change.to}\` |`)
      }
      lines.push('')
    }

    const removed = diff.getRemovedPackages()
    if (removed.length) {
      lines.push('### Removed')
      lines.push('')
      lines.push('| Package | Version |')
      lines.push('|---------|---------|')
      for (const change of removed) {
        lines.push(`| **${change.name}** | \`${change.from}\` |`)
      }
      lines.push('')
    }

    const updated = diff.getUpdatedPackages()
    if (updated.length) {
      lines.push('### Updated')
      lines.push('')
      lines.push('| Package | From | To | Change | Releases |')
      lines.push('|---------|------|----|--------|----------|')
      for (const change of updated) {
        const semver = this.getSemverEmoji(change.semver)
        const releaseText = this.getReleaseText(change.releaseCount ?? null)
        lines.push(
          `| **${change.name}** | \`${change.from}\` | \`${change.to}\` | ${semver} | ${releaseText} |`,
        )
      }
      lines.push('')
    }

    const downgraded = diff.getDowngradedPackages()
    if (downgraded.length) {
      lines.push('### Downgraded')
      lines.push('')
      lines.push('| Package | From | To | Change | Releases |')
      lines.push('|---------|------|----|--------|----------|')
      for (const change of downgraded) {
        const semver = this.getSemverEmoji(change.semver)
        const releaseText = this.getReleaseText(change.releaseCount ?? null)
        lines.push(
          `| **${change.name}** | \`${change.from}\` | \`${change.to}\` | ${semver} | ${releaseText} |`,
        )
      }
      lines.push('')
    }

    const changed = diff.getChangedPackages()
    if (changed.length) {
      lines.push('### Changed (non-semver)')
      lines.push('')
      lines.push('| Package | From | To | From section | To section |')
      lines.push('|---------|------|----|--------------|------------|')
      for (const change of changed) {
        lines.push(
          `| **${change.name}** | \`${change.from}\` | \`${change.to}\` | \`${change.fromSection ?? ''}\` | \`${change.toSection ?? ''}\` |`,
        )
      }
      lines.push('')
    }

    return lines
  }

  private getSemverEmoji(semver: SemverChange | null): string {
    if (!semver) return ''
    switch (semver) {
      case SemverChange.Major:
        return '🔴 Major'
      case SemverChange.Minor:
        return '🟡 Minor'
      case SemverChange.Patch:
        return '🟢 Patch'
    }
  }

  private getReleaseText(releaseCount: number | null): string {
    if (!releaseCount || releaseCount === 0) {
      return ''
    }
    return String(releaseCount)
  }
}
