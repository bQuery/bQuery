---
name: 'bQuery: Public API Change'
description: 'Use when adding or extending a public bQuery API so exports, types, docs, tests, and bundle wiring stay in sync.'
argument-hint: 'Describe the public API change'
agent: 'agent'
---

Implement the requested public API change for bQuery.js and keep the public surface coherent.

Start by checking:

- [package.json](../../package.json) for exports and scripts
- [AGENT.md](../../AGENT.md) for workflow and invariants
- The relevant `src/<module>/index.ts` barrel plus nearby implementation
- [`src/full.ts`](../../src/full.ts) if runtime exports may change

Workflow:

1. Prefer additive, backward-compatible changes over rewrites.
2. Update public types and JSDoc first when they clarify the shape of the API.
3. Keep named exports explicit and minimal.
4. Add tests for happy paths, edge cases, misuse, and integration behavior where relevant.
5. Update the most relevant docs page, plus broader docs like `README.md` or `CHANGELOG.md` when the change is notable.
6. If the public runtime export surface changes, sync `src/full.ts` and any relevant guidance files.

Repository-specific reminders:

- Chainable DOM mutations should return `this`.
- HTML-writing APIs must sanitize untrusted content.
- Avoid new runtime dependencies.
- Use the smallest relevant Bun validation command first, then broaden as needed.
