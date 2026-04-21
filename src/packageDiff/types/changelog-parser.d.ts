declare module 'changelog-parser' {
  export interface ChangelogParserOptions {
    text?: string
    filePath?: string
    removeMarkdown?: boolean
  }

  export interface ParsedVersion {
    version: string
    title?: string
    date?: string
    body?: string
    parsed?: Record<string, unknown>
  }

  export interface ParsedChangelog {
    title?: string
    description?: string
    versions: ParsedVersion[]
  }

  export default function parseChangelog(options: ChangelogParserOptions): Promise<ParsedChangelog>
}
