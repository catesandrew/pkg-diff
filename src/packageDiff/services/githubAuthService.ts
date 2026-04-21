import fs from 'node:fs/promises'
import path from 'node:path'

export class GithubAuthService {
  private cachedToken: string | null = null
  private tokenLoaded = false

  async getToken(): Promise<string | null> {
    if (this.tokenLoaded) {
      return this.cachedToken
    }

    const envToken = process.env.GITHUB_TOKEN
    if (envToken) {
      this.cachedToken = envToken
      this.tokenLoaded = true
      return this.cachedToken
    }

    const token = await this.loadTokenFromAuthJson()
    if (token) {
      this.cachedToken = token
      this.tokenLoaded = true
      return this.cachedToken
    }

    const composerAuth = process.env.COMPOSER_AUTH
    if (composerAuth) {
      try {
        const authData = JSON.parse(composerAuth) as Record<string, unknown>
        const githubOauth = authData['github-oauth'] as Record<string, unknown> | undefined
        if (githubOauth && typeof githubOauth['github.com'] === 'string') {
          this.cachedToken = githubOauth['github.com']
          this.tokenLoaded = true
          return this.cachedToken
        }
      } catch {
        // ignore malformed
      }
    }

    this.tokenLoaded = true
    return null
  }

  async hasToken(): Promise<boolean> {
    return (await this.getToken()) !== null
  }

  clearCache(): void {
    this.cachedToken = null
    this.tokenLoaded = false
  }

  private async loadTokenFromAuthJson(): Promise<string | null> {
    const currentDir = process.cwd()
    const localAuthPath = path.join(currentDir, 'auth.json')

    const home = process.env.HOME ?? process.env.USERPROFILE
    const globalAuthPath = home ? path.join(home, '.composer', 'auth.json') : null

    const localToken = await this.extractTokenFromFile(localAuthPath)
    if (localToken) {
      return localToken
    }

    if (globalAuthPath) {
      return await this.extractTokenFromFile(globalAuthPath)
    }

    return null
  }

  private async extractTokenFromFile(filePath: string): Promise<string | null> {
    try {
      const content = await fs.readFile(filePath, 'utf8')
      const authData = JSON.parse(content) as Record<string, unknown>
      const githubOauth = authData['github-oauth'] as Record<string, unknown> | undefined
      if (
        githubOauth &&
        typeof githubOauth['github.com'] === 'string' &&
        githubOauth['github.com']
      ) {
        return githubOauth['github.com']
      }
      return null
    } catch {
      return null
    }
  }
}
