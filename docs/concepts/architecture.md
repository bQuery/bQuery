# Architecture

This page describes the high-level structure of bQuery.js: how modules layer, how data flows, and what guarantees each layer makes. Use it as your map of the codebase before diving into specific module guides.

## Layering

bQuery is organized as a strict dependency hierarchy. The rule is:

```
            view · store · router · forms · …  (high-level)
                            │
                            ▼
                        reactive                (mid-level)
                            │
                            ▼
                          core                  (low-level)
```

- **`core`** is the foundation. It exposes the `$` / `$$` wrappers, traversal, events, and runtime-agnostic utilities. It must never import from higher layers.
- **`reactive`** depends only on `core`. It implements signals, computeds, effects, scopes, batching, and the async / HTTP / realtime data layer.
- **High-level modules** (`view`, `store`, `router`, `forms`, `i18n`, `a11y`, `dnd`, `media`, `plugin`, `devtools`, `testing`, `motion`, `component`, `security`, `platform`, `concurrency`, `ssr`, `server`, `storybook`) depend on `reactive` and `core`. They may also depend on a small, well-defined set of sibling modules — but never circularly.

This layering is enforced at review time and reflected in the directory structure under `src/`. If a change requires `core` to import from a higher layer, that is a design smell — restructure instead.

## Module map

The framework ships **23 public modules**. Each one has its own entry point in `package.json` and its own `src/<module>/index.ts` barrel.

| Layer         | Module        | Responsibility                                                                        |
| ------------- | ------------- | ------------------------------------------------------------------------------------- |
| Foundation    | `core`        | `$`, `$$`, DOM wrappers, traversal, events, utilities                                 |
| Foundation    | `reactive`    | signals, computed, effects, scopes, watch, HTTP, polling, WebSocket/SSE, REST, queues |
| Foundation    | `concurrency` | worker tasks, RPC, pools, reactive metrics                                            |
| UI            | `component`   | Web Components, props, slots, refs, lifecycle                                         |
| UI            | `view`        | declarative `bq-*` directives                                                         |
| UI            | `motion`      | transitions, FLIP, springs, tweens, timelines                                         |
| UI            | `storybook`   | safe story helpers                                                                    |
| State         | `store`       | signal-based state + persistence                                                      |
| State         | `forms`       | reactive form state, validation, schema                                               |
| Navigation    | `router`      | SPA routing, guards, navigation results                                               |
| Cross-cut     | `security`    | sanitization, Trusted Types                                                           |
| Cross-cut     | `platform`    | storage, cache, cookies, page meta                                                    |
| Cross-cut     | `i18n`        | locale negotiation, Intl, pluralization                                               |
| Cross-cut     | `a11y`        | focus, live regions, audits, prefs                                                    |
| Cross-cut     | `dnd`         | draggable, droppable, sortable                                                        |
| Cross-cut     | `media`       | viewport, network, clipboard, prefs                                                   |
| Extensibility | `plugin`      | hooks, DI, namespaced directives                                                      |
| Tooling       | `devtools`    | timeline, diffs, traces, snapshots                                                    |
| Tooling       | `testing`     | screen, userEvent, mocks, async helpers                                               |
| Server        | `ssr`         | runtime-agnostic rendering, streaming, hydration, resumability                        |
| Server        | `server`      | dependency-free routing, SSR responses, WebSocket sessions                            |
| Entry         | (root)        | curated re-exports of common helpers                                                  |
| Entry         | `full`        | every public runtime + type export, intended for CDN consumers                        |

## Entry points

There are two convenience entry points alongside the per-module sub-paths:

- **`@bquery/bquery`** — the root entry. Re-exports the most commonly used helpers from across modules. Tree-shakeable in modern bundlers. See `src/index.ts`.
- **`@bquery/bquery/full`** — every public runtime export plus every public type. Designed for CDN usage (`unpkg`, `jsdelivr`) where sub-path resolution is impractical. See `src/full.ts` and the [Bundle & Tree-shaking](/concepts/bundle-and-tree-shaking) page.

A repo-local audit, `bun run check:full-bundle`, statically verifies that `src/full.ts` stays in sync with every module barrel.

## Data flow

A typical interactive bQuery app looks like this end-to-end:

```
 ┌────────┐  user event  ┌─────────────┐  signal write  ┌──────────┐
 │  DOM   │ ───────────▶ │  handler/   │ ─────────────▶ │  signal  │
 │ event  │              │  store      │                │ / store  │
 └────────┘              └─────────────┘                └────┬─────┘
                                                             │ notify
                                                             ▼
                                                       ┌──────────┐
                                                       │ effects, │
                                                       │ computeds│
                                                       └────┬─────┘
                                                            │ update
                                                            ▼
                                                       ┌──────────┐
                                                       │   DOM    │
                                                       │ bindings │
                                                       └──────────┘
```

Server-rendered apps add an SSR pass that produces HTML + a serialized state snapshot, which the client hydrates by re-reading the same signals. See [Rendering Modes](/concepts/rendering-modes).

## Guarantees and constraints

bQuery makes — and depends on — a handful of architectural guarantees:

1. **No circular imports.** `core` is a leaf; `reactive` only imports from `core`; higher modules only import from `reactive` / `core` / siblings.
2. **No runtime dependencies.** The published `dependencies` block is empty. Dev dependencies are only used at build / test / docs time.
3. **Strict TypeScript.** `tsconfig.json` keeps strict mode on. Public APIs are typed without `any`-escape hatches.
4. **Sanitize by default.** HTML-writing APIs sanitize untrusted input. Explicit raw escape hatches exist (e.g., `.raw.innerHTML`) for trusted content.
5. **Browser baseline.** Chrome 90+, Firefox 90+, Safari 15+, Edge 90+. APIs that exceed the baseline (e.g., `WakeLock`) feature-detect and degrade gracefully.

## See also

- [Reactivity Model](/concepts/reactivity-model)
- [Rendering Modes](/concepts/rendering-modes)
- [Security Model](/concepts/security-model)
- [Bundle & Tree-shaking](/concepts/bundle-and-tree-shaking)
- [Supported Runtimes](/concepts/runtimes)
- [Contributing — Architecture](/contributing/architecture)
