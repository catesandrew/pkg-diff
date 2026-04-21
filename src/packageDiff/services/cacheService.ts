import fs from 'node:fs/promises'
import path from 'node:path'
import { ConfigService } from './configService.js'

const APP_DIR = '.package-diff'

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

export class CacheService {
  private readonly config: ConfigService
  private readonly cacheDir: string
  private forceDisabled = false

  constructor(config: ConfigService, cacheDir?: string) {
    this.config = config
    this.cacheDir = cacheDir ?? this.getDefaultCacheDir()
  }

  async init(): Promise<void> {
    await this.ensureCacheDirectoryExists(this.cacheDir)
  }

  async get<T>(key: string, loader: () => Promise<T> | T): Promise<T> {
    if (!this.isCacheEnabled()) {
      return await loader()
    }

    const cached = await this.getCached<T>(key)
    if (cached !== undefined) {
      return cached
    }

    const value = await loader()
    if (value !== undefined && value !== null) {
      await this.set(key, value)
    }
    return value
  }

  async getCached<T>(key: string): Promise<T | undefined> {
    if (!this.isCacheEnabled()) {
      return undefined
    }
    const filePath = this.getCacheFilePath(key)
    try {
      const content = await fs.readFile(filePath, 'utf8')
      const entry = JSON.parse(content) as CacheEntry<T>
      if (!entry || typeof entry.expiresAt !== 'number') {
        return undefined
      }
      if (Date.now() > entry.expiresAt) {
        await fs.unlink(filePath).catch(() => undefined)
        return undefined
      }
      return entry.value
    } catch {
      return undefined
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (!this.isCacheEnabled()) {
      return
    }
    const duration = ttlSeconds ?? this.getCacheDuration()
    const entry: CacheEntry<T> = {
      value,
      expiresAt: Date.now() + duration * 1000,
    }
    const filePath = this.getCacheFilePath(key)
    await fs.writeFile(filePath, JSON.stringify(entry), 'utf8')
  }

  async delete(key: string): Promise<void> {
    const filePath = this.getCacheFilePath(key)
    await fs.unlink(filePath).catch(() => undefined)
  }

  async clear(): Promise<void> {
    await fs.rm(this.cacheDir, { recursive: true, force: true })
    await this.ensureCacheDirectoryExists(this.cacheDir)
  }

  isCacheEnabled(): boolean {
    if (this.forceDisabled) {
      return false
    }
    return Boolean(this.config.get('cache.enabled', true))
  }

  disableCache(): void {
    this.forceDisabled = true
  }

  enableCache(): void {
    this.forceDisabled = false
  }

  getCacheDuration(headers?: Record<string, string | string[]>): number {
    const minTime = Number(this.config.get('cache.min-time', 300))
    const maxTime = Number(this.config.get('cache.max-time', 86400))

    if (headers) {
      const duration = this.parseCacheHeaders(headers)
      if (duration !== null) {
        return Math.max(minTime, Math.min(duration, maxTime))
      }
    }

    return minTime
  }

  private parseCacheHeaders(headers: Record<string, string | string[]>): number | null {
    const cacheControl = headers['cache-control']
    const cacheControlValue = Array.isArray(cacheControl) ? cacheControl[0] : cacheControl
    if (cacheControlValue) {
      const match = cacheControlValue.match(/max-age=(\d+)/i)
      if (match) {
        return Number(match[1])
      }
      if (/no-cache|no-store/i.test(cacheControlValue)) {
        return 0
      }
    }

    const expires = headers['expires']
    const expiresValue = Array.isArray(expires) ? expires[0] : expires
    if (expiresValue) {
      const expiresTime = Date.parse(expiresValue)
      if (!Number.isNaN(expiresTime) && expiresTime > Date.now()) {
        return Math.floor((expiresTime - Date.now()) / 1000)
      }
    }

    return null
  }

  private sanitizeKey(key: string): string {
    return key.replace(/[^A-Za-z0-9_.]+/g, '_')
  }

  private getCacheFilePath(key: string): string {
    return path.join(this.cacheDir, `${this.sanitizeKey(key)}.json`)
  }

  private getDefaultCacheDir(): string {
    const home = process.env.HOME ?? process.env.USERPROFILE
    if (!home) {
      throw new Error('Cannot determine home directory')
    }
    return path.join(home, APP_DIR, 'cache')
  }

  private async ensureCacheDirectoryExists(directory: string): Promise<void> {
    await fs.mkdir(directory, { recursive: true })
  }
}
