import { describe, expect, test } from 'bun:test'
import { parsePackageJsonSections, parsePackageManagerTypes } from '../../src/packageDiff/commands/sharedOptions.ts'
import { PackageManagerType } from '../../src/packageDiff/analyzers/packageManagerType.ts'

describe('parsePackageManagerTypes', () => {
  test('defaults to all types', () => {
    const { types, error } = parsePackageManagerTypes(undefined, undefined)
    expect(error).toBeUndefined()
    expect(types).toEqual([
      PackageManagerType.Composer,
      PackageManagerType.Npm,
      PackageManagerType.Pnpm,
      PackageManagerType.Yarn,
      PackageManagerType.PackageJson,
    ])
  })

  test('include parses comma separated list', () => {
    const { types } = parsePackageManagerTypes('npm,pnpm', undefined)
    expect(types).toEqual([PackageManagerType.Npm, PackageManagerType.Pnpm])
  })

  test('exclude removes types', () => {
    const { types } = parsePackageManagerTypes(undefined, 'composer,yarn,package-json')
    expect(types).toEqual([PackageManagerType.Npm, PackageManagerType.Pnpm])
  })

  test('invalid type yields an error', () => {
    const { types, error } = parsePackageManagerTypes('nope', undefined)
    expect(types).toBeNull()
    expect(error).toMatch(/Invalid package manager type/)
  })
})

describe('parsePackageJsonSections', () => {
  test('returns null when not provided', () => {
    expect(parsePackageJsonSections(undefined)).toEqual({ sections: null })
  })

  test('parses known sections with aliases', () => {
    expect(parsePackageJsonSections('prod,dev')).toEqual({
      sections: ['dependencies', 'devDependencies'],
    })
  })

  test('rejects unknown sections', () => {
    const { sections, error } = parsePackageJsonSections('nope')
    expect(sections).toBeNull()
    expect(error).toMatch(/Invalid package\.json section/)
  })
})
