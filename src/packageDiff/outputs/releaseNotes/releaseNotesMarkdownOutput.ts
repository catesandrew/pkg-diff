import { ReleaseNotesCollection } from '../../data/releaseNotesCollection.js'

export class ReleaseNotesMarkdownOutput {
  constructor(private readonly summary = false) {}

  format(collection: ReleaseNotesCollection): string {
    if (collection.isEmpty()) {
      return 'No release notes available.'
    }
    return this.summary ? collection.toSummarizedMarkdown() : collection.toMarkdown()
  }
}
