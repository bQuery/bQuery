# Bundle & Tree-shaking

bQuery.js is designed to keep production bundles small. This page explains the bundle topology and the rules you can rely on as a consumer.

## Zero runtime dependencies

The published `dependencies` field in `package.json` is empty. Every public API is implemented in this repository. Dev dependencies exist only for build, test, lint, and docs tooling.

This means:

- Adding bQuery does not transitively pull in other packages.
- Audit surface area is small.
- Tree-shaking depends only on bQuery's own export structure.

## Entry points

| Entry point                     | When to use                                                                                                                |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `@bquery/bquery`                | App code with a bundler. Re-exports common helpers; bundlers tree-shake unused ones.                                       |
| `@bquery/bquery/<module>`       | When you only need one module. Smallest possible footprint per bundler chunk.                                              |
| `@bquery/bquery/full`           | CDN consumers (`unpkg`, `jsdelivr`). Contains every public runtime + type export. **Not** intended for bundlers.           |

All three resolve to the **same TypeScript declarations**, so IDE features behave identically.

## Per-module sub-paths

Every module under `src/<module>/index.ts` is exposed at `@bquery/bquery/<module>`:

```
core · reactive · concurrency · component · motion · security · platform ·
router · store · view · storybook · forms · i18n · a11y · dnd · media ·
plugin · devtools · testing · ssr · server
```

When you import from a sub-path, the resulting chunk contains only that module's code plus its in-graph dependencies. This is the recommended pattern for library authors building on top of bQuery.

## `sideEffects: false`

`package.json` declares `"sideEffects": false`. Tree-shaking-aware bundlers (Vite, Rollup, esbuild, Rspack, modern webpack) will eliminate any export your app does not reference.

If you observe an import surviving tree-shaking, it is almost certainly because:

- The bundler's `sideEffects` honoring is misconfigured.
- A module-scope statement in your app references the symbol.
- You imported from `@bquery/bquery/full` instead of a sub-path.

## `forms.compose` collision

There is one exception worth knowing about: `forms.compose` is intentionally **omitted** from the root and `/full` re-exports because it would collide with `core.compose`. Import it explicitly from the forms sub-path:

```ts
import { compose } from '@bquery/bquery/forms';
```

This is enforced by `bun run check:full-bundle`.

## Pure annotations

Where it materially helps tree-shaking, source files use `/* @__PURE__ */` annotations on call expressions whose results may not be retained. New module factories should follow the same pattern.

## Audit tooling

The repository ships a static audit:

```bash
bun run check:full-bundle
```

This script reads every public module barrel and verifies that `src/full.ts` re-exports both the runtime symbols and the public types. If a new module barrel cannot be read or parsed, the audit fails — drift is treated as an error.

Adding a new public module therefore requires updating, at minimum:

- `src/<module>/index.ts`
- `package.json` exports
- `vite.config.ts` / `vite.umd.config.ts` entries
- `src/index.ts` (curated re-exports)
- `src/full.ts` (every public export)
- Module guide under `docs/guide/<module>.md`

## Browser support

The published artefacts target ES2020 with a Chrome 90+ / Firefox 90+ / Safari 15+ / Edge 90+ baseline. Anything that exceeds the baseline (e.g., `WakeLock`, `BroadcastChannel`) feature-detects and degrades gracefully.

## See also

- [Architecture](/concepts/architecture)
- [Supported Runtimes](/concepts/runtimes)
- [Contributing — Release Process](/contributing/release-process)
