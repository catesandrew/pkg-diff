import semver from 'semver'
import { ReleaseNote } from '../../data/releaseNote.js'
import { ReleaseNotesCollection } from '../../data/releaseNotesCollection.js'
import { VersionNormalizer } from '../../helpers/versionNormalizer.js'

export class ChangelogParser {
  parse(
    content: string,
    fromVersion: string,
    toVersion: string,
    includePrerelease = false,
  ): ReleaseNotesCollection {
    const releases: ReleaseNote[] = []
    const normalizedFrom = VersionNormalizer.normalize(fromVersion)
    const normalizedTo = VersionNormalizer.normalize(toVersion)

    const lines = content.split('\n')
    let currentVersion: string | null = null
    let currentDate: string | null = null
    let currentContent: string[] = []

    for (const line of lines) {
      const versionData = this.parseVersionHeader(line)
      if (versionData) {
        if (currentVersion !== null) {
          const release = this.createReleaseNote(
            currentVersion,
            currentDate,
            currentContent.join('\n'),
          )
          if (
            release &&
            this.isVersionInRange(currentVersion, normalizedFrom, normalizedTo, includePrerelease)
          ) {
            releases.push(release)
          }
        }
        currentVersion = versionData.version
        currentDate = versionData.date
        currentContent = []
        continue
      }

      if (currentVersion !== null && line.trim() !== '') {
        currentContent.push(line)
      }
    }

    if (currentVersion !== null) {
      const release = this.createReleaseNote(currentVersion, currentDate, currentContent.join('\n'))
      if (
        release &&
        this.isVersionInRange(currentVersion, normalizedFrom, normalizedTo, includePrerelease)
      ) {
        releases.push(release)
      }
    }

    return new ReleaseNotesCollection(releases)
  }

  private parseVersionHeader(line: string): { version: string; date: string | null } | null {
    const trimmed = line.trim()
    const patterns = [
      /^##\s+v?(\d+\.\d+\.\d+(?:[.-][\w.]+)?)\s+-\s+(\d{4}-\d{2}-\d{2})/,
      /^##\s+\[v?(\d+\.\d+\.\d+(?:[.-][\w.]+)?)\]\s+-\s+(\d{4}-\d{2}-\d{2})/,
      /^##\s+v?(\d+\.\d+\.\d+(?:[.-][\w.]+)?)\s+\((\d{4}-\d{2}-\d{2})\)/,
      /^##\s+v?(\d+\.\d+\.\d+(?:[.-][\w.]+)?)\s*$/,
    ]

    for (const pattern of patterns) {
      const match = trimmed.match(pattern)
      if (match) {
        const version = match[1]
        if (!version) {
          continue
        }
        return { version, date: match[2] ?? null }
      }
    }

    return null
  }

  private createReleaseNote(
    version: string,
    dateString: string | null,
    body: string,
  ): ReleaseNote | null {
    if (!body.trim()) {
      return null
    }

    const date = dateString ? new Date(dateString) : new Date()
    return new ReleaseNote(version, version, body.trim(), date, null)
  }

  private isVersionInRange(
    version: string,
    fromVersion: string,
    toVersion: string,
    includePrerelease: boolean,
  ): boolean {
    const normalizedVersion = VersionNormalizer.normalize(version)

    if (!includePrerelease && this.isPrerelease(normalizedVersion)) {
      return false
    }

    if (fromVersion === toVersion) {
      return normalizedVersion === fromVersion
    }

    const v = semver.coerce(normalizedVersion)
    const from = semver.coerce(fromVersion)
    const to = semver.coerce(toVersion)
    if (!v || !from || !to) {
      return false
    }

    return semver.gt(v, from) && semver.lte(v, to)
  }

  private isPrerelease(version: string): boolean {
    return semver.prerelease(version) !== null
  }
}
