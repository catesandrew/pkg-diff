export class PackageInformationsException extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PackageInformationsException'
  }
}
