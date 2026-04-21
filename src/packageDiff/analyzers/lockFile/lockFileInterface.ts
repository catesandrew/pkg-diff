export interface LockFileInterface {
  getPackages(): Map<string, { version: string; repository?: string }>
  getVersion(packageName: string): string | null
  getRepositoryUrl(packageName: string): string | null
  getAllVersions(): Record<string, string>
}
