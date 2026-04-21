import { describe, expect, test } from 'bun:test'
import { moveLeadingCommandOptionsAfterCommand, shouldDefaultToAnalyse } from '../../src/packageDiff/utils/argv.ts'

const known = new Set(['analyse', 'between', 'check', 'config', 'changelog', 'tui'])

describe('CLI argv normalization', () => {
  test('moves command options that appear before the command', () => {
    const args = ['--from', 'develop', 'tui']
    expect(moveLeadingCommandOptionsAfterCommand(args, known)).toEqual([
      'tui',
      '--from',
      'develop',
    ])
  })

  test('keeps unknown args before the command', () => {
    const args = ['--verbose', '--from', 'develop', 'tui']
    expect(moveLeadingCommandOptionsAfterCommand(args, known)).toEqual([
      '--verbose',
      'tui',
      '--from',
      'develop',
    ])
  })

  test('does not default to analyse when asking for help/version', () => {
    expect(shouldDefaultToAnalyse(['--help'], known)).toBe(false)
    expect(shouldDefaultToAnalyse(['-v'], known)).toBe(false)
  })

  test('defaults to analyse when no command is provided', () => {
    expect(shouldDefaultToAnalyse(['--from', 'develop'], known)).toBe(true)
  })
})

