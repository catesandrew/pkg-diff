import { Command } from 'commander'
import { PackageManagerType } from '../analyzers/packageManagerType.js'

export function addSharedOptions(command: Command): void {
  command
    .option('--ignore-last', 'Ignore the last commit when calculating changes')
    .option('--from <commit>', 'Commit hash, branch, or tag to compare from (older version)')
    .option(
      '--to <commit>',
      'Commit hash, branch, or tag to compare to (newer version, defaults to HEAD)',
    )
    .option('--format <format>', 'Output format (text, json, markdown)', 'text')
    .option('--no-cache', 'Disable cache')
    .option('--include <types>', 'Only include these package manager types (comma-separated)')
    .option('--exclude <types>', 'Exclude these package manager types (comma-separated)')
    .option(
      '--sections <sections>',
      'Only include these package.json dependency sections (comma-separated: dependencies, devDependencies, optionalDependencies, peerDependencies)',
    )
    .option('--explain', 'Explain how comparisons and commit ranges were selected')
    .option('--no-progress', 'Disable progress indicator')
    .option('--show-empty', 'Show lockfiles even when there are no changes')
}

export function parsePackageManagerTypes(
  includeTypes: string | undefined,
  excludeTypes: string | undefined,
): { types: PackageManagerType[] | null; error?: string } {
  const allTypes = [
    PackageManagerType.Composer,
    PackageManagerType.Npm,
    PackageManagerType.Pnpm,
    PackageManagerType.Yarn,
    PackageManagerType.PackageJson,
  ]

  if (!includeTypes && !excludeTypes) {
    return { types: allTypes }
  }

  if (includeTypes) {
    const types = includeTypes.split(',').map((value) => value.trim())
    const parsed: PackageManagerType[] = []
    for (const typeString of types) {
      const type = parsePackageManagerType(typeString)
      if (!type) {
        return {
          types: null,
          error:
            `Invalid package manager type: '${typeString}'. ` +
            'Valid types: composer, npmjs, pnpm, yarn, package-json',
        }
      }
      parsed.push(type)
    }
    return { types: parsed }
  }

  const excludeTypeStrings = (excludeTypes ?? '').split(',').map((value) => value.trim())
  const exclude: PackageManagerType[] = []
  for (const typeString of excludeTypeStrings) {
    const type = parsePackageManagerType(typeString)
    if (!type) {
      return {
        types: null,
        error:
          `Invalid package manager type: '${typeString}'. ` +
          'Valid types: composer, npmjs, pnpm, yarn, package-json',
      }
    }
    exclude.push(type)
  }

  return { types: allTypes.filter((type) => !exclude.includes(type)) }
}

export function parsePackageManagerType(typeString: string): PackageManagerType | null {
  switch (typeString.toLowerCase()) {
    case 'composer':
      return PackageManagerType.Composer
    case 'npm':
    case 'npmjs':
      return PackageManagerType.Npm
    case 'pnpm':
      return PackageManagerType.Pnpm
    case 'yarn':
      return PackageManagerType.Yarn
    case 'package-json':
    case 'packagejson':
    case 'manifest':
      return PackageManagerType.PackageJson
    default:
      return null
  }
}

export function parsePackageJsonSections(
  sections: string | undefined,
): { sections: string[] | null; error?: string } {
  if (!sections) {
    return { sections: null }
  }

  const allowed = new Set([
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ])

  const values = sections
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s === 'dev' ? 'devDependencies' : s === 'prod' ? 'dependencies' : s))

  for (const value of values) {
    if (!allowed.has(value)) {
      return {
        sections: null,
        error:
          `Invalid package.json section: '${value}'. ` +
          'Valid sections: dependencies, devDependencies, optionalDependencies, peerDependencies',
      }
    }
  }

  return { sections: values }
}
