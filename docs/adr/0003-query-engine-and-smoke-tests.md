# ADR 0003: Replace The Legacy TUI With A Store Driven Shell

## Status

Accepted

## Context

The old `TerminalUI` was a single monolithic component. The migration goal was not only to keep package-diff interactive, but to move that interaction onto a more modular shell with clearer state boundaries and better testability.

## Decision

Replace the legacy `TerminalUI` entrypoint in the `tui` command with a new store-driven shell under `src/packageDiff/tuiNext/`, and verify the migrated CLI with both legacy unit tests and e2e smoke tests.

## Consequences

- The interactive UI now has explicit provider/store/screen boundaries.
- Legacy analysis behavior remains covered by the copied unit tests.
- CLI and help/output regressions are covered by smoke tests that spawn the real binary.
