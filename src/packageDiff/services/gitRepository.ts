import path from 'node:path'
import fs from 'node:fs/promises'
import { ProcessService } from './processService.js'

export class GitRepository {
  private gitRoot: string | null = null
  private currentDir: string | null = null
  private relativeCurrentDir: string | null = null
  private initialized = false
  private processService: ProcessService

  constructor(processService?: ProcessService) {
    this.processService = processService ?? new ProcessService()
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return
    }

    const gitProcess = await this.processService.git(['rev-parse', '--show-toplevel'])
    if (!gitProcess.success || !gitProcess.stdout.trim()) {
      throw new Error('Not in a git repository or git command failed')
    }

    this.gitRoot = path.normalize(gitProcess.stdout.trim())
    this.currentDir = path.normalize(process.cwd())

    let normalizedGitRoot = this.gitRoot
    let normalizedCurrentDir = this.currentDir

    if (process.platform === 'win32') {
      normalizedGitRoot = (await fs.realpath(normalizedGitRoot)).toLowerCase()
      normalizedCurrentDir = (await fs.realpath(normalizedCurrentDir)).toLowerCase()
    }

    this.relativeCurrentDir = path.relative(normalizedGitRoot, normalizedCurrentDir)
    this.initialized = true
  }

  async getGitRoot(): Promise<string> {
    await this.ensureInitialized()
    return this.gitRoot ?? ''
  }

  async getCurrentDir(): Promise<string> {
    await this.ensureInitialized()
    return this.currentDir ?? ''
  }

  async getRelativeCurrentDir(): Promise<string> {
    await this.ensureInitialized()
    return this.relativeCurrentDir ?? ''
  }

  async getFileCommitLogs(filename: string, beforeHash = ''): Promise<string[]> {
    await this.ensureInitialized()
    const args = ['log', '--pretty=format:%h', '--', filename]
    if (beforeHash) {
      args.splice(1, 0, beforeHash)
    }
    const process = await this.processService.git(args, this.gitRoot ?? undefined)
    if (!process.success || !process.stdout.trim()) {
      return []
    }
    return process.stdout.trim().split('\n')
  }

  async getMultipleFilesCommitLogs(filenames: string[]): Promise<string[]> {
    await this.ensureInitialized()
    const args = ['log', '--pretty=format:%h', '--', ...filenames]
    const process = await this.processService.git(args, this.gitRoot ?? undefined)
    if (!process.success || !process.stdout.trim()) {
      return []
    }
    return process.stdout.trim().split('\n')
  }

  async listTrackedFiles(pathspecs: string[]): Promise<string[]> {
    await this.ensureInitialized()
    const args = ['ls-files', '-z', '--', ...pathspecs]
    const process = await this.processService.git(args, this.gitRoot ?? undefined)
    if (!process.success || !process.stdout) {
      return []
    }

    return process.stdout
      .split('\0')
      .map((s) => s.trim())
      .filter(Boolean)
  }

  async isFileRecentlyUpdated(filename: string): Promise<boolean> {
    await this.ensureInitialized()
    const process = await this.processService.git(
      ['status', '--porcelain'],
      this.gitRoot ?? undefined,
    )
    if (!process.success || !process.stdout.trim()) {
      return false
    }
    const lines = process.stdout.trim().split('\n')
    const statusMap = new Map<string, string>()
    for (const line of lines) {
      const parts = line.trim().split(/\s+/).filter(Boolean)
      if (parts.length >= 2) {
        const file = parts[1]
        const status = parts[0]
        if (file && status) {
          statusMap.set(file, status)
        }
      }
    }

    const relative = this.relativeCurrentDir ?? ''
    const fileExists = await fileExistsAsync(filename)

    if (relative && fileExists && !statusMap.has(filename)) {
      return false
    }

    const status = statusMap.get(filename)
    return status !== undefined && ['AM', 'M', 'A', '??'].includes(status)
  }

  async getFileContentAtCommit(filename: string, commitHash: string): Promise<string> {
    await this.ensureInitialized()
    const process = await this.processService.git(
      ['show', `${commitHash}:${filename}`],
      this.gitRoot ?? undefined,
    )
    return process.success ? process.stdout : ''
  }

  async validateCommit(commit: string): Promise<boolean> {
    await this.ensureInitialized()
    const process = await this.processService.git(
      ['rev-parse', '--verify', commit],
      this.gitRoot ?? undefined,
    )
    return process.success
  }

  async resolveCommitHash(commit: string): Promise<string> {
    await this.ensureInitialized()
    const process = await this.processService.git(['rev-parse', commit], this.gitRoot ?? undefined)
    if (!process.success) {
      throw new Error(`Invalid commit reference: ${commit}`)
    }
    return process.stdout.trim()
  }

  async getShortCommitHash(commit: string): Promise<string> {
    await this.ensureInitialized()
    const process = await this.processService.git(
      ['rev-parse', '--short', commit],
      this.gitRoot ?? undefined,
    )
    if (!process.success) {
      throw new Error(`Invalid commit reference: ${commit}`)
    }
    return process.stdout.trim()
  }
}

async function fileExistsAsync(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}
