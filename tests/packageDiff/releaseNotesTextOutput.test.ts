import { describe, expect, test } from 'bun:test'
import { ReleaseNote } from '../../src/packageDiff/data/releaseNote.ts'
import { ReleaseNotesCollection } from '../../src/packageDiff/data/releaseNotesCollection.ts'
import { ReleaseNotesTextOutput } from '../../src/packageDiff/outputs/releaseNotes/releaseNotesTextOutput.ts'

describe('ReleaseNotesTextOutput', () => {
  test('formats a detailed view without ANSI when useAnsi=false', () => {
    const note = new ReleaseNote(
      'v1.2.3',
      'v1.2.3',
      ["## What's Changed", '- Added thing', '', '## Fixes', '- Fixed issue'].join('\n'),
      new Date('2024-01-01T00:00:00.000Z'),
      'https://github.com/org/repo/releases/tag/v1.2.3',
    )
    const collection = new ReleaseNotesCollection([note])
    const output = new ReleaseNotesTextOutput(false, false).format(collection)

    expect(output).toContain('Release Notes')
    // No breaking changes in note, but "Changes:" should exist
    expect(output).toContain('Changes:')
    expect(output).toContain('Fixes:')
    expect(output).toContain('Added thing')
    expect(output).toContain('Fixed issue')
  })
})
