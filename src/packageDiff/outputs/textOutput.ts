import chalk from 'chalk'
import { DiffResult } from '../data/diffResult.js'
import { DependencyDiff } from '../data/dependencyDiff.js'
import { PackageChange } from '../data/packageChange.js'
import { ChangeStatus } from '../enums/changeStatus.js'
import { SemverChange } from '../enums/semver.js'
import { PackageManagerType } from '../analyzers/packageManagerType.js'

export class TextOutput {
  constructor(
    private readonly useAnsi = true,
    private readonly showEmpty = false,
  ) {}

  format(result: DiffResult): string {
    const lines: string[] = []
    if (!result.hasDiffs()) {
      lines.push('No recent changes and no commit logs found for dependency lockfiles')
      return lines.join('\n')
    }

    if (result.hasUncommittedChanges) {
      const filenames = result.diffs.map((diff) => diff.filename).join(', ')
      lines.push(`Uncommitted changes detected on ${filenames}`)
      lines.push('')
    }

    for (const diff of result.diffs) {
      lines.push(...this.formatDiff(diff))
    }

    return lines.join('\n')
  }

  private formatDiff(diff: DependencyDiff): string[] {
    const lines: string[] = []
    const workspaceSuffix =
      diff.type === PackageManagerType.PackageJson && diff.workspaceName
        ? ` (${diff.workspaceName})`
        : ''
    if (diff.isNew) {
      const commitText = diff.toCommit ? ` created at ${diff.toCommit}` : ' created'
      lines.push(`${diff.filename}${workspaceSuffix}${commitText}`)
    } else {
      const fromCommit = diff.fromCommit ?? 'unknown'
      const toCommit = diff.toCommit ?? 'uncommitted changes'
      lines.push(`${diff.filename}${workspaceSuffix} between ${fromCommit} and ${toCommit}`)
    }
    lines.push('')

    if (!diff.hasChanges()) {
      if (this.showEmpty) {
        lines.push(' → No dependencies changes detected')
        lines.push('')
      }
      return lines
    }

    lines.push(...this.printChanges(diff))
    lines.push('')
    return lines
  }

  private printChanges(diff: DependencyDiff): string[] {
    const lines: string[] = []
    if (diff.changes.length === 0) {
      return lines
    }

    const names = diff.changes.map((c) => this.formatName(c))
    const maxNameLen = Math.max(...names.map((n) => n.length))
    const maxFromLen = Math.max(
      ...diff.changes.filter((c) => c.from).map((c) => (c.from ?? '').length),
      0,
    )
    const maxToLen = Math.max(
      ...diff.changes.filter((c) => c.to).map((c) => (c.to ?? '').length),
      0,
    )

    for (let i = 0; i < diff.changes.length; i += 1) {
      const change = diff.changes[i]!
      const symbol = this.getSymbol(change.status, change.semver)
      let line = symbol
      const name = this.formatName(change)
      line += ` ${name.padEnd(maxNameLen)}    `

      switch (change.status) {
        case ChangeStatus.Added:
          line += change.to ?? ''
          break
        case ChangeStatus.Removed:
          line += change.from ?? ''
          break
        case ChangeStatus.Updated:
        case ChangeStatus.Downgraded: {
          const fromVersion = (change.from ?? '').padEnd(maxFromLen)
          const toVersion = (change.to ?? '').padEnd(maxToLen)
          line += `${fromVersion}  →  ${toVersion}`
          if (change.releaseCount && change.releaseCount > 1) {
            line += `  (${change.releaseCount} releases)`
          }
          break
        }
        case ChangeStatus.Changed: {
          const fromVersion = (change.from ?? '').padEnd(maxFromLen)
          const toVersion = (change.to ?? '').padEnd(maxToLen)
          line += `${fromVersion}  →  ${toVersion}`
          break
        }
      }

      lines.push(line)
    }

    return lines
  }

  private formatName(change: PackageChange): string {
    const fromSection = change.fromSection
    const toSection = change.toSection
    const section =
      fromSection && toSection && fromSection !== toSection
        ? `${fromSection}→${toSection}`
        : toSection ?? fromSection
    return section ? `${change.name} (${section})` : change.name
  }

  private getSymbol(status: ChangeStatus, semver: SemverChange | null): string {
    const repeat = semver === SemverChange.Major ? 3 : semver === SemverChange.Minor ? 2 : 1
    const symbol =
      status === ChangeStatus.Added
        ? '+'
        : status === ChangeStatus.Removed
          ? '×'
          : status === ChangeStatus.Changed
            ? '~'
            : status === ChangeStatus.Updated
              ? '↑'.repeat(repeat)
              : '↓'.repeat(repeat)

    const padded = symbol.padStart(4, ' ')
    if (!this.useAnsi) {
      return padded
    }

    switch (status) {
      case ChangeStatus.Added:
        return chalk.green(padded)
      case ChangeStatus.Removed:
        return chalk.red(padded)
      case ChangeStatus.Updated:
        return chalk.cyan(padded)
      case ChangeStatus.Downgraded:
        return chalk.yellow(padded)
      case ChangeStatus.Changed:
        return chalk.magenta(padded)
    }
  }
}
