import fs from 'node:fs/promises'
import path from 'node:path'

export async function which(cmd: string): Promise<string | null> {
  const paths = (process.env.PATH ?? '').split(path.delimiter)
  const extensions =
    process.platform === 'win32' ? (process.env.PATHEXT ?? '.EXE').split(';') : ['']

  for (const p of paths) {
    for (const ext of extensions) {
      const fullPath = path.join(p, `${cmd}${ext}`)
      try {
        await fs.access(fullPath)
        return fullPath
      } catch {
        // continue
      }
    }
  }

  return null
}
