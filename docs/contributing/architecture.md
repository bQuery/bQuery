# Architecture (Contributing)

Companion to the user-facing [Architecture](/concepts/architecture) page. This page focuses on the rules contributors must follow to keep the codebase healthy.

## The dependency direction rule

```
view · store · router · forms · …  →  reactive  →  core
```

- **`core`** must not import from any other module in `src/`.
- **`reactive`** must not import from any module higher than itself.
- **Higher modules** may import from `reactive`, `core`, and explicitly approved sibling modules.

If a change appears to require an upward import, the design is wrong. Restructure the change so the data flows in the legal direction, or open an issue to discuss the layering exception.

## Module addition checklist

Adding a new public module is a non-trivial change. The full checklist (also enforced by `check:full-bundle`):

1. Create `src/<module>/index.ts` with explicit named exports.
2. Add the entry to `package.json` `exports`.
3. Add Vite build entries (`vite.config.ts` and `vite.umd.config.ts`).
4. Re-export the most commonly used names from `src/index.ts`.
5. Re-export every public runtime + type from `src/full.ts`.
6. Add tests under `tests/<module>*.test.ts`.
7. Add a module guide at `docs/guide/<module>.md` and add it to the sidebar in `docs/.vitepress/config.ts`.
8. Add the module to the AI guidance surfaces: `AGENT.md`, `llms.txt`, `.cursorrules`, `.clinerules`, `README.md`.
9. Add release notes — either a new section in the in-progress release or `docs/release-notes/<version>.md`.
10. Verify: `bun run lint`, `bun run build`, `bun test`, `bun run check:full-bundle`, `bun run check:ai-guidance`.

## Public API change checklist

For a change to an existing public API:

1. Update the module barrel (`src/<module>/index.ts`).
2. Update tests — both happy path and edge cases.
3. Update `docs/guide/<module>.md`.
4. Update `src/full.ts` if a new symbol or type was added.
5. Update the relevant version section in `CHANGELOG.md`.
6. Run `bun run lint`, `bun test`, `bun run check:full-bundle`.

## Coding conventions

- **Strict TypeScript** — no weakening type safety, no unjustified `any`, no `@ts-ignore` without an explicit explanation.
- **Naming** — file names `kebab-case`, classes `PascalCase`, functions and variables `camelCase`.
- **Exports** — named exports only.
- **Chaining** — mutating DOM wrappers return `this`.
- **JSDoc** — public APIs have JSDoc with `@example` where helpful; non-public helpers are marked `@internal`.
- **English** — code, comments, docs, and commit messages are in English.

## Security discipline

See [Security Model](/concepts/security-model) for the user-facing summary. Contributor rules:

- HTML-writing APIs must sanitize untrusted input.
- Do not introduce new uses of `eval` or `new Function()` outside the documented `view` and `concurrency` exceptions.
- Cookie / header inputs must be validated against header-safe characters before being emitted.
- Form serialisation helpers throw on invalid IDs (`[A-Za-z0-9_-]+`) — do not silently normalise.

## Bundle discipline

- Zero runtime dependencies. Period.
- Add `/* @__PURE__ */` on call expressions whose results may not be retained, when it materially helps tree-shaking.
- Avoid module-scope side effects.
- New dependencies > ~5 KB gzipped require explicit approval.

## See also

- [Architecture](/concepts/architecture) (user-facing)
- [Bundle & Tree-shaking](/concepts/bundle-and-tree-shaking)
- [Release Process](/contributing/release-process)
- [Testing Strategy](/contributing/testing-strategy)
