import semver from 'semver'

export class VersionNormalizer {
  static normalize(version: string): string {
    const stripped = VersionNormalizer.stripPrefix(version)
    const parsed = semver.parse(stripped, { loose: true })
    if (parsed) {
      return parsed.version
    }
    const normalized = semver.coerce(stripped)
    if (!normalized) {
      throw new Error(`Invalid version string: ${version}`)
    }
    return normalized.version
  }

  static stripPrefix(version: string): string {
    return version.replace(/^[vV]/, '')
  }
}
