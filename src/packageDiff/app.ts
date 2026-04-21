import { AnalyzerRegistry } from './services/analyzerRegistry.js'
import { CacheService } from './services/cacheService.js'
import { ConfigService } from './services/configService.js'
import { DiffCalculator } from './services/diffCalculator.js'
import { GitRepository } from './services/gitRepository.js'
import { HttpService } from './services/httpService.js'
import { GithubAuthService } from './services/githubAuthService.js'
import { ComposerAnalyzer } from './analyzers/composerAnalyzer.js'
import { NpmAnalyzer } from './analyzers/npmAnalyzer.js'
import { PnpmAnalyzer } from './analyzers/pnpmAnalyzer.js'
import { YarnAnalyzer } from './analyzers/yarnAnalyzer.js'
import { PackageJsonAnalyzer } from './analyzers/packageJsonAnalyzer.js'
import { PackageManagerType } from './analyzers/packageManagerType.js'
import { PackagistRegistry } from './analyzers/registries/packagistRegistry.js'
import { NpmRegistry } from './analyzers/registries/npmRegistry.js'
import { ReleaseNotesResolver } from './analyzers/releaseNotes/releaseNotesResolver.js'
import { ChangelogParser } from './analyzers/releaseNotes/changelogParser.js'
import { LocalVendorChangelogFetcher } from './analyzers/releaseNotes/fetchers/localVendorChangelogFetcher.js'
import { GithubReleaseFetcher } from './analyzers/releaseNotes/fetchers/githubReleaseFetcher.js'
import { GithubChangelogFetcher } from './analyzers/releaseNotes/fetchers/githubChangelogFetcher.js'

export async function createServices() {
  const config = new ConfigService()
  await config.init()

  const cache = new CacheService(config)
  await cache.init()

  const githubAuth = new GithubAuthService()
  const httpService = new HttpService(cache, githubAuth)

  const packagistRegistry = new PackagistRegistry(httpService)
  const npmRegistry = new NpmRegistry(httpService)

  const analyzerRegistry = new AnalyzerRegistry()
  analyzerRegistry
    .register(PackageManagerType.Composer, () => new ComposerAnalyzer(packagistRegistry))
    .register(PackageManagerType.Npm, () => new NpmAnalyzer(npmRegistry))
    .register(PackageManagerType.Pnpm, () => new PnpmAnalyzer(npmRegistry))
    .register(PackageManagerType.Yarn, () => new YarnAnalyzer(npmRegistry))
    .register(PackageManagerType.PackageJson, () => new PackageJsonAnalyzer(npmRegistry))

  const gitRepository = new GitRepository()
  const diffCalculator = new DiffCalculator(gitRepository, analyzerRegistry)

  const changelogParser = new ChangelogParser()
  const releaseNotesResolver = new ReleaseNotesResolver()
  releaseNotesResolver.addFetcher(new LocalVendorChangelogFetcher(changelogParser))
  releaseNotesResolver.addFetcher(new GithubReleaseFetcher(httpService))
  releaseNotesResolver.addFetcher(new GithubChangelogFetcher(httpService, changelogParser))

  return {
    config,
    cache,
    httpService,
    packagistRegistry,
    npmRegistry,
    analyzerRegistry,
    gitRepository,
    diffCalculator,
    releaseNotesResolver,
  }
}
