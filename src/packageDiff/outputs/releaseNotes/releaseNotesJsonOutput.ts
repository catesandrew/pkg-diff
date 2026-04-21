import { ReleaseNotesCollection } from '../../data/releaseNotesCollection.js'

export class ReleaseNotesJsonOutput {
  constructor(private readonly summary = false) {}

  format(collection: ReleaseNotesCollection): string {
    if (collection.isEmpty()) {
      return JSON.stringify({ releases: [] }, null, 2)
    }

    if (this.summary) {
      return JSON.stringify(
        {
          summary: true,
          releases: collection.getReleases().map((release) => ({
            tag: release.tagName,
            title: release.title,
            date: release.date.toISOString(),
            url: release.url,
          })),
          changes: {
            breaking: collection.getBreakingChanges(),
            changes: collection.getChanges(),
            fixes: collection.getFixes(),
            deprecated: collection.getDeprecated(),
            removed: collection.getRemoved(),
            security: collection.getSecurity(),
          },
        },
        null,
        2,
      )
    }

    return JSON.stringify(
      {
        summary: false,
        releases: collection.getReleases().map((release) => ({
          tag: release.tagName,
          title: release.title,
          body: release.body,
          date: release.date.toISOString(),
          url: release.url,
          structured: release.isStructured(),
        })),
      },
      null,
      2,
    )
  }
}
