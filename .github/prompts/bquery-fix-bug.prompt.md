---
name: 'bQuery: Fix Bug'
description: 'Use when fixing a bug or regression in bQuery.js so the agent reproduces it, respects module invariants, and validates the fix.'
argument-hint: 'Describe the bug, failing behavior, or regression'
agent: 'agent'
---

Fix the reported bug in bQuery.js using the repository workflow rather than a one-off patch.

Start with:

- [AGENT.md](../../AGENT.md)
- [package.json](../../package.json)
- The relevant `src/<module>/index.ts` barrel and nearby implementation
- The matching test file under [`tests/`](../../tests/)

Workflow:

1. Reproduce the bug with a failing or tightly scoped test first whenever practical.
2. Identify the root cause before editing code.
3. Preserve bQuery conventions such as sanitization for HTML writes, chainable DOM APIs, strict types, and additive changes.
4. Add or update tests for the bug, edge cases, and regression coverage.
5. Update docs only if public behavior, examples, or usage guidance changed.
6. Validate with the smallest relevant Bun command first, then broaden only as needed.

Pay extra attention to common bQuery footguns when relevant:

- `$()` throws, `$$()` does not.
- Signal `.value` tracks, `.peek()` does not.
- `computed()` is read-only; `linkedSignal()` is read-write.
- SSR and server behavior should stay runtime-agnostic across Node, Bun, and Deno where applicable.
