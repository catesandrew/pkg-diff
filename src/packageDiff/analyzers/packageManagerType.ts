export enum PackageManagerType {
  Composer = 'composer',
  Npm = 'npmjs',
  Pnpm = 'pnpm',
  Yarn = 'yarn',
  PackageJson = 'package-json',
}

export const PACKAGE_MANAGER_TYPES: PackageManagerType[] = [
  PackageManagerType.Composer,
  PackageManagerType.Npm,
  PackageManagerType.Pnpm,
  PackageManagerType.Yarn,
  PackageManagerType.PackageJson,
]

export function getLockFileName(type: PackageManagerType): string {
  switch (type) {
    case PackageManagerType.Composer:
      return 'composer.lock'
    case PackageManagerType.Npm:
      return 'package-lock.json'
    case PackageManagerType.Pnpm:
      return 'pnpm-lock.yaml'
    case PackageManagerType.Yarn:
      return 'yarn.lock'
    case PackageManagerType.PackageJson:
      return 'package.json'
  }
}

export function getRegistryUrl(type: PackageManagerType, packageName: string): string {
  switch (type) {
    case PackageManagerType.Composer:
      return `https://repo.packagist.org/p2/${packageName}.json`
    case PackageManagerType.Npm:
    case PackageManagerType.Pnpm:
    case PackageManagerType.Yarn:
    case PackageManagerType.PackageJson:
      return `https://registry.npmjs.org/${packageName}`
  }
}
