import { describe, expect, test } from 'bun:test'
import { SemverAnalyzer } from '../../src/packageDiff/helpers/semverAnalyzer.ts'
import { SemverChange } from '../../src/packageDiff/enums/semver.ts'

describe('SemverAnalyzer', () => {
  test('detects major/minor/patch changes', () => {
    expect(SemverAnalyzer.determineSemverChangeType('1.2.3', '2.0.0')).toBe(SemverChange.Major)
    expect(SemverAnalyzer.determineSemverChangeType('1.2.3', '1.3.0')).toBe(SemverChange.Minor)
    expect(SemverAnalyzer.determineSemverChangeType('1.2.3', '1.2.4')).toBe(SemverChange.Patch)
  })

  test('returns null when no change', () => {
    expect(SemverAnalyzer.determineSemverChangeType('1.2.3', '1.2.3')).toBeNull()
  })

  test('returns null for dev versions', () => {
    expect(SemverAnalyzer.determineSemverChangeType('dev-main', '1.0.0')).toBeNull()
    expect(SemverAnalyzer.determineSemverChangeType('1.0.0', '1.0.0-dev')).toBeNull()
  })
})

