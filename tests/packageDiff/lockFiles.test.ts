import { describe, expect, test } from 'bun:test'
import { PnpmLockFile } from '../../src/packageDiff/analyzers/lockFile/pnpmLockFile.ts'
import { YarnLockFile } from '../../src/packageDiff/analyzers/lockFile/yarnLockFile.ts'

describe('Lock files', () => {
  test('PnpmLockFile extracts highest version per package', () => {
    const lock = [
      'lockfileVersion: 6.0',
      'packages:',
      "  /react@18.2.0:",
      '    resolution: {}',
      "  /react@18.3.0:",
      '    resolution: {}',
      "  /@scope/pkg@npm:1.2.3(peer@1.0.0):",
      "    name: '@scope/pkg'",
      "    version: '1.2.3'",
    ].join('\n')

    const parsed = new PnpmLockFile(lock)

    expect(parsed.getVersion('react')).toBe('18.3.0')
    expect(parsed.getVersion('@scope/pkg')).toBe('1.2.3')
  })

  test('YarnLockFile extracts versions from v1-style lockfile entries', () => {
    const lock = [
      '"react@^18.2.0", "react@^18.3.0":',
      '  version "18.3.0"',
      '  resolved "https://registry.yarnpkg.com/react/-/react-18.3.0.tgz"',
      '',
      '"@scope/pkg@^1.0.0":',
      '  version "1.1.0"',
    ].join('\n')

    const parsed = new YarnLockFile(lock)
    expect(parsed.getVersion('react')).toBe('18.3.0')
    expect(parsed.getVersion('@scope/pkg')).toBe('1.1.0')
  })
})

