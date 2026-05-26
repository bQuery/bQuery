# Agent Guide

This page is a curated, human-readable subset of [`AGENT.md`](https://github.com/bQuery/bQuery/blob/main/AGENT.md) — the deep architectural reference shared by both human contributors and AI coding agents. If you are working with an AI assistant on this codebase, point it at `AGENT.md` directly; that file is structured for fast machine consumption.

The rest of this page summarises the *conventions* that human contributors most often need to know.

## Source of truth ordering

When behaviour or exports seem inconsistent across files, trust them in order:

1. `package.json`
2. `src/<module>/index.ts` barrels
3. `AGENT.md`
4. `docs/guide/*.md`

For release deltas, also consult `CHANGELOG.md`.

## Coding patterns to preserve

- `$(selector)` returns `BQueryElement` and throws if no element matches.
- `$$(selector)` returns `BQueryCollection` and tolerates zero matches.
- Signal `.value` participates in tracking; `.peek()` reads without subscribing.
- `computed()` is read-only; `linkedSignal()` is read-write.
- `watchDebounce()` / `watchThrottle()` keep the same `(newValue, oldValue)` callback shape as `watch()`.
- Store actions mutate state through `this`, not via external state parameters — avoid arrow functions for actions, they break `this`.
- Component reactive helpers (`useSignal`, `useComputed`, `useEffect`) belong in lifecycle-safe contexts.

## Forbidden shortcuts

- No `any` without a clear justification comment.
- No `@ts-ignore` without a linked issue or explicit explanation.
- Never write `innerHTML = untrustedInput`.
- No new global mutable state outside established stores or shared runtime config.
- No new external runtime dependencies > ~5 KB gzipped without explicit approval.
- No API changes without tests and documentation.

## When using AI assistants

If you use Copilot, Cursor, Cline, or another agent on this codebase:

- The AI guidance files (`AGENT.md`, `llms.txt`, `.cursorrules`, `.clinerules`, `.github/copilot-instructions.md`) are kept in sync by `bun run check:ai-guidance`. Do not edit one without considering whether the others need to follow.
- `.github/prompts/*.prompt.md` contains workspace starter prompts for common bQuery tasks (adding a module, public API changes, SSR workflow, AI guidance sync, …). Use them as templates.

## See also

- [`AGENT.md`](https://github.com/bQuery/bQuery/blob/main/AGENT.md) — the full reference
- [`llms.txt`](https://github.com/bQuery/bQuery/blob/main/llms.txt) — compact summary
- [Contributing — Architecture](/contributing/architecture)
- [Contributing — Release Process](/contributing/release-process)
