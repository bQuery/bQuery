---
name: bquery-ssr-server-workflow
description: 'Implement or review @bquery/bquery/ssr and @bquery/bquery/server changes. Use for createServer, renderToStringAsync, renderToResponse, runtime adapters, WebSocket routing, DOM-free SSR, cross-runtime examples, or SSR/server tests and docs.'
---

# bQuery SSR and Server Workflow

## When to Use

Use this skill for changes in `src/ssr/**` or `src/server/**`, or for docs/tests/examples that depend on those modules.

Typical triggers:

- `createServer()` changes
- `renderToStringAsync()`, `renderToStream()`, or `renderToResponse()` changes
- runtime adapter work for Bun, Deno, or Node.js
- WebSocket routing or session handling
- SSR hydration, snapshots, loaders, or resumability
- fixes in `docs/guide/ssr.md`, `docs/guide/server.md`, or `examples/ssr-*`

## Procedure

1. Read the canonical public barrels first:
   - `src/ssr/index.ts`
   - `src/server/index.ts`
   - `src/index.ts`
   - `src/full.ts`
2. Inspect the nearby implementation before editing behavior.
3. Preserve runtime-agnostic behavior across Node.js >= 24, Bun >= 1.3.13, and Deno unless the task explicitly changes support.
4. Update tests together with the implementation:
   - `tests/ssr.test.ts`
   - `tests/ssr-runtime.test.ts`
   - `tests/ssr-followup.test.ts`
   - `tests/server.test.ts`
   - `tests/cross-runtime/**` when cross-runtime behavior changes
5. Sync the matching docs and examples:
   - `docs/guide/ssr.md`
   - `docs/guide/server.md`
   - `examples/README.md`
   - `examples/shared/app.ts`
   - `README.md` when public usage changes
6. Validate with the smallest SSR/server-specific Bun command available, then broader validation if needed.

## Project-Specific Guardrails

- `renderToString()` automatically falls back to the DOM-free renderer when `DOMParser` is unavailable.
- `ctx.render()` inherits the SSR renderer behavior.
- `ctx.html()` sanitization still relies on DOM-compatible globals unless trusted HTML is explicitly used.
- Do not add heavyweight runtime dependencies for SSR or server helpers.
- Keep security defaults intact; never weaken sanitization just to simplify a test or example.

## Files to Re-check Before Finishing

- `src/ssr/index.ts`
- `src/server/index.ts`
- relevant implementation files under `src/ssr/` or `src/server/`
- `docs/guide/ssr.md`
- `docs/guide/server.md`
- `examples/README.md`
- `tests/server.test.ts` and the relevant SSR tests

## Validation Hints

Prefer targeted validation first, then broader checks:

- `bun test`
- `bun run build`
- `bun run build:docs`
