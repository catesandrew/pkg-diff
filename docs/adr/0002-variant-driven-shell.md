# ADR 0002: Preserve The Legacy Domain As A Subtree

## Status

Accepted

## Context

The original `package-diff` codebase contains a substantial amount of working package-analysis logic and tests. Rewriting that logic directly into the new shell would have been slower and riskier than preserving it as-is.

## Decision

Copy the original app into `src/packageDiff/` as a self-contained domain subtree, then bridge the new shell around it instead of flattening or retyping the domain logic.

## Consequences

- The old commands, analyzers, and tests remain mostly intact.
- The migration boundary is obvious: package analysis domain vs. new TUI shell.
- Future refactors can gradually extract more shared abstractions if needed.
