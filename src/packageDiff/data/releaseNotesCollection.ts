import { ReleaseNote } from './releaseNote.js'
import { GithubUrlFormatter } from '../helpers/githubUrlFormatter.js'

export class ReleaseNotesCollection implements Iterable<ReleaseNote> {
  constructor(private readonly releases: ReleaseNote[] = []) {}

  [Symbol.iterator](): Iterator<ReleaseNote> {
    return this.releases[Symbol.iterator]()
  }

  isEmpty(): boolean {
    return this.releases.length === 0
  }

  count(): number {
    return this.releases.length
  }

  getReleases(): ReleaseNote[] {
    return this.releases
  }

  getChanges(): string[] {
    return this.releases.flatMap((release) => release.getChanges())
  }

  getFixes(): string[] {
    return this.releases.flatMap((release) => release.getFixes())
  }

  getBreakingChanges(): string[] {
    return this.releases.flatMap((release) => release.getBreakingChanges())
  }

  getDeprecated(): string[] {
    return this.releases.flatMap((release) => release.getDeprecated())
  }

  getRemoved(): string[] {
    return this.releases.flatMap((release) => release.getRemoved())
  }

  getSecurity(): string[] {
    return this.releases.flatMap((release) => release.getSecurity())
  }

  hasUnstructuredReleases(): boolean {
    return this.releases.some((release) => !release.isStructured())
  }

  getAllBulletPoints(): string[] {
    return this.releases.flatMap((release) => release.getAllBulletPoints())
  }

  toMarkdown(): string {
    if (this.releases.length === 0) return ''
    let markdown = ''
    for (const release of this.releases) {
      markdown += `## ${release.tagName}`
      if (release.title && release.title !== release.tagName) {
        markdown += ` - ${release.title}`
      }
      markdown += '\n\n'
      if (release.url) {
        markdown += `**Release URL:** ${release.url}\n\n`
      }
      markdown += `**Date:** ${release.date.toISOString().slice(0, 10)}\n\n`
      markdown += this.formatGithubUrls(release.body)
      markdown += '\n\n---\n\n'
    }
    return markdown.trim()
  }

  toSummarizedMarkdown(): string {
    if (this.releases.length === 0) return ''
    const first = this.releases[0]
    const last = this.releases[this.releases.length - 1]
    if (!first || !last) {
      return ''
    }
    const firstTag = first.tagName
    const lastTag = last.tagName
    const count = this.releases.length

    let markdown = '# Release Notes Summary\n\n'
    markdown += `**Releases:** ${firstTag} → ${lastTag} (${count} versions)\n\n`

    if (this.hasUnstructuredReleases()) {
      const allBulletPoints = this.getAllBulletPoints()
      if (allBulletPoints.length > 0) {
        markdown += '## All Changes\n\n'
        for (const bullet of allBulletPoints) {
          markdown += `- ${this.formatGithubUrls(bullet)}\n`
        }
        markdown += '\n'
      }
      return markdown.trim()
    }

    const sections: Array<[string, string[]]> = [
      ['Breaking Changes', this.getBreakingChanges()],
      ['Changes', this.getChanges()],
      ['Fixes', this.getFixes()],
      ['Deprecated', this.getDeprecated()],
      ['Removed', this.getRemoved()],
      ['Security', this.getSecurity()],
    ]

    for (const [title, items] of sections) {
      if (items.length === 0) continue
      markdown += `## ${title}\n\n`
      for (const item of items) {
        markdown += `- ${this.formatGithubUrls(item)}\n`
      }
      markdown += '\n'
    }

    return markdown.trim()
  }

  private formatGithubUrls(text: string): string {
    return GithubUrlFormatter.toMarkdownLink(text)
  }
}
