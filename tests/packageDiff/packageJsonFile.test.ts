import { describe, expect, test } from 'bun:test'
import { PackageJsonFile } from '../../src/packageDiff/analyzers/lockFile/packageJsonFile.ts'

describe('PackageJsonFile', () => {
  test('extracts deps from multiple sections with stable precedence', () => {
    const content = JSON.stringify({
      dependencies: { react: '^18.3.0', lodash: '4.17.21' },
      devDependencies: { typescript: '^5.7.2', react: '^18.2.0' },
      optionalDependencies: { optional: '1.0.0' },
      peerDependencies: { peer: '^2.0.0' },
    })

    const parsed = new PackageJsonFile(content)
    expect(parsed.getVersion('react')).toBe('^18.3.0')
    expect(parsed.getVersion('lodash')).toBe('4.17.21')
    expect(parsed.getVersion('typescript')).toBe('^5.7.2')
    expect(parsed.getVersion('optional')).toBe('1.0.0')
    expect(parsed.getVersion('peer')).toBe('^2.0.0')
  })

  test('returns empty on invalid json', () => {
    const parsed = new PackageJsonFile('{ nope')
    expect(Object.keys(parsed.getAllVersions())).toHaveLength(0)
  })
})

