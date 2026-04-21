import { AnalyzerInterface } from '../analyzers/analyzerInterface.js'
import { PackageManagerType } from '../analyzers/packageManagerType.js'

export class AnalyzerRegistry {
  private analyzers = new Map<PackageManagerType, () => AnalyzerInterface>()
  private instances = new Map<PackageManagerType, AnalyzerInterface>()

  register(type: PackageManagerType, factory: () => AnalyzerInterface): this {
    this.analyzers.set(type, factory)
    return this
  }

  has(type: PackageManagerType): boolean {
    return this.analyzers.has(type)
  }

  get(type: PackageManagerType): AnalyzerInterface {
    const existing = this.instances.get(type)
    if (existing) {
      return existing
    }
    const factory = this.analyzers.get(type)
    if (!factory) {
      throw new Error(`No analyzer registered for package manager type: ${type}`)
    }
    const analyzer = factory()
    this.instances.set(type, analyzer)
    return analyzer
  }
}
