import semver from 'semver'
import fs from 'node:fs/promises'
import path from 'node:path'
import { PackageInformationsException } from '../exceptions/packageInformationsException.js'
import { PackageManagerType, getRegistryUrl } from '../packageManagerType.js'
import { RegistryInterface } from './registryInterface.js'
import { HttpService } from '../../services/httpService.js'

export class PackagistRegistry implements RegistryInterface {
  constructor(private readonly httpService: HttpService) {}

  async getPackageMetadata(
    packageName: string,
    options: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> {
    const url =
      typeof options['url'] === 'string'
        ? (options['url'] as string)
        : getRegistryUrl(PackageManagerType.Composer, packageName)

    try {
      const authOptions = await this.extractAuthFromUrl(url)
      const cleanUrl = authOptions.url
      const httpOptions: Record<string, unknown> = { ...authOptions.options }

      if (!options['auth'] && !httpOptions['auth']) {
        const authJson = await this.loadAuthJson()
        const domain = new URL(cleanUrl).host
        if (domain && authJson['http-basic'] && typeof authJson['http-basic'] === 'object') {
          const authBasic = (authJson['http-basic'] as Record<string, Record<string, string>>)[
            domain
          ]
          if (authBasic) {
            httpOptions['auth'] = authBasic
          }
        }
      }

      if (options['auth']) {
        httpOptions['auth'] = options['auth']
      }

      const response = await this.httpService.get(cleanUrl, httpOptions as Record<string, unknown>)
      return (JSON.parse(response) as Record<string, unknown>) ?? {}
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new PackageInformationsException(
        `Failed to fetch package information for ${packageName}: ${message}`,
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
    const packages = packageData['packages'] as
      | Record<string, Array<Record<string, unknown>>>
      | undefined
    if (!packages || !packages[packageName]) {
      return []
    }

    const from = semver.coerce(fromVersion)
    const to = semver.coerce(toVersion)
    if (!from || !to) {
      return []
    }

    const result: string[] = []
    for (const info of packages[packageName]) {
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

    const packages = packageData['packages'] as
      | Record<string, Array<Record<string, unknown>>>
      | undefined
    const packageVersions = packages?.[packageName]
    if (!packageVersions || packageVersions.length === 0) {
      return null
    }

    const firstVersion = packageVersions[0]
    if (!firstVersion) {
      return null
    }
    const sourceUrl =
      firstVersion['source'] &&
      typeof (firstVersion['source'] as Record<string, unknown>)['url'] === 'string'
        ? ((firstVersion['source'] as Record<string, unknown>)['url'] as string)
        : null
    const distUrl =
      firstVersion['dist'] &&
      typeof (firstVersion['dist'] as Record<string, unknown>)['url'] === 'string'
        ? ((firstVersion['dist'] as Record<string, unknown>)['url'] as string)
        : null
    const issuesUrl =
      firstVersion['support'] &&
      typeof (firstVersion['support'] as Record<string, unknown>)['issues'] === 'string'
        ? ((firstVersion['support'] as Record<string, unknown>)['issues'] as string)
        : null
    const supportSource =
      firstVersion['support'] &&
      typeof (firstVersion['support'] as Record<string, unknown>)['source'] === 'string'
        ? ((firstVersion['support'] as Record<string, unknown>)['source'] as string)
        : null

    const url =
      sourceUrl || distUrl || this.extractRepoFromIssuesUrl(issuesUrl) || supportSource || null
    if (!url) {
      return null
    }

    return this.normalizeRepositoryUrl(url)
  }

  private normalizeRepositoryUrl(url: string): string {
    if (url.endsWith('.git')) {
      return url.replace(/\.git$/, '')
    }

    const zipballMatch = url.match(
      /^https?:\/\/api\.github\.com\/repos\/([^/]+)\/([^/]+)\/(?:zipball|tarball)\//,
    )
    if (zipballMatch) {
      return `https://github.com/${zipballMatch[1]}/${zipballMatch[2]}`
    }

    const repoMatch = url.match(/^https?:\/\/api\.github\.com\/repos\/([^/]+)\/([^/]+)\/?$/)
    if (repoMatch) {
      return `https://github.com/${repoMatch[1]}/${repoMatch[2]}`
    }

    return url
  }

  private extractRepoFromIssuesUrl(issuesUrl?: string | null): string | null {
    if (!issuesUrl) return null
    const match = issuesUrl.match(/^(https?:\/\/github\.com\/[^/]+\/[^/]+)\/issues/)
    const repo = match?.[1]
    return repo ?? null
  }

  private async extractAuthFromUrl(
    url: string,
  ): Promise<{ url: string; options: Record<string, unknown> }> {
    try {
      const parsed = new URL(url)
      if (parsed.username && parsed.password) {
        const options: Record<string, unknown> = {
          auth: {
            username: decodeURIComponent(parsed.username),
            password: decodeURIComponent(parsed.password),
          },
        }
        parsed.username = ''
        parsed.password = ''
        return { url: parsed.toString(), options }
      }
    } catch {
      // ignore
    }
    return { url, options: {} }
  }

  private async loadAuthJson(): Promise<Record<string, unknown>> {
    const currentDir = process.cwd()
    const localAuthPath = path.join(currentDir, 'auth.json')
    const home = process.env.HOME ?? process.env.USERPROFILE
    const globalAuthPath = home ? path.join(home, '.composer', 'auth.json') : null

    const localAuth = await this.readJsonIfExists(localAuthPath)
    const globalAuth = globalAuthPath ? await this.readJsonIfExists(globalAuthPath) : {}

    return {
      'http-basic': {
        ...(typeof (globalAuth as Record<string, unknown>)['http-basic'] === 'object'
          ? ((globalAuth as Record<string, unknown>)['http-basic'] as Record<string, unknown>)
          : {}),
        ...(typeof (localAuth as Record<string, unknown>)['http-basic'] === 'object'
          ? ((localAuth as Record<string, unknown>)['http-basic'] as Record<string, unknown>)
          : {}),
      },
    }
  }

  private async readJsonIfExists(filePath: string): Promise<Record<string, unknown>> {
    try {
      const content = await fs.readFile(filePath, 'utf8')
      return (JSON.parse(content) as Record<string, unknown>) ?? {}
    } catch {
      return {}
    }
  }
}
