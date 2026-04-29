---
name: 'bQuery: Add Module'
description: 'Use when adding a new bQuery module or entry point so implementation, exports, docs, builds, and tests are wired end to end.'
argument-hint: 'Describe the module or entry point to add'
agent: 'agent'
---

Add the requested bQuery module or public entry point as a complete repository change, not just a source folder.

Start with:

- [AGENT.md](../../AGENT.md)
- [package.json](../../package.json)
- [`src/index.ts`](../../src/index.ts)
- [`src/full.ts`](../../src/full.ts)
- [`vite.config.ts`](../../vite.config.ts) and [`vite.umd.config.ts`](../../vite.umd.config.ts)

Checklist:

1. Create `src/<module>/` with explicit public exports in `index.ts`.
2. Wire the module into `package.json` exports and any required build entries.
3. Update `src/index.ts` and `src/full.ts` so the main entry and `/full` bundle stay accurate.
4. Add tests under [`tests/`](../../tests/) and docs under [`docs/guide/`](../../docs/guide/).
5. Update higher-level guidance such as `README.md`, `AGENT.md`, or `CHANGELOG.md` when the new module is public-facing.
6. Validate with the smallest useful Bun command first, then run broader build/test checks as needed.

Keep the new module aligned with repo standards: strict TypeScript, zero runtime dependencies, named exports, English docs/comments, and no circular import surprises.
