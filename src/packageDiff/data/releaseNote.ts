export class ReleaseNote {
  private readonly structured: boolean

  constructor(
    public readonly tagName: string,
    public readonly title: string,
    public readonly body: string,
    public readonly date: Date,
    public readonly url: string | null = null,
  ) {
    this.structured = this.detectStructure()
  }

  isStructured(): boolean {
    return this.structured
  }

  getChanges(): string[] {
    if (!this.isStructured()) return []
    return this.extractSectionByPattern(
      /^#{2,3}\s+(Changed?|Added?|What's Changed|New Features|Features|Enhancements|Improvements)/i,
    )
  }

  getFixes(): string[] {
    if (!this.isStructured()) return []
    return this.extractSectionByPattern(/^#{2,3}\s+(Fixes?|Fixed|Bug ?Fixes?|Bugfixes)/i)
  }

  getBreakingChanges(): string[] {
    if (!this.isStructured()) return []
    return this.extractSectionByPattern(/^#{2,3}\s+(Breaking( Changes)?|BREAKING CHANGES)/i)
  }

  getDeprecated(): string[] {
    if (!this.isStructured()) return []
    return this.extractSectionByPattern(/^#{2,3}\s+(Deprecated)/i)
  }

  getRemoved(): string[] {
    if (!this.isStructured()) return []
    return this.extractSectionByPattern(/^#{2,3}\s+(Removed?)/i)
  }

  getSecurity(): string[] {
    if (!this.isStructured()) return []
    return this.extractSectionByPattern(/^#{2,3}\s+(Security)/i)
  }

  getBody(): string {
    return this.body
  }

  getTitle(): string {
    return this.title
  }

  getAllBulletPoints(): string[] {
    const lines = this.body.split('\n')
    const items: string[] = []
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        items.push(trimmed.slice(2))
      }
    }
    return items
  }

  getDescription(): string {
    if (!this.isStructured()) return ''

    const lines = this.body.split('\n')
    const description: string[] = []
    let inRecognizedSection = false
    let hasSeenHeading = false

    for (const line of lines) {
      const trimmed = line.trim()
      const isMarkdownHeading = trimmed.startsWith('## ') || trimmed.startsWith('### ')
      const isBoldHeading = /\*\*[^*]+\*\*/.test(trimmed)

      if (isMarkdownHeading || isBoldHeading) {
        hasSeenHeading = true
        if (this.isRecognizedHeading(trimmed)) {
          inRecognizedSection = true
        } else {
          inRecognizedSection = false
        }
        continue
      }

      if (!hasSeenHeading) {
        description.push(line)
        continue
      }

      if (!inRecognizedSection && trimmed !== '') {
        description.push(line)
      }
    }

    return description.join('\n').trim()
  }

  private detectStructure(): boolean {
    const lines = this.body.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (/^#{2,3}\s+\[\d+\.\d+/.test(trimmed)) {
        return true
      }
      if (
        /^#{2,3}\s+(Changed?|Added?|What's Changed|New Features|Features|Enhancements|Improvements|Fixes?|Fixed|Bug ?Fixes?|Bugfixes|Breaking( Changes)?|BREAKING CHANGES|Removed?|Deprecated|Security)/i.test(
          trimmed,
        )
      ) {
        return true
      }
      if (
        /\*\*\s*(Changed?|Added?|What's Changed|New Features|Features|Enhancements|Improvements|Fixes?|Fixed|Bug ?Fixes?|Bugfixes|Breaking( Changes)?|BREAKING CHANGES|Removed?|Deprecated|Security)\s*\*\*/i.test(
          trimmed,
        )
      ) {
        return true
      }
    }
    return false
  }

  private isRecognizedHeading(line: string): boolean {
    return /^(?:#{2,3}\s+|\*\*)\s*(Changed?|Added?|What's Changed|New Features|Features|Enhancements|Improvements|Fixes?|Fixed|Bug ?Fixes?|Bugfixes|Breaking( Changes)?|BREAKING CHANGES|Removed?|Deprecated|Security)/i.test(
      line,
    )
  }

  private extractSectionByPattern(pattern: RegExp): string[] {
    const lines = this.body.split('\n')
    const items: string[] = []
    let inSection = false

    for (const line of lines) {
      const trimmed = line.trim()
      const isHeading = trimmed.startsWith('## ') || trimmed.startsWith('### ')
      if (isHeading) {
        inSection = pattern.test(trimmed)
        continue
      }
      if (!inSection) {
        continue
      }
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        items.push(trimmed.slice(2))
      }
    }

    return items
  }
}
