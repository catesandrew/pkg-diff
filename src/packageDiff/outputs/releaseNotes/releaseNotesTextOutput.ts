import chalk, { type ChalkInstance } from 'chalk'
import { ReleaseNote } from '../../data/releaseNote.js'
import { ReleaseNotesCollection } from '../../data/releaseNotesCollection.js'
import { GithubUrlFormatter } from '../../helpers/githubUrlFormatter.js'

export class ReleaseNotesTextOutput {
  constructor(
    private readonly summary = false,
    private readonly useAnsi = true,
  ) {}

  format(collection: ReleaseNotesCollection): string {
    if (collection.isEmpty()) {
      return 'No release notes available.'
    }

    return this.summary ? this.formatSummary(collection) : this.formatDetailed(collection)
  }

  private formatDetailed(collection: ReleaseNotesCollection): string {
    const lines: string[] = []
    lines.push('')
    lines.push(this.colorize('Release Notes', chalk.cyanBright))
    lines.push(this.colorize('─'.repeat(80), chalk.gray))
    lines.push('')

    for (const release of collection) {
      lines.push(...this.formatRelease(release))
      lines.push('')
    }

    return lines.join('\n')
  }

  private formatRelease(release: ReleaseNote): string[] {
    const lines: string[] = []
    let header = release.tagName
    if (release.title && release.title !== release.tagName) {
      header += ` - ${release.title}`
    }
    lines.push(this.colorize(header, chalk.yellowBright))
    lines.push(this.colorize(`Date: ${release.date.toISOString().slice(0, 10)}`, chalk.gray))
    if (release.url) {
      lines.push(this.colorize(`URL: ${release.url}`, chalk.gray))
    }
    lines.push('')

    if (!release.isStructured()) {
      const body = release.getBody()
      if (body) {
        for (const line of body.split('\n')) {
          if (line.trim() === '') {
            lines.push('')
          } else {
            lines.push(this.colorize(this.formatTextWithLinks(line), chalk.reset))
          }
        }
      }
      lines.push('')
    } else {
      const description = release.getDescription()
      if (description) {
        for (const line of description.split('\n')) {
          if (line.trim() === '') {
            lines.push('')
          } else {
            lines.push(this.colorize(this.formatTextWithLinks(line), chalk.reset))
          }
        }
        lines.push('')
      }

      const sections: Array<[string, string[], ChalkInstance, ChalkInstance]> = [
        ['Breaking Changes:', release.getBreakingChanges(), chalk.redBright, chalk.red],
        ['Changes:', release.getChanges(), chalk.greenBright, chalk.green],
        ['Fixes:', release.getFixes(), chalk.blueBright, chalk.blue],
        ['Deprecated:', release.getDeprecated(), chalk.yellowBright, chalk.yellow],
        ['Removed:', release.getRemoved(), chalk.redBright, chalk.red],
        ['Security:', release.getSecurity(), chalk.magentaBright, chalk.magenta],
      ]

      for (const [title, items, titleColor, bulletColor] of sections) {
        if (items.length === 0) continue
        lines.push(this.colorize(title, titleColor))
        for (const item of items) {
          lines.push(this.colorize(`  • ${this.formatTextWithLinks(item)}`, bulletColor))
        }
        lines.push('')
      }
    }

    lines.push(this.colorize('─'.repeat(80), chalk.gray))
    return lines
  }

  private formatSummary(collection: ReleaseNotesCollection): string {
    const lines: string[] = []
    lines.push('')
    lines.push(this.colorize('Release Notes Summary', chalk.cyanBright))
    lines.push(this.colorize('─'.repeat(80), chalk.gray))
    lines.push('')

    const releases = collection.getReleases()
    const first = releases[0]
    const last = releases[releases.length - 1]
    if (!first || !last) {
      return lines.join('\n')
    }
    const firstTag = first.tagName
    const lastTag = last.tagName
    const count = collection.count()
    const releasesInfo = `Changelog of: ${lastTag} → ${firstTag} (${count} versions)`

    lines.push(this.colorize(releasesInfo, chalk.gray))
    lines.push('')

    if (collection.hasUnstructuredReleases()) {
      const allBulletPoints = collection.getAllBulletPoints()
      if (allBulletPoints.length > 0) {
        lines.push(this.colorize('Changes:', chalk.greenBright))
        for (const bullet of allBulletPoints) {
          lines.push(this.colorize(`  • ${this.formatTextWithLinks(bullet)}`, chalk.green))
        }
        lines.push('')
      }
      return lines.join('\n')
    }

    const sections: Array<[string, string[], ChalkInstance, ChalkInstance]> = [
      ['Breaking Changes:', collection.getBreakingChanges(), chalk.redBright, chalk.red],
      ['Changes:', collection.getChanges(), chalk.greenBright, chalk.green],
      ['Fixes:', collection.getFixes(), chalk.blueBright, chalk.blue],
      ['Deprecated:', collection.getDeprecated(), chalk.yellowBright, chalk.yellow],
      ['Removed:', collection.getRemoved(), chalk.redBright, chalk.red],
      ['Security:', collection.getSecurity(), chalk.magentaBright, chalk.magenta],
    ]

    for (const [title, items, titleColor, bulletColor] of sections) {
      if (items.length === 0) continue
      lines.push(this.colorize(title, titleColor))
      for (const item of items) {
        lines.push(this.colorize(`  • ${this.formatTextWithLinks(item)}`, bulletColor))
      }
      lines.push('')
    }

    return lines.join('\n')
  }

  private formatTextWithLinks(text: string): string {
    return GithubUrlFormatter.toShortText(text)
  }

  private colorize(text: string, color: ChalkInstance): string {
    return this.useAnsi ? color(text) : text
  }
}
