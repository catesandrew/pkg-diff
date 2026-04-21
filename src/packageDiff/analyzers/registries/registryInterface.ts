export interface RegistryInterface {
  getPackageMetadata(
    packageName: string,
    options?: Record<string, unknown>,
  ): Promise<Record<string, unknown>>
  getVersions(
    packageName: string,
    fromVersion: string,
    toVersion: string,
    options?: Record<string, unknown>,
  ): Promise<string[]>
  getRepositoryUrl(packageName: string, options?: Record<string, unknown>): Promise<string | null>
}
