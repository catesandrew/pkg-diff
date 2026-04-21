import semver from 'semver'
import { PackageInformationsException } from '../exceptions/packageInformationsException.js'
import { PackageManagerType, getRegistryUrl } from '../packageManagerType.js'
import { RegistryInterface } from './registryInterface.js'
import { HttpService } from '../../services/httpService.js'

export class NpmRegistry implements RegistryInterface {
  constructor(private readonly httpService: HttpService) {}

  async getPackageMetadata(
    packageName: string,
    options: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> {
    const url =
      typeof options['url'] === 'string'
        ? (options['url'] as string)
        : getRegistryUrl(PackageManagerType.Npm, packageName)

    let response: string
    try {
      response = await this.httpService.get(url)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new PackageInformationsException(
        `Failed to fetch package information for ${packageName}: ${message}`,
      )
    }

    try {
      return (JSON.parse(response) as Record<string, unknown>) ?? {}
    } catch {
      throw new PackageInformationsException(
        `Invalid JSON response from npm registry for package ${packageName}`,
      )
    }
  }

  async getVersions(
    packageName: string,
    fromVersion: string,
    toVersion: string,
    options: Record<string, unknown> = {},
  ): Promise<string[]> {
    const packageData = await this.getPackageMetadata(packageName, options)
    const versionsData = packageData['versions'] as
      | Record<string, Record<string, unknown>>
      | undefined
    if (!versionsData) {
      return []
    }

    const from = semver.coerce(fromVersion)
    const to = semver.coerce(toVersion)
    if (!from || !to) {
      return []
    }

    const result: string[] = []
    for (const info of Object.values(versionsData)) {
      const version = typeof info['version'] === 'string' ? info['version'] : null
      if (!version) continue
      const coerced = semver.coerce(version)
      if (!coerced) continue
      if (semver.gt(coerced, from) && semver.lte(coerced, to)) {
        result.push(version)
      }
    }

    return result
  }

  async getRepositoryUrl(
    packageName: string,
    options: Record<string, unknown> = {},
  ): Promise<string | null> {
    let packageData: Record<string, unknown>
    try {
      packageData = await this.getPackageMetadata(packageName, options)
    } catch {
      return null
    }

    const repository = packageData['repository']
    if (
      repository &&
      typeof repository === 'object' &&
      typeof (repository as Record<string, unknown>)['url'] === 'string'
    ) {
      return this.normalizeRepositoryUrl((repository as Record<string, unknown>)['url'] as string)
    }
    if (typeof repository === 'string') {
      return this.normalizeRepositoryUrl(repository)
    }

    return null
  }

  private normalizeRepositoryUrl(url: string): string {
    let normalized = url.replace(/^git\+/, '')
    normalized = normalized.replace(/^git:\/\//, 'https://')
    normalized = normalized.replace(/\.git$/, '')
    return normalized
  }
}
