import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { which } from '../utils/which.js'

const execFileAsync = promisify(execFile)

export interface ProcessResult {
  code: number | null
  stdout: string
  stderr: string
  success: boolean
}

export class ProcessService {
  async run(command: string[], cwd?: string, timeoutMs = 60000): Promise<ProcessResult> {
    const [file, ...args] = command
    if (!file) {
      return { code: 1, stdout: '', stderr: 'No command provided', success: false }
    }
    try {
      const { stdout, stderr } = await execFileAsync(file, args, { cwd, timeout: timeoutMs })
      return { code: 0, stdout: stdout.toString(), stderr: stderr.toString(), success: true }
    } catch (error) {
      if (error && typeof error === 'object' && 'stdout' in error && 'stderr' in error) {
        const err = error as { code?: number; stdout?: string | Buffer; stderr?: string | Buffer }
        return {
          code: err.code ?? 1,
          stdout: err.stdout ? err.stdout.toString() : '',
          stderr: err.stderr ? err.stderr.toString() : '',
          success: false,
        }
      }
      return {
        code: 1,
        stdout: '',
        stderr: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      }
    }
  }

  async git(args: string[], cwd?: string): Promise<ProcessResult> {
    return this.run(['git', ...args], cwd)
  }

  async php(args: string[], cwd?: string): Promise<ProcessResult> {
    const phpBinary = await which('php')
    if (!phpBinary) {
      throw new Error('PHP executable not found')
    }
    return this.run([phpBinary, ...args], cwd)
  }
}
