import semver from 'semver'
import { SemverChange } from '../enums/semver.js'

export class SemverAnalyzer {
  static determineSemverChangeType(fromVersion: string, toVersion: string): SemverChange | null {
    if (this.isDevVersion(fromVersion) || this.isDevVersion(toVersion)) {
      return null
    }

    const fromParts = this.parseVersion(fromVersion)
    const toParts = this.parseVersion(toVersion)
    if (!fromParts || !toParts) {
      return null
    }

    if (fromParts.major !== toParts.major) {
      return SemverChange.Major
    }
    if (fromParts.minor !== toParts.minor) {
      return SemverChange.Minor
    }
    if (fromParts.patch !== toParts.patch) {
      return SemverChange.Patch
    }
    return null
  }

  private static parseVersion(
    version: string,
  ): { major: number; minor: number; patch: number } | null {
    const parsed = semver.coerce(version)
    if (!parsed) {
      return null
    }
    return { major: parsed.major, minor: parsed.minor, patch: parsed.patch }
  }

  private static isDevVersion(version: string): boolean {
    const lower = version.toLowerCase()
    return lower.includes('dev') && !semver.valid(version)
  }
}
