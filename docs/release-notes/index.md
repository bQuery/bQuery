# Release Notes

Structured release notes for bQuery.js. Each minor version has its own page; older minors live in the [CHANGELOG](https://github.com/bQuery/bQuery/blob/main/CHANGELOG.md).

The library follows [Semantic Versioning](https://semver.org/). The [Stability matrix](/introduction#stability-matrix) lists which modules are stable, beta, or experimental; the canonical source of truth (with per-module status history) is [`STABILITY.md`](https://github.com/bQuery/bQuery/blob/main/STABILITY.md).

## Versions

| Version                         | Date                    | Highlights                                                                                                                                                                                                                                                                  |
| ------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [1.16.0](/release-notes/1.16)   | 2026-08-11              | Quality-and-performance release: batching spans transitive updates, computeds notify only on real value changes, hot-path allocation cuts across reactive/DOM/view, `undelegate()` leak and `bq-model` caret fixes, `watchThrottle` `trailing` option. No breaking changes. |
| [1.15.1](/release-notes/1.15.1) | 2026-07-06              | Security-and-correctness patch: XSS hardening across HTML sinks, evaluator code-execution paths closed, Trusted Types wired in (`trustedHtmlForSink`), secure-by-default cookies, reactive robustness fixes. No breaking changes.                                           |
| [1.15.0](/release-notes/1.15)   | 2026-06-30              | Thirteen modules graduate to **Stable** (every module is now Stable); view transitions + optional compiler, forms actions + `optimistic`, i18n ICU + extraction, opt-in file-based routing, devtools bridge + reference extension.                                          |
| 1.14.2                          | 2026-06-26              | Patch: dev-dependency maintenance (TypeScript-ESLint, ESLint, Vite, Bun 1.3.14); Dependabot added. No public API changes.                                                                                                                                                   |
| [1.14.1](/release-notes/1.14)   | 2026-05-28              | Patch: motion `prefersReducedMotion` / `reducedMotionSignal` refresh stale media-query cache on `matchMedia` change.                                                                                                                                                        |
| [1.14.0](/release-notes/1.14)   | 2026-05-26              | `media`, `plugin`, `devtools`, `testing` graduate into batteries-included tiers; additive expansions across router, view, a11y, i18n, dnd, storybook, concurrency, ssr, server.                                                                                             |
| 1.13.0                          | 2026-05-21              | Forms / component / motion / core-utils baseline expansion. See [CHANGELOG](https://github.com/bQuery/bQuery/blob/main/CHANGELOG.md#1130---2026-05-21).                                                                                                                     |
| 1.12.0                          | 2026-05-16              | `unregisterPlugin`, `clearPlugins`, `WebSocketSendData` public type, `/full` bundle type-export drift coverage.                                                                                                                                                             |
| 1.11.x                          | 2026-04-30 / 2026-05-12 | SSR / server runtime: `createServer`, `renderToStringAsync`, `renderToStream`, `renderToResponse`, runtime-agnostic WebSocket sessions.                                                                                                                                     |
| 1.10.0                          | 2026-04-15              | Concurrency module additions.                                                                                                                                                                                                                                               |
| 1.9.0                           | 2026-04-05              | Watcher / view / media APIs.                                                                                                                                                                                                                                                |
| earlier                         | see CHANGELOG           | Full history in [CHANGELOG.md](https://github.com/bQuery/bQuery/blob/main/CHANGELOG.md).                                                                                                                                                                                    |

## How to read these notes

Each per-version page is organized by:

1. **Headlines** — the main story of the release.
2. **Added / Changed / Fixed** — the structured CHANGELOG sections.
3. **Migration notes** — anything you need to do to upgrade from the previous minor.
4. **Links** — to the module guides that document the new surface.

## Deprecation policy

- **Stable** modules: deprecations are flagged at least one minor before removal.
- **Beta** modules: deprecations may be flagged in the same minor that removes them; an upgrade path is always documented.
- **Experimental** modules: APIs may change between minors without prior deprecation.

See [Contributing — Release Process](/contributing/release-process) for the contributor view.
