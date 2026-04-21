import { PackageManagerType } from '../packageManagerType.js'
import { ReleaseNotesCollection } from '../../data/releaseNotesCollection.js'

export interface ReleaseNotesFetcherInterface {
  supports(repositoryUrl: string, localPath: string | null): boolean
  fetch(
    packageName: string,
    fromVersion: string,
    toVersion: string,
    repositoryUrl: string,
    packageManagerType: PackageManagerType,
    localPath: string | null,
    includePrerelease: boolean,
  ): Promise<ReleaseNotesCollection | null>
}
