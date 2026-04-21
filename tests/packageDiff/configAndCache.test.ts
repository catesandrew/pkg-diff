import { describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { ConfigService } from '../../src/packageDiff/services/configService.ts'
import { CacheService } from '../../src/packageDiff/services/cacheService.ts'

async function makeTempDir(prefix: string): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), prefix))
}

describe('ConfigService + CacheService', () => {
  test('ConfigService persists values to YAML', async () => {
    const dir = await makeTempDir('package-diff-config-')
    const configPath = path.join(dir, 'config.yaml')

    const config = new ConfigService(configPath)
    await config.init()

    expect(config.get<boolean>('cache.enabled')).toBe(true)

    await config.set('tui.mode', 'detailed')

    const config2 = new ConfigService(configPath)
    await config2.init()
    expect(config2.get<string>('tui.mode')).toBe('detailed')
  })

  test('ConfigService set ignores empty key (does not throw)', async () => {
    const dir = await makeTempDir('package-diff-config-')
    const configPath = path.join(dir, 'config.yaml')

    const config = new ConfigService(configPath)
    await config.init()
    await expect(config.set('', 'x')).resolves.toBeUndefined()
  })

  test('CacheService caches loader results and respects expiry', async () => {
    const dir = await makeTempDir('package-diff-cache-')
    const configPath = path.join(dir, 'config.yaml')
    const cacheDir = path.join(dir, 'cache')

    const config = new ConfigService(configPath)
    await config.init()
    const cache = new CacheService(config, cacheDir)
    await cache.init()

    let calls = 0
    const value1 = await cache.get('k', async () => {
      calls += 1
      return { ok: true }
    })
    const value2 = await cache.get('k', async () => {
      calls += 1
      return { ok: false }
    })

    expect(value1).toEqual({ ok: true })
    expect(value2).toEqual({ ok: true })
    expect(calls).toBe(1)

    await cache.set('expired', 'x', -1)
    expect(await cache.getCached('expired')).toBeUndefined()
  })
})
