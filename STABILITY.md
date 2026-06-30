# Stability Matrix

**This file is the single source of truth for bQuery module maturity.** The
[README status table](README.md#modules-at-a-glance), the docs site
[Stability matrix](https://bquery.js.org/introduction#stability-matrix), and the
machine-readable data in [`scripts/stability-matrix.mjs`](scripts/stability-matrix.mjs)
are all validated against it by `bun run check:stability`, so the surfaces cannot
silently drift apart.

bQuery follows [Semantic Versioning](https://semver.org/):

- **Stable** modules introduce **no breaking changes between minor releases**.
- **Beta** modules may change, but breaking changes are flagged in the
  [Release Notes](https://bquery.js.org/release-notes/); an upgrade path is always
  documented.
- **Experimental** modules may change between minors without prior deprecation.

When a module changes status, update the table below **and**
[`scripts/stability-matrix.mjs`](scripts/stability-matrix.mjs), append a line to
its history, and run `bun run check:stability`.

## Matrix

| Module        | Status | Targeting Stable | Notes                                                                             |
| ------------- | ------ | ---------------- | --------------------------------------------------------------------------------- |
| `core`        | Stable | —                | Selectors, DOM ops, events, typed utilities.                                      |
| `reactive`    | Stable | —                | Signals, computed, effects, async data, HTTP/WS/SSE.                              |
| `security`    | Stable | —                | Sanitizer, Trusted Types, CSP helpers.                                            |
| `component`   | Stable | —                | Typed Web Components with scoped reactivity.                                      |
| `motion`      | Stable | —                | View transitions, FLIP, springs, timelines.                                       |
| `platform`    | Stable | —                | Storage, cache, cookies, announcers, runtime config.                              |
| `router`      | Stable | —                | SPA routing, guards, `useRoute()`, `<bq-link>`, file-route convention.            |
| `store`       | Stable | —                | Signal-based state, persistence, migrations, plugins.                             |
| `view`        | Stable | —                | Directive set + grammar frozen; transitions + optional compiler.                  |
| `forms`       | Stable | —                | Batteries-included surface; progressive-enhancement actions + optimistic updates. |
| `i18n`        | Stable | —                | Formatting/locale surface; ICU MessageFormat; extraction tooling.                 |
| `a11y`        | Stable | —                | Focus/live-regions/audit; each finding maps to a WCAG criterion.                  |
| `dnd`         | Stable | —                | Keyboard model hardened; accessibility statement.                                 |
| `media`       | Stable | —                | Composable surface; SSR-safe defaults documented and verified.                    |
| `plugin`      | Stable | —                | Hook-bus / DI / lifecycle; install/uninstall symmetry proven.                     |
| `devtools`    | Stable | —                | Versioned bridge protocol + reference extension.                                  |
| `testing`     | Stable | —                | Testing-Library-parity surface; runner integration documented.                    |
| `storybook`   | Stable | —                | Helper surface; `unsafeHtml` security contract pinned.                            |
| `concurrency` | Stable | —                | CSP-safe module workers; client UI-scheduling primitives.                         |
| `ssr`         | Stable | —                | Directive parity, resumability, production hydration.                             |
| `server`      | Stable | —                | Sessions, CSRF, guards, auth; `ctx`/`app` contract frozen.                        |

> "Targeting Stable" means the module's public surface is frozen for one minor
> cycle ahead of graduation; see each module guide for its exit-criteria
> checklist. As of **1.15.0** the matrix has no Beta or Experimental members —
> the release graduated the final thirteen modules to Stable (see the history
> below and the [1.15.0 Release Notes](https://bquery.js.org/release-notes/1.15)).

## Per-module status history

Each release records module status transitions and any flagged breaking changes
here, so the road-to-stable is auditable. Format mirrors the
[CHANGELOG](CHANGELOG.md) "Module status" sections.

- **`router`**
  - **1.15.0** — Additive opt-in file-route convention (typed `load` / `action`,
    `createFileRoutes`) bridging `router` / `ssr` / `server` ([#149]). No breaking
    changes; `router` remains **Stable**.
  - Stable since the early public releases (programmatic SPA routing).
- **`view`** — Beta → **Stable in 1.15.0**; directive set and expression grammar
  frozen, declarative transitions + optional compiler shipped ([#136], [#137], [#138]).
- **`forms`** — Beta → **Stable in 1.15.0**; batteries-included surface frozen,
  progressive-enhancement actions + optimistic updates added ([#139], [#140]).
- **`i18n`** — Beta → **Stable in 1.15.0**; formatting/locale surface frozen, ICU
  MessageFormat coverage documented, extraction tooling added ([#141]).
- **`a11y`** — Beta → **Stable in 1.15.0**; surface frozen, audit WCAG scope
  documented (`auditRules`, per-finding `wcag`) ([#142]).
- **`dnd`** — Beta → **Stable in 1.15.0**; surface frozen, keyboard model hardened,
  accessibility statement published ([#143]).
- **`media`** — graduated into batteries-included tier (1.14.0); Beta → **Stable in
  1.15.0**; composable surface frozen and verified ([#144]).
- **`plugin`** — graduated into batteries-included tier (1.14.0); Beta → **Stable in
  1.15.0**; install/uninstall symmetry proven, `definePlugin()` added ([#145]).
- **`devtools`** — graduated into batteries-included tier (1.14.0); Beta → **Stable
  in 1.15.0**; versioned bridge protocol + reference extension ([#146]).
- **`testing`** — graduated into batteries-included tier (1.14.0); Beta → **Stable
  in 1.15.0**; runner integration documented ([#147]).
- **`storybook`** — Beta → **Stable in 1.15.0**; `unsafeHtml` security contract
  pinned ([#148]).
- **`concurrency`** — Experimental → **Stable in 1.15.0**; CSP-safe module workers
  remove the mandatory `'unsafe-eval'`, client UI-scheduling primitives added
  ([#133], [#134], [#135]).
- **`ssr`** — Experimental → **Stable in 1.15.0**; directive parity, resumability,
  and production hydration resolved; surface frozen ([#127], [#128], [#129], [#130]).
- **`server`** — Experimental → **Stable in 1.15.0**; first-party
  sessions/CSRF/guards/auth resolved; `ctx`/`app` contract frozen ([#131], [#132]).

[#127]: https://github.com/bQuery/bQuery/issues/127
[#128]: https://github.com/bQuery/bQuery/issues/128
[#129]: https://github.com/bQuery/bQuery/issues/129
[#130]: https://github.com/bQuery/bQuery/issues/130
[#131]: https://github.com/bQuery/bQuery/issues/131
[#132]: https://github.com/bQuery/bQuery/issues/132
[#133]: https://github.com/bQuery/bQuery/issues/133
[#134]: https://github.com/bQuery/bQuery/issues/134
[#135]: https://github.com/bQuery/bQuery/issues/135
[#136]: https://github.com/bQuery/bQuery/issues/136
[#137]: https://github.com/bQuery/bQuery/issues/137
[#138]: https://github.com/bQuery/bQuery/issues/138
[#139]: https://github.com/bQuery/bQuery/issues/139
[#140]: https://github.com/bQuery/bQuery/issues/140
[#141]: https://github.com/bQuery/bQuery/issues/141
[#142]: https://github.com/bQuery/bQuery/issues/142
[#143]: https://github.com/bQuery/bQuery/issues/143
[#144]: https://github.com/bQuery/bQuery/issues/144
[#145]: https://github.com/bQuery/bQuery/issues/145
[#146]: https://github.com/bQuery/bQuery/issues/146
[#147]: https://github.com/bQuery/bQuery/issues/147
[#148]: https://github.com/bQuery/bQuery/issues/148
[#149]: https://github.com/bQuery/bQuery/issues/149
