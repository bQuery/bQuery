---
name: 'bQuery: SSR / Server Workflow'
description: 'Use when changing @bquery/bquery/ssr or @bquery/bquery/server so runtime-agnostic behavior, tests, docs, and examples stay aligned.'
argument-hint: 'Describe the SSR or server change'
agent: 'agent'
---

Work on the requested SSR or server task in bQuery.js with special care for runtime-agnostic behavior.

Start by reviewing:

- [`src/ssr/index.ts`](../../src/ssr/index.ts)
- [`src/server/index.ts`](../../src/server/index.ts)
- [`tests/ssr.test.ts`](../../tests/ssr.test.ts), [`tests/ssr-runtime.test.ts`](../../tests/ssr-runtime.test.ts), [`tests/ssr-followup.test.ts`](../../tests/ssr-followup.test.ts), and [`tests/server.test.ts`](../../tests/server.test.ts)
- [`docs/guide/ssr.md`](../../docs/guide/ssr.md) and [`docs/guide/server.md`](../../docs/guide/server.md)
- The runnable examples under [`examples/`](../../examples/)

Workflow:

1. Confirm the intended public surface in the module barrels before editing internals.
2. Preserve runtime-agnostic Request/Response behavior across Node.js, Bun, and Deno where applicable.
3. Keep streaming, DOM-free fallback rendering, runtime adapters, and WebSocket session helpers coherent.
4. Add or update tests for happy paths, edge cases, and cross-runtime behavior.
5. Update guides and examples when the public behavior or recommended workflow changes.
6. Validate with the smallest relevant Bun command first, then broader checks as needed.

If the task changes public exports or release-facing guidance, also sync the relevant AI guidance files and finish with `bun run check:ai-guidance`.
