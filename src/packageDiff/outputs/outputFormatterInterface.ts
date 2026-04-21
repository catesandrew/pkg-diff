import { DiffResult } from '../data/diffResult.js'

export interface OutputFormatterInterface {
  format(result: DiffResult): string
}
