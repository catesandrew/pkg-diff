# Onboarding

This repository is the migrated home for `package-diff`. The package analysis domain is preserved from the original app under `src/packageDiff/`, while the interactive TUI is being rebuilt on a more modular architecture.

## What This Project Is For

- Keep the original `package-diff` CLI behaviors working.
- Preserve the analyzers, diff calculation, changelog, config, and cache logic from the original implementation.
- Move the interactive `tui` command onto a more performant, modular architecture.

## Architecture spine

There are two important layers:

1. Top-level CLI entrypoint: `src/cli.ts`
2. Migrated domain runtime: `src/packageDiff/cli.ts` and `src/packageDiff/app.ts`
3. Legacy domain commands and services: `src/packageDiff/commands/`, `src/packageDiff/services/`, `src/packageDiff/analyzers/`
4. New TUI shell:
   - `src/packageDiff/commands/tuiCommand.tsx`
   - `src/packageDiff/tuiNext/launch.tsx`
   - `src/packageDiff/tuiNext/PackageDiffApp.tsx`
   - `src/packageDiff/tuiNext/state.tsx`
   - `src/packageDiff/tuiNext/PackageDiffScreen.tsx`

The rule is to preserve the domain logic while improving the UI architecture around it.

## Project layout

- `src/packageDiff/`: migrated package-diff domain code
- `src/packageDiff/tuiNext/`: new interactive shell
- `src/components/`, `src/hooks/`, `src/state/`, `src/ink.tsx`: shared shell infrastructure copied from the performant starter
- `tests/packageDiff/`: migrated legacy unit tests plus CLI smoke coverage
- `docs/adr/`: architecture decision records for the migration

## Development workflow

1. Change the package analysis domain under `src/packageDiff/` only when the CLI behavior itself needs to change.
2. Change the TUI behavior under `src/packageDiff/tuiNext/` when improving the interactive experience.
3. Keep the `tui` command as the boundary between the legacy analysis pipeline and the new shell.
4. Add tests before changing command behavior or UI launch wiring.
5. Update the ADRs when you change migration boundaries or replace a legacy subsystem.

## Core behaviors to preserve

- `analyse`, `between`, `check`, `config`, and `changelog` should keep their package-diff semantics.
- `tui` should keep browsing dependency changes and release notes, but on the new store-driven shell.
- The built CLI should remain smoke-testable in headless mode.

## Verification commands

Run these before handing off changes:

```bash
bun run typecheck
bun test
bun run test:e2e
bun run build
```

Useful smoke commands:

```bash
bun run src/cli.ts --help
bun run src/cli.ts analyse --format json
bun run src/cli.ts check react --quiet
bun run src/cli.ts tui --help
```

## Recommended first reads

- `src/packageDiff/cli.ts`
- `src/packageDiff/app.ts`
- `src/packageDiff/services/diffCalculator.ts`
- `src/packageDiff/commands/analyseCommand.ts`
- `src/packageDiff/commands/tuiCommand.tsx`
- `src/packageDiff/tuiNext/PackageDiffScreen.tsx`
- `docs/adr/0003-query-engine-and-smoke-tests.md`
