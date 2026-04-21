import { CacheService } from './cacheService.js'
import { GithubAuthService } from './githubAuthService.js'
import { URL } from 'node:url'

export interface HttpOptions {
  user_agent?: string
  auth?: { username: string; password: string }
  headers?: Record<string, string>
}

export class HttpService {
  private readonly cache: CacheService
  private readonly githubAuth: GithubAuthService
  private lastResponseHeaders: Record<string, string | string[]> = {}

  constructor(cache: CacheService, githubAuth: GithubAuthService) {
    this.cache = cache
    this.githubAuth = githubAuth
  }

  async get(url: string, options: HttpOptions = {}): Promise<string> {
    const cacheKey = `http_${url}`
    const cached = await this.cache.getCached<string>(cacheKey)
    if (cached !== undefined) {
      return cached
    }

    const body = await this.fetchUrl(url, options)
    const cacheDuration = this.cache.getCacheDuration(this.lastResponseHeaders)
    if (cacheDuration > 0) {
      await this.cache.set(cacheKey, body, cacheDuration)
    }
    return body
  }

  async getWithHeaders(
    url: string,
    options: HttpOptions = {},
  ): Promise<{ body: string; headers: Record<string, string | string[]> }> {
    const cacheKey = `http_with_headers_${url}`
    const cached = await this.cache.getCached<{
      body: string
      headers: Record<string, string | string[]>
    }>(cacheKey)
    if (cached !== undefined) {
      return cached
    }

    const body = await this.fetchUrl(url, options)
    const payload = { body, headers: this.lastResponseHeaders }
    const cacheDuration = this.cache.getCacheDuration(this.lastResponseHeaders)
    if (cacheDuration > 0) {
      await this.cache.set(cacheKey, payload, cacheDuration)
    }
    return payload
  }

  getResponseHeaders(): Record<string, string | string[]> {
    return this.lastResponseHeaders
  }

  private async fetchUrl(url: string, options: HttpOptions): Promise<string> {
    const headers: Record<string, string> = {}
    const userAgent = options.user_agent ?? 'package-diff/dev'
    headers['User-Agent'] = userAgent

    if (options.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        headers[key] = value
      }
    }

    if (options.auth) {
      const token = Buffer.from(`${options.auth.username}:${options.auth.password}`).toString(
        'base64',
      )
      headers['Authorization'] = `Basic ${token}`
    }

    if (this.isGithubApiUrl(url) && !headers['Authorization']) {
      const token = await this.githubAuth.getToken()
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    let response: Response
    try {
      response = await fetch(url, { headers, redirect: 'follow', signal: controller.signal })
    } catch (error) {
      clearTimeout(timeout)
      if (error instanceof Error) {
        throw new Error(`Failed to fetch URL: ${error.message}`)
      }
      throw new Error('Failed to fetch URL')
    }
    clearTimeout(timeout)

    if (!response.ok) {
      throw new Error(`HTTP request failed with status code: ${response.status}`)
    }

    const body = await response.text()
    this.lastResponseHeaders = this.parseHeaders(response.headers)
    return body
  }

  private parseHeaders(headers: Headers): Record<string, string | string[]> {
    const result: Record<string, string | string[]> = {}
    for (const [name, value] of headers.entries()) {
      const key = name.toLowerCase()
      if (result[key]) {
        const existing = result[key]
        result[key] = Array.isArray(existing) ? [...existing, value] : [existing, value]
      } else {
        result[key] = value
      }
    }
    return result
  }

  private isGithubApiUrl(url: string): boolean {
    try {
      const host = new URL(url).host
      return host === 'api.github.com'
    } catch {
      return false
    }
  }
}
