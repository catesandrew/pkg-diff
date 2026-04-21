import { describe, expect, test } from 'bun:test'
import { GithubUrlFormatter } from '../../src/packageDiff/helpers/githubUrlFormatter.ts'

describe('GithubUrlFormatter', () => {
  test('shortens github PR/issue URLs to #id', () => {
    const input =
      'See https://github.com/org/repo/pull/123 and https://github.com/org/repo/issues/7 for details'
    expect(GithubUrlFormatter.toShortText(input)).toBe('See #123 and #7 for details')
  })

  test('converts github PR/issue URLs to markdown links', () => {
    const input = 'See https://github.com/org/repo/pull/123'
    expect(GithubUrlFormatter.toMarkdownLink(input)).toBe(
      'See [#123](https://github.com/org/repo/pull/123)',
    )
  })
})

