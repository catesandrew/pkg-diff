import { describe, expect, test } from 'bun:test'
import { VersionNormalizer } from '../../src/packageDiff/helpers/versionNormalizer.ts'

describe('VersionNormalizer', () => {
  test('stripPrefix removes leading v/V', () => {
    expect(VersionNormalizer.stripPrefix('v1.2.3')).toBe('1.2.3')
    expect(VersionNormalizer.stripPrefix('V1.2.3')).toBe('1.2.3')
    expect(VersionNormalizer.stripPrefix('1.2.3')).toBe('1.2.3')
  })

  test('normalize returns a normalized semver string', () => {
    expect(VersionNormalizer.normalize('v1.2.3')).toBe('1.2.3')
    expect(VersionNormalizer.normalize('1.2')).toBe('1.2.0')
    expect(VersionNormalizer.normalize('v1.2.3-beta.1')).toBe('1.2.3-beta.1')
  })

  test('normalize throws on invalid version', () => {
    expect(() => VersionNormalizer.normalize('not-a-version')).toThrow()
  })
})

