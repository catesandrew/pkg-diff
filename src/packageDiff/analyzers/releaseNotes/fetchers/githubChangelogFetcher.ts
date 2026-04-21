import { PackageManagerType } from '../../packageManagerType.js'
import { ChangelogParser } from '../changelogParser.js'
import { ReleaseNotesFetcherInterface } from '../releaseNotesFetcherInterface.js'
import { ReleaseNotesCollection } from '../../../data/releaseNotesCollection.js'
import { HttpService } from '../../../services/httpService.js'

export class GithubChangelogFetcher implements ReleaseNotesFetcherInterface {
  private static readonly CHANGELOG_FILENAMES = ['CHANGELOG.md', 'CHANGELOG']

  constructor(
    private readonly httpService: HttpService,
    private readonly parser: ChangelogParser,
  ) {}

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
    const content = await this.fetchChangelogContent(owner, repo)
    if (!content) {
      return null
    }

    try {
      return this.parser.parse(content, fromVersion, toVersion, includePrerelease)
    } catch {
      return null
    }
  }

  private extractOwnerRepo(url: string): [string, string] | null {
    const match = url.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/)
    if (!match) return null
    const owner = match[1]
    const repo = match[2]
    if (!owner || !repo) return null
    return [owner, repo]
  }

  private async fetchChangelogContent(owner: string, repo: string): Promise<string | null> {
    for (const filename of GithubChangelogFetcher.CHANGELOG_FILENAMES) {
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filename}`
      try {
        const content = await this.httpService.get(url, {
          headers: { Accept: 'application/vnd.github.raw' },
        })
        if (content) {
          return content
        }
      } catch {
        continue
      }
    }
    return null
  }
}
