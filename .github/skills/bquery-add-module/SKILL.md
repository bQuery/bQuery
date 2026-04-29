---
name: bquery-add-module
description: 'Add a new public bQuery module or entry point. Use when creating src/<module>, package.json exports, vite build entries, src/index.ts, src/full.ts, tests, docs, README, labeler coverage, and release notes for a new module.'
---

# Add a New bQuery Module

## When to Use

Use this skill when the task introduces a brand-new public module or package entry point.

Typical triggers:

- create `src/<module>/`
- add `package.json` exports
- update Vite library build entry points
- wire the module into `src/index.ts` and `src/full.ts`
- add a new guide page, tests, and README references
- add or update labeler coverage for the new module

## Procedure

1. Create the module directory under `src/<module>/` with an explicit `index.ts` barrel.
2. Add the new public entry point to `package.json` exports.
3. Update build entry definitions in `vite.config.ts` and any related build config.
4. Sync top-level exports:
   - `src/index.ts`
   - `src/full.ts`
5. Add tests in `tests/<module>.test.ts`.
6. Add or update docs:
   - the most relevant page under `docs/guide/`
   - `README.md`
   - `CHANGELOG.md`
7. Update repo support files if needed:
   - `.github/labeler.yml`
   - `AGENT.md`
   - `llms.txt`
   - `.github/copilot-instructions.md`
   - `.cursorrules`
   - `.clinerules`
8. Validate the module with Bun commands before finishing.

## Project-Specific Guardrails

- Keep the new module zero-runtime-dependency unless the task explicitly authorizes otherwise.
- Use named exports only.
- Keep file names in `kebab-case`.
- Public APIs should carry JSDoc and examples where helpful.
- If the module changes public runtime exports, remember that `src/full.ts` must stay aligned.

## Files to Re-check Before Finishing

- `package.json`
- `vite.config.ts`
- `vite.umd.config.ts` when relevant
- `src/index.ts`
- `src/full.ts`
- `tests/<module>.test.ts`
- `docs/guide/*.md`
- `.github/labeler.yml`

## Validation Hints

For a new public module, broader validation is usually appropriate:

- `bun test`
- `bun run build`
- `bun run build:docs`
