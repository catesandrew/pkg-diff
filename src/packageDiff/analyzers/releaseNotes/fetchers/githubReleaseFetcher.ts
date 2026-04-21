import semver from 'semver'
import { PackageManagerType } from '../../packageManagerType.js'
import { ReleaseNotesFetcherInterface } from '../releaseNotesFetcherInterface.js'
import { ReleaseNote } from '../../../data/releaseNote.js'
import { ReleaseNotesCollection } from '../../../data/releaseNotesCollection.js'
import { HttpService } from '../../../services/httpService.js'
import { VersionNormalizer } from '../../../helpers/versionNormalizer.js'

export class GithubReleaseFetcher implements ReleaseNotesFetcherInterface {
  private static readonly GITHUB_API_URL = 'https://api.github.com'

  constructor(private readonly httpService: HttpService) {}

  supports(repositoryUrl: string): boolean {
    return repositoryUrl.includes('github.com')
  }

  async fetch(
    _packageName: string,
    fromVersion: string,
    toVersion: string,
    repositoryUrl: string,
    _packageManagerType: PackageManagerType,
    _localPath: string | null,
    includePrerelease: boolean,
  ): Promise<ReleaseNotesCollection | null> {
    const ownerRepo = this.extractOwnerRepo(repositoryUrl)
    if (!ownerRepo) {
      return null
    }

    const [owner, repo] = ownerRepo

    try {
      const allReleases = await this.fetchAllReleases(owner, repo, fromVersion)
      if (!allReleases.length) {
        return null
      }
      return this.buildReleaseNotesCollection(
        allReleases,
        fromVersion,
        toVersion,
        includePrerelease,
      )
    } catch {
      return null
    }
  }

  private async fetchAllReleases(
    owner: string,
    repo: string,
    fromVersion: string,
  ): Promise<Array<Record<string, unknown>>> {
    const allReleases: Array<Record<string, unknown>> = []
    let page = 1
    const perPage = 100
    const normalizedFrom = VersionNormalizer.normalize(fromVersion)

    while (true) {
      const apiUrl = `${GithubReleaseFetcher.GITHUB_API_URL}/repos/${owner}/${repo}/releases?per_page=${perPage}&page=${page}`
      const responseData = await this.httpService.getWithHeaders(apiUrl, {
        headers: { Accept: 'application/vnd.github+json' },
      })

      const releases = JSON.parse(responseData.body) as Array<Record<string, unknown>>
      if (!Array.isArray(releases) || releases.length === 0) {
        break
      }

      allReleases.push(...releases)

      let shouldContinue = false
      for (const release of releases) {
        const tagName = typeof release['tag_name'] === 'string' ? release['tag_name'] : ''
        if (!tagName) continue
        try {
          const version = VersionNormalizer.normalize(tagName)
          const v = semver.coerce(version)
          const from = semver.coerce(normalizedFrom)
          if (v && from && semver.gt(v, from)) {
            shouldContinue = true
          } else {
            return allReleases
          }
        } catch {
          continue
        }
      }

      if (shouldContinue && releases.length === perPage) {
        page += 1
        continue
      }

      break
    }

    return allReleases
  }

  private extractOwnerRepo(url: string): [string, string] | null {
    const match = url.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/)
    if (!match) return null
    const owner = match[1]
    const repo = match[2]
    if (!owner || !repo) return null
    return [owner, repo]
  }

  private buildReleaseNotesCollection(
    releases: Array<Record<string, unknown>>,
    fromVersion: string,
    toVersion: string,
    includePrerelease: boolean,
  ): ReleaseNotesCollection {
    const releaseNotes: ReleaseNote[] = []

    for (const release of releases) {
      if (release['draft'] === true) continue
      if (!includePrerelease && release['prerelease'] === true) continue

      const tagName = typeof release['tag_name'] === 'string' ? release['tag_name'] : ''
      if (!tagName) continue

      const version = VersionNormalizer.normalize(tagName)
      if (!this.isVersionInRange(version, fromVersion, toVersion)) {
        continue
      }

      const publishedAt =
        (release['published_at'] as string | undefined) ??
        (release['created_at'] as string | undefined)
      const date = publishedAt ? new Date(publishedAt) : new Date()
      releaseNotes.push(
        new ReleaseNote(
          tagName,
          (release['name'] as string | undefined) ?? tagName,
          (release['body'] as string | undefined) ?? '',
          date,
          (release['html_url'] as string | undefined) ?? null,
        ),
      )
    }

    return new ReleaseNotesCollection(releaseNotes)
  }

  private isVersionInRange(version: string, fromVersion: string, toVersion: string): boolean {
    const normalizedFrom = VersionNormalizer.normalize(fromVersion)
    const normalizedTo = VersionNormalizer.normalize(toVersion)

    if (normalizedFrom === normalizedTo) {
      return version === normalizedFrom
    }

    const v = semver.coerce(version)
    const from = semver.coerce(normalizedFrom)
    const to = semver.coerce(normalizedTo)
    if (!v || !from || !to) {
      return false
    }

    return semver.gt(v, from) && semver.lte(v, to)
  }
}
