# Bundle & Tree-shaking

bQuery.js is designed to keep production bundles small. This page explains the bundle topology and the rules you can rely on as a consumer.

## Zero runtime dependencies

The published `dependencies` field in `package.json` is empty. Every public API is implemented in this repository. Dev dependencies exist only for build, test, lint, and docs tooling.

This means:

- Adding bQuery does not transitively pull in other packages.
- Audit surface area is small.
- Tree-shaking depends only on bQuery's own export structure.

## Entry points

| Entry point               | When to use                                                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `@bquery/bquery`          | App code with a bundler. Re-exports common helpers; bundlers tree-shake unused ones.                             |
| `@bquery/bquery/<module>` | When you only need one module. Smallest possible footprint per bundler chunk.                                    |
| `@bquery/bquery/full`     | CDN consumers (`unpkg`, `jsdelivr`). Contains every public runtime + type export. **Not** intended for bundlers. |

All three resolve to the **same TypeScript declarations**, so IDE features behave identically.

## Per-module sub-paths

Every module under `src/<module>/index.ts` is exposed at `@bquery/bquery/<module>`:

```
core · reactive · concurrency · component · motion · security · platform ·
router · store · view · storybook · forms · i18n · a11y · dnd · media ·
plugin · devtools · testing · ssr · server
```

When you import from a sub-path, the resulting chunk contains only that module's code plus its in-graph dependencies. This is the recommended pattern for library authors building on top of bQuery.

## Size per entry point

Every number below is the **transitive** cost of importing everything an entry
point exports: the entry is bundled standalone with esbuild (minified,
tree-shaken, Node built-ins external) and the result gzipped. This is
deliberately not the per-file size the build log prints — an ESM entry
re-exports shared chunks, so `core.es.mjs` reads as 3.3 kB on disk while
actually pulling in 16.1 kB gzipped.

Treat these as ceilings. A real app imports a handful of symbols, not an
entire module, so tree-shaking brings it in under the figure shown.

| Entry point                    | Minified | Minified + gzip | Budget   |
| ------------------------------ | -------- | --------------- | -------- |
| `@bquery/bquery`               | 429.9 kB | **141.0 kB**    | 144.0 kB |
| `@bquery/bquery/full`          | 433.2 kB | **142.3 kB**    | 145.3 kB |
| `@bquery/bquery/core`          | 45.6 kB  | **16.1 kB**     | 18.2 kB  |
| `@bquery/bquery/reactive`      | 35.9 kB  | **12.4 kB**     | 13.1 kB  |
| `@bquery/bquery/concurrency`   | 30.8 kB  | **9.6 kB**      | 10.8 kB  |
| `@bquery/bquery/component`     | 46.5 kB  | **16.6 kB**     | 16.8 kB  |
| `@bquery/bquery/motion`        | 30.3 kB  | **11.1 kB**     | 12.3 kB  |
| `@bquery/bquery/security`      | 15.3 kB  | **6.5 kB**      | 7.4 kB   |
| `@bquery/bquery/platform`      | 11.3 kB  | **4.2 kB**      | 4.4 kB   |
| `@bquery/bquery/router`        | 26.3 kB  | **9.5 kB**      | 10.3 kB  |
| `@bquery/bquery/store`         | 12.5 kB  | **4.5 kB**      | 5.0 kB   |
| `@bquery/bquery/view`          | 47.4 kB  | **18.4 kB**     | 19.7 kB  |
| `@bquery/bquery/view/compiler` | 12.4 kB  | **5.0 kB**      | 5.6 kB   |
| `@bquery/bquery/storybook`     | 18.2 kB  | **7.6 kB**      | 8.4 kB   |
| `@bquery/bquery/forms`         | 31.3 kB  | **11.0 kB**     | 11.3 kB  |
| `@bquery/bquery/i18n`          | 11.7 kB  | **4.5 kB**      | 4.7 kB   |
| `@bquery/bquery/i18n/extract`  | 5.6 kB   | **2.4 kB**      | 2.8 kB   |
| `@bquery/bquery/a11y`          | 18.3 kB  | **6.4 kB**      | 6.8 kB   |
| `@bquery/bquery/dnd`           | 15.7 kB  | **5.8 kB**      | 6.3 kB   |
| `@bquery/bquery/media`         | 23.5 kB  | **6.8 kB**      | 7.2 kB   |
| `@bquery/bquery/plugin`        | 6.4 kB   | **2.3 kB**      | 2.6 kB   |
| `@bquery/bquery/devtools`      | 7.1 kB   | **3.0 kB**      | 3.5 kB   |
| `@bquery/bquery/testing`       | 23.4 kB  | **8.7 kB**      | 9.4 kB   |
| `@bquery/bquery/ssr`           | 113.5 kB | **39.1 kB**     | 39.2 kB  |
| `@bquery/bquery/server`        | 119.3 kB | **41.5 kB**     | 41.5 kB  |

`bun run check:size` enforces the budget column and runs in CI, so a
regression fails the build rather than showing up on Bundlephobia weeks later.
Budgets live in `scripts/bundle-budgets.mjs` and sit a uniform 15% above the
measured size; a change that legitimately grows an entry raises its budget in
the same PR. Regenerate the table above with
`bun run check:size -- --table`.

**Note the root entry.** `@bquery/bquery` is only marginally smaller than
`/full` when you import all of it — it re-exports the common helpers of every
module. It is cheap in practice only because bundlers tree-shake it. If you
want a guaranteed-small footprint, import from a sub-path.

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
