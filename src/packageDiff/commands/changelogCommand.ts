import { Command } from 'commander'
import { CacheService } from '../services/cacheService.js'
import { GitRepository } from '../services/gitRepository.js'
import { PackagistRegistry } from '../analyzers/registries/packagistRegistry.js'
import { NpmRegistry } from '../analyzers/registries/npmRegistry.js'
import { ReleaseNotesResolver } from '../analyzers/releaseNotes/releaseNotesResolver.js'
import { PackageManagerType } from '../analyzers/packageManagerType.js'
import { ComposerLockFile } from '../analyzers/lockFile/composerLockFile.js'
import { NpmPackageLockFile } from '../analyzers/lockFile/npmPackageLockFile.js'
import { PnpmLockFile } from '../analyzers/lockFile/pnpmLockFile.js'
import { PackageJsonFile } from '../analyzers/lockFile/packageJsonFile.js'
import { YarnLockFile } from '../analyzers/lockFile/yarnLockFile.js'
import { ReleaseNotesJsonOutput } from '../outputs/releaseNotes/releaseNotesJsonOutput.js'
import { ReleaseNotesMarkdownOutput } from '../outputs/releaseNotes/releaseNotesMarkdownOutput.js'
import { ReleaseNotesTextOutput } from '../outputs/releaseNotes/releaseNotesTextOutput.js'
import { CommandErrorHandler } from '../helpers/commandErrorHandler.js'
import { VersionNormalizer } from '../helpers/versionNormalizer.js'
import fs from 'node:fs/promises'
import path from 'node:path'

interface ChangelogDeps {
  gitRepository: GitRepository
  packagistRegistry: PackagistRegistry
  npmRegistry: NpmRegistry
  cache: CacheService
  releaseNotesResolver: ReleaseNotesResolver
}

export function createChangelogCommand({
  gitRepository,
  packagistRegistry,
  npmRegistry,
  cache,
  releaseNotesResolver,
}: ChangelogDeps): Command {
  const command = new Command('changelog')
    .description('Show changelog/release notes for a specific package')
    .argument('<package>', 'Package name (e.g., symfony/console or react)')
    .argument('[version]', 'Version or version range (e.g., 5.1.0 or 5.0.0...5.1.0)')
    .option('--from <commit>', 'Commit hash, branch, or tag to compare from')
    .option('--to <commit>', 'Commit hash, branch, or tag to compare to (defaults to HEAD)', 'HEAD')
    .option('--ignore-last', 'Ignore last commit when auto-detecting versions')
    .option('-t, --type <type>', 'Package manager type (composer or npm)')
    .option('--format <format>', 'Output format (text, json, markdown)', 'text')
    .option('-s, --summary', 'Show summarized changelog (combines all releases)')
    .option('--no-cache', 'Disable cache')
    .option('--include-prerelease', 'Include pre-release versions')

  command.action(async (packageName: string, versionArg: string | undefined) => {
    const options = command.opts()
    const fromCommit = options.from as string | undefined
    const toCommit = (options.to as string | undefined) ?? 'HEAD'
    const ignoreLast = Boolean(options.ignoreLast)
    const typeOption = options.type as string | undefined
    const format = String(options.format ?? 'text')
    const summary = Boolean(options.summary)
    const noCache = Boolean(options.cache === false || options.noCache)
    const includePrerelease = Boolean(options.includePrerelease)

    if (versionArg && (fromCommit || toCommit !== 'HEAD')) {
      process.stderr.write('Cannot use version argument with --from or --to options\n')
      process.exitCode = 1
      return
    }

    if (versionArg && ignoreLast) {
      process.stderr.write('Cannot use version argument with --ignore-last option\n')
      process.exitCode = 1
      return
    }

    if ((fromCommit || toCommit !== 'HEAD') && ignoreLast) {
      process.stderr.write('Cannot use --ignore-last with --from or --to options\n')
      process.exitCode = 1
      return
    }

    try {
      if (noCache) {
        cache.disableCache()
      }

      const packageManagerType = await detectPackageManager(
        packageName,
        typeOption,
        packagistRegistry,
        npmRegistry,
        gitRepository,
      )

      if (!packageManagerType) {
        process.stderr.write(
          `Package '${packageName}' not found in lock files. Try specifying --type=(composer|npm|pnpm|yarn)\n`,
        )
        process.exitCode = 1
        return
      }

      const [fromVersion, toVersion] = await getVersionRange(
        packageName,
        packageManagerType,
        versionArg,
        fromCommit,
        toCommit,
        ignoreLast,
        gitRepository,
        packagistRegistry,
        npmRegistry,
      )

      if (!fromVersion || !toVersion) {
        process.stderr.write(`Could not determine version range for package '${packageName}'\n`)
        process.exitCode = 1
        return
      }

      const normalizedFrom = fromVersion.replace(/^[vV]/, '')
      const normalizedTo = toVersion.replace(/^[vV]/, '')

      const repositoryUrl = await getRepositoryUrl(
        packageName,
        packageManagerType,
        packagistRegistry,
        npmRegistry,
      )
      if (!repositoryUrl) {
        process.stderr.write(`Could not determine repository URL for package '${packageName}'\n`)
        process.exitCode = 1
        return
      }

      const localPath = await getLocalPath(packageName, packageManagerType, gitRepository)

      const releaseNotes = await releaseNotesResolver.resolve(
        packageName,
        normalizedFrom,
        normalizedTo,
        repositoryUrl,
        packageManagerType,
        localPath,
        includePrerelease,
      )

      if (!releaseNotes || releaseNotes.isEmpty()) {
        process.stdout.write(
          `No release notes found for ${packageName} between ${normalizedFrom} and ${normalizedTo}\n`,
        )
        return
      }

      const formatter = getFormatter(format, summary, process.stdout.isTTY ?? false)
      process.stdout.write(formatter.format(releaseNotes) + '\n')
    } catch (error) {
      const exitCode = CommandErrorHandler.handle(error as Error, format)
      process.exitCode = exitCode
    }
  })

  return command
}

async function detectPackageManager(
  packageName: string,
  typeOption: string | undefined,
  packagistRegistry: PackagistRegistry,
  npmRegistry: NpmRegistry,
  gitRepository: GitRepository,
): Promise<PackageManagerType | null> {
  if (typeOption) {
    const normalized = typeOption.toLowerCase()
    if (normalized === 'composer') return PackageManagerType.Composer
    if (normalized === 'npm' || normalized === 'npmjs') return PackageManagerType.Npm
    if (normalized === 'pnpm') return PackageManagerType.Pnpm
    if (normalized === 'yarn') return PackageManagerType.Yarn
    if (normalized === 'package-json' || normalized === 'packagejson' || normalized === 'manifest') {
      return PackageManagerType.PackageJson
    }
    return null
  }

  const detectedByPattern = detectByPackageNamePattern(packageName)
  if (detectedByPattern) {
    const exists = await verifyPackageExistsInRegistry(
      packageName,
      detectedByPattern,
      packagistRegistry,
      npmRegistry,
    )
    if (exists) {
      return detectedByPattern
    }
  }

  const probed = await detectByRegistryProbe(packageName, packagistRegistry, npmRegistry)
  if (probed) return probed

  try {
    const composerLockPath = await findLockFilePath(PackageManagerType.Composer, gitRepository)
    if (composerLockPath) {
      const composerLockContent = await gitRepository.getFileContentAtCommit(
        composerLockPath,
        'HEAD',
      )
      if (composerLockContent) {
        const lockFile = new ComposerLockFile(composerLockContent)
        const versions = lockFile.getAllVersions()
        if (versions[packageName]) {
          return PackageManagerType.Composer
        }
      }
    }
  } catch {
    // ignore
  }

  try {
    const npmLockPath = await findLockFilePath(PackageManagerType.Npm, gitRepository)
    if (npmLockPath) {
      const npmLockContent = await gitRepository.getFileContentAtCommit(npmLockPath, 'HEAD')
      if (npmLockContent) {
        const lockFile = new NpmPackageLockFile(npmLockContent)
        const versions = lockFile.getAllVersions()
        if (versions[packageName]) {
          return PackageManagerType.Npm
        }
      }
    }
  } catch {
    // ignore
  }

  try {
    const pnpmLockPath = await findLockFilePath(PackageManagerType.Pnpm, gitRepository)
    if (pnpmLockPath) {
      const pnpmLockContent = await gitRepository.getFileContentAtCommit(pnpmLockPath, 'HEAD')
      if (pnpmLockContent) {
        const lockFile = new PnpmLockFile(pnpmLockContent)
        const versions = lockFile.getAllVersions()
        if (versions[packageName]) {
          return PackageManagerType.Pnpm
        }
      }
    }
  } catch {
    // ignore
  }

  try {
    const yarnLockPath = await findLockFilePath(PackageManagerType.Yarn, gitRepository)
    if (yarnLockPath) {
      const yarnLockContent = await gitRepository.getFileContentAtCommit(yarnLockPath, 'HEAD')
      if (yarnLockContent) {
        const lockFile = new YarnLockFile(yarnLockContent)
        const versions = lockFile.getAllVersions()
        if (versions[packageName]) {
          return PackageManagerType.Yarn
        }
      }
    }
  } catch {
    // ignore
  }

  return null
}

function detectByPackageNamePattern(packageName: string): PackageManagerType | null {
  if (packageName.startsWith('@') && packageName.includes('/')) {
    return PackageManagerType.Npm
  }

  if (packageName.includes('/')) {
    const vendor = packageName.split('/', 1)[0] ?? ''
    if (vendor && vendor === vendor.toLowerCase() && !vendor.startsWith('@')) {
      return PackageManagerType.Composer
    }
  }

  return null
}

async function verifyPackageExistsInRegistry(
  packageName: string,
  type: PackageManagerType,
  packagistRegistry: PackagistRegistry,
  npmRegistry: NpmRegistry,
): Promise<boolean> {
  try {
    if (type === PackageManagerType.Composer) {
      await packagistRegistry.getPackageMetadata(packageName)
    } else {
      await npmRegistry.getPackageMetadata(packageName)
    }
    return true
  } catch {
    return false
  }
}

async function detectByRegistryProbe(
  packageName: string,
  packagistRegistry: PackagistRegistry,
  npmRegistry: NpmRegistry,
): Promise<PackageManagerType | null> {
  const foundInComposer = await verifyPackageExistsInRegistry(
    packageName,
    PackageManagerType.Composer,
    packagistRegistry,
    npmRegistry,
  )
  const foundInNpm = await verifyPackageExistsInRegistry(
    packageName,
    PackageManagerType.Npm,
    packagistRegistry,
    npmRegistry,
  )

  if (foundInComposer && !foundInNpm) return PackageManagerType.Composer
  if (foundInNpm && !foundInComposer) return PackageManagerType.Npm
  return null
}

async function getVersionRange(
  packageName: string,
  packageManagerType: PackageManagerType,
  versionArg: string | undefined,
  fromCommit: string | undefined,
  toCommit: string,
  ignoreLast: boolean,
  gitRepository: GitRepository,
  packagistRegistry: PackagistRegistry,
  npmRegistry: NpmRegistry,
): Promise<[string | null, string | null]> {
  if (versionArg) {
    return parseVersionArgument(
      versionArg,
      packageName,
      packageManagerType,
      packagistRegistry,
      npmRegistry,
    )
  }

  if (fromCommit || toCommit !== 'HEAD') {
    const toVersion = await getPackageVersionAtCommit(
      packageName,
      packageManagerType,
      toCommit,
      ignoreLast,
      gitRepository,
    )
    const fromVersion = fromCommit
      ? await getPackageVersionAtCommit(
          packageName,
          packageManagerType,
          fromCommit,
          false,
          gitRepository,
        )
      : await findPreviousVersion(packageName, packageManagerType, toCommit, gitRepository)
    return [fromVersion, toVersion]
  }

  const toVersion = await getPackageVersionAtCommit(
    packageName,
    packageManagerType,
    toCommit,
    ignoreLast,
    gitRepository,
  )
  if (!toVersion) {
    return [null, null]
  }

  const fromVersion = await findPreviousVersion(
    packageName,
    packageManagerType,
    toCommit,
    gitRepository,
  )
  if (!fromVersion) {
    return [toVersion, toVersion]
  }

  return [fromVersion, toVersion]
}

async function parseVersionArgument(
  versionArg: string,
  packageName: string,
  packageManagerType: PackageManagerType,
  packagistRegistry: PackagistRegistry,
  npmRegistry: NpmRegistry,
): Promise<[string | null, string | null]> {
  if (versionArg.includes('...')) {
    const [fromVersion, toVersion] = versionArg.split('...', 2)
    if (!fromVersion || !toVersion) {
      return [null, null]
    }
    return [
      VersionNormalizer.normalize(fromVersion.trim()),
      VersionNormalizer.normalize(toVersion.trim()),
    ]
  }

  const normalized = VersionNormalizer.stripPrefix(versionArg)
  const previous = await getPreviousVersionFromRegistry(
    packageName,
    normalized,
    packageManagerType,
    packagistRegistry,
    npmRegistry,
  )
  if (!previous) {
    return [normalized, normalized]
  }
  return [previous, normalized]
}

async function getPreviousVersionFromRegistry(
  packageName: string,
  currentVersion: string,
  packageManagerType: PackageManagerType,
  packagistRegistry: PackagistRegistry,
  npmRegistry: NpmRegistry,
): Promise<string | null> {
  try {
    const metadata =
      packageManagerType === PackageManagerType.Composer
        ? await packagistRegistry.getPackageMetadata(packageName)
        : await npmRegistry.getPackageMetadata(packageName)

    const versions: string[] = []
    if (packageManagerType === PackageManagerType.Composer) {
      const packages = metadata['packages'] as
        | Record<string, Array<Record<string, unknown>>>
        | undefined
      const list = packages?.[packageName] ?? []
      for (const versionData of list) {
        if (typeof versionData['version'] === 'string') {
          versions.push(VersionNormalizer.stripPrefix(versionData['version']))
        }
      }
    } else {
      const versionsMap = metadata['versions'] as
        | Record<string, Record<string, unknown>>
        | undefined
      if (versionsMap) {
        for (const info of Object.values(versionsMap)) {
          if (typeof info['version'] === 'string') {
            versions.push(VersionNormalizer.stripPrefix(info['version']))
          }
        }
      }
    }

    if (!versions.length) {
      return null
    }

    versions.sort((a, b) => {
      const va = safeNormalizeForSort(a)
      const vb = safeNormalizeForSort(b)
      return va === vb ? 0 : va < vb ? -1 : 1
    })
    const currentIndex = versions.indexOf(currentVersion)
    if (currentIndex <= 0) {
      return null
    }
    return versions[currentIndex - 1] ?? null
  } catch {
    return null
  }
}

async function getPackageVersionAtCommit(
  packageName: string,
  packageManagerType: PackageManagerType,
  commit: string,
  ignoreLast: boolean,
  gitRepository: GitRepository,
): Promise<string | null> {
  const lockFilePath = await findLockFilePath(packageManagerType, gitRepository)
  if (!lockFilePath) {
    return null
  }

  if (ignoreLast && commit === 'HEAD') {
    const commits = await gitRepository.getFileCommitLogs(lockFilePath)
    if (!commits.length) {
      return null
    }
    const latestCommit = commits[0]
    if (!latestCommit) {
      return null
    }
    commit = latestCommit
  }

  const lockContent = await gitRepository.getFileContentAtCommit(lockFilePath, commit)
  if (!lockContent) {
    return null
  }

  const lockFile = createLockFileParser(packageManagerType, lockContent)

  const versions = lockFile.getAllVersions()
  return versions[packageName] ?? null
}

async function findPreviousVersion(
  packageName: string,
  packageManagerType: PackageManagerType,
  currentCommit: string,
  gitRepository: GitRepository,
): Promise<string | null> {
  const lockFilePath = await findLockFilePath(packageManagerType, gitRepository)
  if (!lockFilePath) {
    return null
  }
  const commits = await gitRepository.getFileCommitLogs(lockFilePath, currentCommit)
  if (commits.length < 2) {
    return null
  }

  const currentVersion = await getPackageVersionAtCommit(
    packageName,
    packageManagerType,
    currentCommit,
    false,
    gitRepository,
  )

  for (let i = 1; i < commits.length; i += 1) {
    const commit = commits[i]
    if (!commit) {
      continue
    }
    const previousVersion = await getPackageVersionAtCommit(
      packageName,
      packageManagerType,
      commit,
      false,
      gitRepository,
    )
    if (previousVersion && previousVersion !== currentVersion) {
      return previousVersion
    }
  }

  return null
}

async function getRepositoryUrl(
  packageName: string,
  packageManagerType: PackageManagerType,
  packagistRegistry: PackagistRegistry,
  npmRegistry: NpmRegistry,
): Promise<string | null> {
  const registry =
    packageManagerType === PackageManagerType.Composer ? packagistRegistry : npmRegistry
  return await registry.getRepositoryUrl(packageName)
}

async function getLocalPath(
  packageName: string,
  packageManagerType: PackageManagerType,
  gitRepository: GitRepository,
): Promise<string | null> {
  const basePath = await gitRepository.getGitRoot()
  const relativePath =
    packageManagerType === PackageManagerType.Composer
      ? `vendor/${packageName}`
      : `node_modules/${packageName}`
  const fullPath = `${basePath}/${relativePath}`
  try {
    await fs.access(fullPath)
    return fullPath
  } catch {
    return null
  }
}

function getFormatter(format: string, summary: boolean, useAnsi: boolean) {
  switch (format) {
    case 'json':
      return new ReleaseNotesJsonOutput(summary)
    case 'markdown':
      return new ReleaseNotesMarkdownOutput(summary)
    default:
      return new ReleaseNotesTextOutput(summary, useAnsi)
  }
}

function safeNormalizeForSort(version: string): string {
  try {
    return VersionNormalizer.normalize(version)
  } catch {
    return VersionNormalizer.stripPrefix(version)
  }
}

function lockFileNameForType(type: PackageManagerType): string {
  switch (type) {
    case PackageManagerType.Composer:
      return 'composer.lock'
    case PackageManagerType.Pnpm:
      return 'pnpm-lock.yaml'
    case PackageManagerType.Yarn:
      return 'yarn.lock'
    case PackageManagerType.PackageJson:
      return 'package.json'
    case PackageManagerType.Npm:
    default:
      return 'package-lock.json'
  }
}

function createLockFileParser(type: PackageManagerType, content: string) {
  switch (type) {
    case PackageManagerType.Composer:
      return new ComposerLockFile(content)
    case PackageManagerType.Pnpm:
      return new PnpmLockFile(content)
    case PackageManagerType.Yarn:
      return new YarnLockFile(content)
    case PackageManagerType.PackageJson:
      return new PackageJsonFile(content)
    case PackageManagerType.Npm:
    default:
      return new NpmPackageLockFile(content)
  }
}

async function findLockFilePath(
  type: PackageManagerType,
  gitRepository: GitRepository,
): Promise<string | null> {
  const gitRoot = await gitRepository.getGitRoot()
  const cwd = process.cwd()
  const filename = lockFileNameForType(type)

  for await (const dir of walkUpToRoot(cwd, gitRoot)) {
    const candidate = path.join(dir, filename)
    if (await fileExists(candidate)) {
      return path.relative(gitRoot, candidate)
    }
  }

  return null
}

async function* walkUpToRoot(startDir: string, stopDir: string): AsyncGenerator<string> {
  let current = path.resolve(startDir)
  const stop = path.resolve(stopDir)

  while (true) {
    yield current

    if (current === stop) {
      break
    }

    const parent = path.dirname(current)
    if (parent === current) {
      break
    }
    current = parent
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}
