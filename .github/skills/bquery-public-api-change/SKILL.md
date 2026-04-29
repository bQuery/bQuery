---
name: bquery-public-api-change
description: 'Add or extend public bQuery APIs. Use when adding methods, exports, public types, module barrels, README/docs examples, tests, or src/full.ts wiring for existing modules.'
---

# bQuery Public API Change

## When to Use

Use this skill when you are changing the public surface of an existing bQuery module.

Typical triggers:

- add a new public method or function
- add or rename a public type
- expand `src/<module>/index.ts`
- update `src/index.ts` or `src/full.ts`
- adjust README or guide examples after an API change
- add tests for new public behavior

## Procedure

1. Start with the source of truth:
   - `package.json`
   - the relevant `src/<module>/index.ts`
   - nearby implementation files
   - `AGENT.md` for repo conventions
2. Prefer additive, backward-compatible changes over rewrites.
3. Keep public exports explicit and named.
4. If the change affects the package-wide runtime surface, sync:
   - `src/index.ts`
   - `src/full.ts`
   - `README.md`
   - the relevant `docs/guide/*.md`
   - `CHANGELOG.md` when the user-visible behavior changed
5. Add or update Bun tests in the matching `tests/<module>.test.ts` file.
6. Validate with the smallest relevant Bun command first, then broader checks if needed.

## Project-Specific Guardrails

- Keep strict TypeScript intact; do not weaken types to make the change compile.
- Preserve chainable return values on mutating DOM wrapper APIs.
- Keep `$()` throwing on missing elements and `$$()` non-throwing for empty matches.
- Sanitize all HTML-writing APIs through `sanitizeHtml()`.
- Avoid circular imports; dependency direction should remain `view/store/router -> reactive -> core`.
- Use named exports only.

## Files to Re-check Before Finishing

- `src/<module>/index.ts`
- `src/index.ts`
- `src/full.ts`
- `tests/<module>.test.ts`
- the most relevant guide in `docs/guide/`
- `README.md` if the public package overview changed

## Validation Hints

Prefer the smallest relevant validation command first:

- `bun test`
- `bun run lint:types`
- `bun run build`
