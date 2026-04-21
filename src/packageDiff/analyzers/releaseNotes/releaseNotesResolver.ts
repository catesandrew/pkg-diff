import { PackageManagerType } from '../packageManagerType.js'
import { ReleaseNotesCollection } from '../../data/releaseNotesCollection.js'
import { ReleaseNotesFetcherInterface } from './releaseNotesFetcherInterface.js'

export class ReleaseNotesResolver {
  private fetchers: ReleaseNotesFetcherInterface[] = []

  addFetcher(fetcher: ReleaseNotesFetcherInterface): void {
    this.fetchers.push(fetcher)
  }

  async resolve(
    packageName: string,
    fromVersion: string,
    toVersion: string,
    repositoryUrl: string,
    packageManagerType: PackageManagerType,
    localPath: string | null,
    includePrerelease: boolean,
  ): Promise<ReleaseNotesCollection | null> {
    for (const fetcher of this.fetchers) {
      if (!fetcher.supports(repositoryUrl, localPath)) {
        continue
      }
      const result = await fetcher.fetch(
        packageName,
        fromVersion,
        toVersion,
        repositoryUrl,
        packageManagerType,
        localPath,
        includePrerelease,
      )
      if (result && !result.isEmpty()) {
        return result
      }
    }
    return null
  }

  getFetchers(): ReleaseNotesFetcherInterface[] {
    return this.fetchers
  }
}
