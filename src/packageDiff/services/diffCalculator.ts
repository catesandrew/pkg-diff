import path from 'node:path'
import fs from 'node:fs/promises'
import { PackageManagerType, PACKAGE_MANAGER_TYPES } from '../analyzers/packageManagerType.js'
import { AnalyzerRegistry } from './analyzerRegistry.js'
import { DependencyFile } from '../data/dependencyFile.js'
import { DiffResult } from '../data/diffResult.js'
import { DependencyDiff } from '../data/dependencyDiff.js'
import { PackageChange } from '../data/packageChange.js'
import { GitRepository } from './gitRepository.js'
import { SemverAnalyzer } from '../helpers/semverAnalyzer.js'
import semver from 'semver'

export class DiffCalculator {
  private dependencyFiles: DependencyFile[] = []
  private dependencyTypes: PackageManagerType[] = []
  private fromCommit: string | null = null
  private toCommit: string | null = null
  private ignoreLast = false
  private skipReleaseCount = false
  private includeEmptyDiffs = false
  private diffResult: DiffResult | null = null
  private packageJsonSections: Set<string> | null = null

  constructor(
    private readonly git: GitRepository,
    private readonly analyzerRegistry: AnalyzerRegistry,
  ) {}

  private async initializeDependencyFilesStructure(): Promise<void> {
    if (this.dependencyFiles.length > 0) return
    this.dependencyFiles = await this.discoverDependencyFiles()
  }

  fromCommitRef(commit: string | null): this {
    this.fromCommit = commit
    return this
  }

  toCommitRef(commit: string | null): this {
    this.toCommit = commit
    return this
  }

  ignoreLastCommit(ignore = true): this {
    this.ignoreLast = ignore
    return this
  }

  skipReleaseCountFetch(skip = true): this {
    this.skipReleaseCount = skip
    return this
  }

  includeEmptyDiffsWhenNoChanges(include = true): this {
    this.includeEmptyDiffs = include
    return this
  }

  for(type: PackageManagerType): this {
    this.dependencyTypes.push(type)
    return this
  }

  packageJsonOnlySections(sections: string[] | null): this {
    this.packageJsonSections = sections && sections.length ? new Set(sections) : null
    return this
  }

  private getActiveDependencyTypes(): PackageManagerType[] {
    return this.dependencyTypes.length === 0 ? PACKAGE_MANAGER_TYPES : this.dependencyTypes
  }

  async run(
    withProgress = false,
  ): Promise<DiffResult | { total: number; generator: AsyncGenerator<PackageChange> }> {
    if (withProgress) {
      return this.runWithProgress()
    }

    const { generator } = await this.runWithProgress()
    for await (const _ of generator) {
      // drain generator
    }
    return this.getResult()
  }

  getResult(): DiffResult {
    return this.diffResult ?? new DiffResult([], false)
  }

  private async runWithProgress(): Promise<{
    total: number
    generator: AsyncGenerator<PackageChange>
  }> {
    const generator = this.processDiffsWithProgress()
    const total = await this.calculatePackageChangesCount()
    return { total, generator }
  }

  private async calculatePackageChangesCount(): Promise<number> {
    if (this.fromCommit !== null || this.toCommit !== null) {
      return this.countPackageChangesForCustomCommits()
    }

    await this.initializeDependencyFiles(this.ignoreLast)
    const relevantFiles = await this.getRelevantFiles()
    if (relevantFiles.length === 0) {
      return 0
    }

    return this.countPackageChangesForFiles(relevantFiles)
  }

  private async *processDiffsWithProgress(): AsyncGenerator<PackageChange> {
    const diffs: DependencyDiff[] = []
    this.diffResult = new DiffResult(diffs, false)

    if (this.fromCommit !== null || this.toCommit !== null) {
      for await (const change of this.processCustomCommitsWithProgress(diffs)) {
        yield change
      }
      this.diffResult = new DiffResult(diffs, false)
      return
    }

    await this.initializeDependencyFiles(this.ignoreLast)
    const relevantFiles = await this.getRelevantFiles()

    if (relevantFiles.length === 0) {
      this.diffResult = new DiffResult(diffs, false)
      return
    }

    const recentlyUpdated = this.dependencyFiles.some((file) => file.hasBeenRecentlyUpdated)
    for await (const change of this.processFilesWithProgress(
      relevantFiles,
      diffs,
      recentlyUpdated,
    )) {
      yield change
    }
    this.diffResult = new DiffResult(diffs, recentlyUpdated)
  }

  private async initializeDependencyFiles(ignoreLast: boolean): Promise<void> {
    await this.initializeDependencyFilesStructure()

    this.dependencyFiles = await Promise.all(
      this.dependencyFiles.map(async (dependencyFile) => {
        const hasBeenRecentlyUpdated =
          !ignoreLast && (await this.git.isFileRecentlyUpdated(dependencyFile.file))
        const commitLogs = await this.git.getFileCommitLogs(dependencyFile.file)
        const hasCommitLogs = commitLogs.length > 0
        return dependencyFile.withUpdatedStatus(hasBeenRecentlyUpdated, hasCommitLogs, commitLogs)
      }),
    )
  }

  private getCommitHashToCompare(
    commitLogs: string[],
    recentlyUpdated: boolean,
  ): [string | null, string | null] {
    const last = recentlyUpdated ? null : (commitLogs[0] ?? null)
    const previousHashKey = recentlyUpdated ? 0 : 1
    const previous = commitLogs[previousHashKey] ?? null
    return [last, previous]
  }

  private calculatePackageDiff(
    type: PackageManagerType,
    last: string,
    previous: string | null,
  ): Record<string, import('../analyzers/analyzerInterface.js').PackageDiffInfo> {
    return this.analyzerRegistry.get(type).calculateDiff(last, previous)
  }

  private async *convertToPackageChangesWithProgress(
    diff: Record<
      string,
      import('../analyzers/analyzerInterface.js').PackageDiffInfo
    >,
    type: PackageManagerType,
    skipReleaseCount: boolean,
  ): AsyncGenerator<PackageChange> {
    for (const [pkg, info] of Object.entries(diff)) {
      const change = await this.createPackageChange(pkg, info, type, skipReleaseCount)
      if (change) {
        yield change
      }
    }
  }

  private async getReleasesCount(
    type: PackageManagerType,
    packageName: string,
    infos: { from: string; to: string; infos_url?: string },
  ): Promise<number | null> {
    const context = type === PackageManagerType.Composer ? { url: infos.infos_url } : {}
    return this.analyzerRegistry
      .get(type)
      .getReleasesCount(packageName, infos.from, infos.to, context) as Promise<number | null>
  }

  private async resolveCommitHashes(): Promise<[string | null, string]> {
    const fromHash = this.fromCommit ? await this.git.resolveCommitHash(this.fromCommit) : null
    const toHash = this.toCommit
      ? await this.git.resolveCommitHash(this.toCommit)
      : await this.git.resolveCommitHash('HEAD')
    return [fromHash, toHash]
  }

  private async getFileContents(filename: string, hash: string | null): Promise<string | null> {
    if (hash) {
      const content = await this.git.getFileContentAtCommit(filename, hash)
      return content || null
    }

    const gitRoot = await this.git.getGitRoot()
    const fullPath = path.isAbsolute(filename) ? filename : path.join(gitRoot, filename)
    try {
      const content = await fs.readFile(fullPath, 'utf8')
      return content
    } catch {
      return null
    }
  }

  private async getRelevantFiles(): Promise<DependencyFile[]> {
    await this.initializeDependencyFilesStructure()
    if (this.includeEmptyDiffs) {
      return this.dependencyFiles
    }
    const recentlyUpdated = this.dependencyFiles.some((file) => file.hasBeenRecentlyUpdated)
    const hasCommitLogs = this.dependencyFiles.some((file) => file.hasCommitLogs)
    if (!recentlyUpdated && !hasCommitLogs) {
      return []
    }

    return recentlyUpdated
      ? this.dependencyFiles.filter((file) => file.hasBeenRecentlyUpdated)
      : this.dependencyFiles.filter((file) => file.hasCommitLogs)
  }

  private async discoverDependencyFiles(): Promise<DependencyFile[]> {
    const gitRoot = await this.git.getGitRoot()
    const cwd = process.cwd()
    const activeTypes = this.getActiveDependencyTypes()
    const dependencyFiles: DependencyFile[] = []
    const seen = new Set<string>()

    const addFile = (type: PackageManagerType, fullPath: string, relativePath?: string) => {
      const rel = relativePath ?? path.relative(gitRoot, fullPath)
      const key = `${type}:${rel}`
      if (seen.has(key)) return
      seen.add(key)
      dependencyFiles.push(DependencyFile.create(type, rel))
    }

    for await (const dir of walkUpToRoot(cwd, gitRoot)) {
      if (activeTypes.includes(PackageManagerType.Npm)) {
        const npmLock = path.join(dir, 'package-lock.json')
        if (await fileExists(npmLock)) {
          addFile(PackageManagerType.Npm, npmLock)
        }
      }

      if (activeTypes.includes(PackageManagerType.Pnpm)) {
        const pnpmLock = path.join(dir, 'pnpm-lock.yaml')
        if (await fileExists(pnpmLock)) {
          addFile(PackageManagerType.Pnpm, pnpmLock)
        }
      }

      if (activeTypes.includes(PackageManagerType.Yarn)) {
        const yarnLock = path.join(dir, 'yarn.lock')
        if (await fileExists(yarnLock)) {
          addFile(PackageManagerType.Yarn, yarnLock)
        }
      }

      if (activeTypes.includes(PackageManagerType.Composer)) {
        const composerLock = path.join(dir, 'composer.lock')
        if (await fileExists(composerLock)) {
          addFile(PackageManagerType.Composer, composerLock)
        }
      }

      if (activeTypes.includes(PackageManagerType.PackageJson)) {
        const packageJson = path.join(dir, 'package.json')
        if (await fileExists(packageJson)) {
          addFile(PackageManagerType.PackageJson, packageJson)
        }
      }

      if (dir === gitRoot) {
        break
      }
    }

    if (activeTypes.includes(PackageManagerType.PackageJson)) {
      // Include all tracked package.json files in the repo (monorepo workspaces).
      const tracked = await this.git.listTrackedFiles(['package.json', ':(glob)**/package.json'])
      for (const filename of tracked) {
        if (filename.endsWith('/package.json') || filename === 'package.json') {
          const key = `${PackageManagerType.PackageJson}:${filename}`
          if (seen.has(key)) continue
          seen.add(key)
          dependencyFiles.push(DependencyFile.create(PackageManagerType.PackageJson, filename))
        }
      }
    }

    return dependencyFiles
  }

  private async isFileNew(filename: string, previousHash: string | null): Promise<boolean> {
    if (previousHash === null) {
      return true
    }
    const commitPriorToLast = await this.git.getFileCommitLogs(filename, previousHash)
    return commitPriorToLast.length === 0
  }

  private async createPackageChange(
    packageName: string,
    infos: import('../analyzers/analyzerInterface.js').PackageDiffInfo,
    type: PackageManagerType,
    skipReleaseCount: boolean,
  ): Promise<PackageChange | null> {
    const fromSection = infos.from_section ?? null
    const toSection = infos.to_section ?? null

    if (infos.from !== null && infos.to !== null) {
      const semverChangeType = SemverAnalyzer.determineSemverChangeType(infos.from, infos.to)

      const fromCoerced = semver.coerce(infos.from)
      const toCoerced = semver.coerce(infos.to)

      const releasesCount =
        skipReleaseCount || !fromCoerced || !toCoerced
          ? null
          : await this.getReleasesCount(type, packageName, {
              ...infos,
              from: infos.from,
              to: infos.to,
            })

      if (!fromCoerced || !toCoerced) {
        return PackageChange.changed(packageName, type, infos.from, infos.to, fromSection, toSection)
      }

      if (semver.gt(toCoerced, fromCoerced)) {
        return PackageChange.updated(
          packageName,
          type,
          infos.from,
          infos.to,
          releasesCount ?? null,
          semverChangeType,
          fromSection,
          toSection,
        )
      }
      return PackageChange.downgraded(
        packageName,
        type,
        infos.from,
        infos.to,
        releasesCount ?? null,
        semverChangeType,
        fromSection,
        toSection,
      )
    }

    if (infos.from === null && infos.to !== null) {
      return PackageChange.added(packageName, type, infos.to, toSection)
    }

    if (infos.from !== null && infos.to === null) {
      return PackageChange.removed(packageName, type, infos.from, fromSection)
    }

    return null
  }

  private async countPackageChangesForCustomCommits(): Promise<number> {
    let totalCount = 0
    const [fromHash, toHash] = await this.resolveCommitHashes()

    await this.initializeDependencyFilesStructure()
    for (const dependencyFile of this.dependencyFiles) {
      const filename = dependencyFile.file
      const toContent = await this.getFileContents(filename, toHash)
      const fromContent = await this.getFileContents(filename, fromHash)
      if (toContent) {
        const packageDiffs = this.calculatePackageDiff(dependencyFile.type, toContent, fromContent)
        totalCount += Object.keys(packageDiffs).length
      }
    }

    return totalCount
  }

  private async countPackageChangesForFiles(relevantFiles: DependencyFile[]): Promise<number> {
    let totalCount = 0
    const recentlyUpdated = this.dependencyFiles.some((file) => file.hasBeenRecentlyUpdated)
    const filenames = relevantFiles.map((file) => file.file)
    await this.git.getMultipleFilesCommitLogs(filenames)

    for (const dependencyFile of relevantFiles) {
      const commitLogsToCompare = dependencyFile.commitLogs
      const [lastHash, previousHash] = this.getCommitHashToCompare(
        commitLogsToCompare,
        recentlyUpdated,
      )
      const existInPreviousHash = commitLogsToCompare.includes(previousHash ?? '')
      const previousHashOrNot = existInPreviousHash ? previousHash : null

      if (previousHashOrNot === null) {
        const isNew = await this.isFileNew(dependencyFile.file, previousHash)
        if (!isNew) {
          continue
        }
      }

      const toContent = await this.getFileContents(dependencyFile.file, lastHash)
      const fromContent = await this.getFileContents(dependencyFile.file, previousHashOrNot)
      if (toContent) {
        const packageDiffs = this.calculatePackageDiff(dependencyFile.type, toContent, fromContent)
        totalCount += Object.keys(packageDiffs).length
      }
    }

    return totalCount
  }

  private async *processCustomCommitsWithProgress(
    diffs: DependencyDiff[],
  ): AsyncGenerator<PackageChange> {
    const [fromHash, toHash] = await this.resolveCommitHashes()

    await this.initializeDependencyFilesStructure()
    for (const dependencyFile of this.dependencyFiles) {
      const filename = dependencyFile.file
      const generator = this.calculateDiffBetweenCommitsWithProgress(
        dependencyFile.type,
        filename,
        fromHash,
        toHash,
        this.skipReleaseCount,
        false,
        diffs,
      )

      for await (const packageChange of generator) {
        yield packageChange
      }
    }
  }

  private async *processFilesWithProgress(
    relevantFiles: DependencyFile[],
    diffs: DependencyDiff[],
    recentlyUpdated: boolean,
  ): AsyncGenerator<PackageChange> {
    const filenames = relevantFiles.map((file) => file.file)
    await this.git.getMultipleFilesCommitLogs(filenames)

    for (const dependencyFile of relevantFiles) {
      const commitLogsToCompare = dependencyFile.commitLogs
      const [lastHash, previousHash] = this.getCommitHashToCompare(
        commitLogsToCompare,
        recentlyUpdated,
      )
      const existInPreviousHash = commitLogsToCompare.includes(previousHash ?? '')
      const previousHashOrNot = existInPreviousHash ? previousHash : null

      let isNew = false
      if (previousHashOrNot === null) {
        isNew = await this.isFileNew(dependencyFile.file, previousHash)
        if (!isNew) {
          continue
        }
      }

      const generator = this.calculateDiffBetweenCommitsWithProgress(
        dependencyFile.type,
        dependencyFile.file,
        previousHashOrNot,
        lastHash,
        this.skipReleaseCount,
        isNew,
        diffs,
      )

      for await (const packageChange of generator) {
        yield packageChange
      }
    }
  }

  private async *calculateDiffBetweenCommitsWithProgress(
    type: PackageManagerType,
    filename: string,
    fromHash: string | null,
    toHash: string | null,
    skipReleaseCount = false,
    isNew = false,
    diffs?: DependencyDiff[],
  ): AsyncGenerator<PackageChange> {
    const toContent = await this.getFileContents(filename, toHash)
    const fromContent =
      isNew && fromHash === null ? null : await this.getFileContents(filename, fromHash)

    if (!toContent) {
      return
    }

    let packageDiffs = this.calculatePackageDiff(type, toContent, fromContent) as Record<
      string,
      import('../analyzers/analyzerInterface.js').PackageDiffInfo
    >

    if (type === PackageManagerType.PackageJson && this.packageJsonSections) {
      const allowed = this.packageJsonSections
      packageDiffs = Object.fromEntries(
        Object.entries(packageDiffs).filter(([, info]) => {
          const fromSection = info.from_section
          const toSection = info.to_section
          return (
            (fromSection ? allowed.has(fromSection) : false) ||
            (toSection ? allowed.has(toSection) : false)
          )
        }),
      )
    }

    if (Object.keys(packageDiffs).length === 0) {
      if (this.includeEmptyDiffs) {
        const fromHashShort = fromHash ? await this.git.getShortCommitHash(fromHash) : null
        const toHashShort = toHash ? await this.git.getShortCommitHash(toHash) : null
        const workspaceName =
          type === PackageManagerType.PackageJson ? extractWorkspaceName(toContent) : null
        const diff = new DependencyDiff(
          filename,
          type,
          fromHashShort,
          toHashShort,
          [],
          isNew,
          workspaceName,
        )
        if (diffs) {
          diffs.push(diff)
        }
      }
      return
    }

    const fromHashShort = fromHash ? await this.git.getShortCommitHash(fromHash) : null
    const toHashShort = toHash ? await this.git.getShortCommitHash(toHash) : null

    const changes: PackageChange[] = []
    for await (const packageChange of this.convertToPackageChangesWithProgress(
      packageDiffs,
      type,
      skipReleaseCount,
    )) {
      changes.push(packageChange)
      yield packageChange
    }

    const workspaceName = type === PackageManagerType.PackageJson ? extractWorkspaceName(toContent) : null
    const diff = new DependencyDiff(filename, type, fromHashShort, toHashShort, changes, isNew, workspaceName)
    if (diffs) {
      diffs.push(diff)
    }
    return
  }
}

function extractWorkspaceName(packageJsonContent: string): string | null {
  try {
    const obj = JSON.parse(packageJsonContent) as Record<string, unknown>
    const name = obj && typeof obj['name'] === 'string' ? (obj['name'] as string) : null
    return name && name.trim() ? name : null
  } catch {
    return null
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
