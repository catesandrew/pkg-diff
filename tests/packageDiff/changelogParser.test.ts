import { describe, expect, test } from 'bun:test'
import { ChangelogParser } from '../../src/packageDiff/analyzers/releaseNotes/changelogParser.ts'

describe('ChangelogParser', () => {
  test('parses releases and filters to a version range (exclusive from, inclusive to)', () => {
    const content = [
      '## 2.0.0 - 2024-01-01',
      '- Added feature A',
      '',
      '## 1.6.0 - 2023-12-15',
      '- Fixed bug',
      '',
      '## 1.5.0 - 2023-12-01',
      '- Baseline',
      '',
    ].join('\n')

    const parser = new ChangelogParser()
    const collection = parser.parse(content, '1.5.0', '2.0.0', false)
    const releases = collection.getReleases().map((r) => r.tagName)

    expect(releases).toEqual(['2.0.0', '1.6.0'])
  })

  test('excludes prereleases unless includePrerelease=true', () => {
    const content = [
      '## 1.1.0-beta.1 - 2024-01-01',
      '- Pre-release stuff',
      '',
      '## 1.0.0 - 2023-12-01',
      '- Stable',
      '',
    ].join('\n')

    const parser = new ChangelogParser()
    const withoutPrerelease = parser.parse(content, '0.9.0', '1.1.0-beta.1', false)
    expect(withoutPrerelease.getReleases().map((r) => r.tagName)).toEqual(['1.0.0'])

    const withPrerelease = parser.parse(content, '0.9.0', '1.1.0-beta.1', true)
    expect(withPrerelease.getReleases().map((r) => r.tagName)).toEqual(['1.1.0-beta.1', '1.0.0'])
  })
})

