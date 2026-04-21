# ADR 0001: Use The Starter Shell As The Migration Base

## Status

Accepted

## Context

`package-diff` already existed elsewhere, but the target repository at `pkg-diff` started effectively empty. We needed a fast path to a buildable TUI architecture without rewriting the shell from scratch before migrating the real domain logic.

## Decision

Seed `pkg-diff` by copying the standalone performant shell from `mock-tui-platform`, then migrate the real `package-diff` domain into that shell.

## Consequences

- The migration gained a working architecture immediately.
- The copied shell had to be rewritten so the repo reads as `package-diff` rather than the generic starter.
- Shared shell code remains available, but only insofar as it serves the package-diff product.
