# package-diff

`package-diff` is a CLI for inspecting dependency changes between commits, branches, tags, and the working tree. This repository contains a migrated version of the app that keeps the original package analysis domain while replacing the old Ink TUI with a newer store-driven architecture shell.

## What Was Migrated

- The original dependency analysis domain now lives under `src/packageDiff/`.
- The new TUI architecture wraps that domain with:
  - a dedicated state provider
  - a modular fullscreen layout
  - a store-driven package list and release notes screen
  - a buildable Bun/TypeScript shell
- The legacy non-TUI commands are preserved: `analyse`, `between`, `check`, `config`, `changelog`, and `tui`.

## Run

```bash
bun install
bun run src/cli.ts
```

Headless smoke mode:

```bash
bun run src/cli.ts analyse --format text
bun run src/cli.ts check react --quiet
bun run src/cli.ts tui
```

## Onboarding

- Start with [docs/ONBOARDING.md](docs/ONBOARDING.md) for setup, architecture orientation, and the migration boundaries.
- Read the decision records in [docs/adr/](docs/adr/) before changing the CLI/runtime split or the new TUI shell.

## Commands

- `analyse`
- `between <from> [to]`
- `check <package>`
- `config [key] [value]`
- `changelog <package> [versionOrRange]`
- `tui`

## New TUI Architecture

The interactive TUI keeps the domain logic from the original app but moves the UI onto a more modular structure:

- `src/packageDiff/commands/tuiCommand.tsx`: command entrypoint that prepares package changes and launches the new shell
- `src/packageDiff/tuiNext/launch.tsx`: root launcher
- `src/packageDiff/tuiNext/PackageDiffApp.tsx`: provider shell
- `src/packageDiff/tuiNext/state.tsx`: external store hooks
- `src/packageDiff/tuiNext/PackageDiffScreen.tsx`: store-driven screen orchestration
- `src/packageDiff/tuiNext/releaseNotes.ts`: release notes resolution and formatting helpers

## Testing

```bash
bun run typecheck
bun test
bun run test:e2e
bun run build
```

The e2e smoke tests execute the CLI surface for `package-diff`, including help output, dependency analysis, and TUI command availability.
