import fs from 'node:fs/promises'
import path from 'node:path'
import semver from 'semver'
import parseChangelog from 'changelog-parser'
import { PackageManagerType } from '../../packageManagerType.js'
import { ChangelogParser } from '../changelogParser.js'
import { ReleaseNotesFetcherInterface } from '../releaseNotesFetcherInterface.js'
import { ReleaseNotesCollection } from '../../../data/releaseNotesCollection.js'
import { VersionNormalizer } from '../../../helpers/versionNormalizer.js'
import { ReleaseNote } from '../../../data/releaseNote.js'

interface ParsedChangelog {
  versions?: ParsedVersion[]
}

interface ParsedVersion {
  version?: string
  title?: string
  date?: string
  body?: string
}

export class LocalVendorChangelogFetcher implements ReleaseNotesFetcherInterface {
  private static readonly CHANGELOG_FILENAMES = ['CHANGELOG.md', 'CHANGELOG']

  constructor(private readonly parser: ChangelogParser) {}

  supports(_repositoryUrl: string, localPath: string | null): boolean {
    return Boolean(localPath)
  }

  async fetch(
    _packageName: string,
    fromVersion: string,
    toVersion: string,
    _repositoryUrl: string,
    _packageManagerType: PackageManagerType,
    localPath: string | null,
    includePrerelease: boolean,
  ): Promise<ReleaseNotesCollection | null> {
    if (!localPath) {
      return null
    }

    const changelogPath = await this.findChangelogFile(localPath)
    if (!changelogPath) {
      return null
    }

    const content = await fs.readFile(changelogPath, 'utf8').catch(() => '')
    if (!content.trim()) {
      return null
    }

    const result = this.parser.parse(content, fromVersion, toVersion, includePrerelease)
    if (this.hasToVersion(result, toVersion)) {
      return result
    }

    const fallback = await this.parseWithChangelogParser(
      content,
      fromVersion,
      toVersion,
      includePrerelease,
    )
    if (fallback && this.hasToVersion(fallback, toVersion)) {
      return fallback
    }

    if (!result.isEmpty()) {
      return null
    }

    return fallback
  }

  private async findChangelogFile(directory: string): Promise<string | null> {
    for (const filename of LocalVendorChangelogFetcher.CHANGELOG_FILENAMES) {
      const fullPath = path.join(directory, filename)
      try {
        await fs.access(fullPath)
        return fullPath
      } catch {
        // continue
      }
    }
    return null
  }

  private hasToVersion(result: ReleaseNotesCollection, toVersion: string): boolean {
    const normalizedTo = VersionNormalizer.normalize(toVersion)
    return result.getReleases().some((release) => {
      try {
        const releaseVersion = VersionNormalizer.normalize(release.tagName)
        return releaseVersion === normalizedTo
      } catch {
        return false
      }
    })
  }

  private async parseWithChangelogParser(
    content: string,
    fromVersion: string,
    toVersion: string,
    includePrerelease: boolean,
  ): Promise<ReleaseNotesCollection | null> {
    let parsed: ParsedChangelog
    try {
      parsed = (await parseChangelog({
        text: content,
        removeMarkdown: false,
      })) as ParsedChangelog
    } catch {
      return null
    }

    const releases: ReleaseNote[] = []
    const normalizedFrom = VersionNormalizer.normalize(fromVersion)
    const normalizedTo = VersionNormalizer.normalize(toVersion)

    for (const version of parsed.versions ?? []) {
      if (!version.version || !version.body?.trim()) {
        continue
      }

      if (
        !this.isVersionInRange(version.version, normalizedFrom, normalizedTo, includePrerelease)
      ) {
        continue
      }

      const date = version.date ? new Date(version.date) : new Date()
      const title = version.title ?? version.version
      releases.push(
        new ReleaseNote(
          version.version,
          title,
          version.body.trim(),
          Number.isNaN(date.getTime()) ? new Date() : date,
          null,
        ),
      )
    }

    if (releases.length === 0) {
      return null
    }

    return new ReleaseNotesCollection(releases)
  }

  private isVersionInRange(
    version: string,
    fromVersion: string,
    toVersion: string,
    includePrerelease: boolean,
  ): boolean {
    let normalized: string
    try {
      normalized = VersionNormalizer.normalize(version)
    } catch {
      return false
    }

    if (!includePrerelease && semver.prerelease(normalized) !== null) {
      return false
    }

    if (fromVersion === toVersion) {
      return normalized === fromVersion
    }

    const v = semver.coerce(normalized)
    const from = semver.coerce(fromVersion)
    const to = semver.coerce(toVersion)
    if (!v || !from || !to) {
      return false
    }

    return semver.gt(v, from) && semver.lte(v, to)
  }
}
