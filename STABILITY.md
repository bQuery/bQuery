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

| Module | Status | Targeting Stable | Notes |
| --- | --- | --- | --- |
| `core` | Stable | — | Selectors, DOM ops, events, typed utilities. |
| `reactive` | Stable | — | Signals, computed, effects, async data, HTTP/WS/SSE. |
| `security` | Stable | — | Sanitizer, Trusted Types, CSP helpers. |
| `component` | Stable | — | Typed Web Components with scoped reactivity. |
| `motion` | Stable | — | View transitions, FLIP, springs, timelines. |
| `platform` | Stable | — | Storage, cache, cookies, announcers, runtime config. |
| `router` | Stable | — | SPA routing, guards, `useRoute()`, `<bq-link>`, file-route convention. |
| `store` | Stable | — | Signal-based state, persistence, migrations, plugins. |
| `view` | Beta | 1.15.0 | Directive set + grammar frozen; transitions + optional compiler. |
| `forms` | Beta | 1.15.0 | Batteries-included surface frozen; progressive-enhancement actions. |
| `i18n` | Beta | 1.15.0 | Formatting/locale surface frozen; ICU MessageFormat; extraction tooling. |
| `a11y` | Beta | 1.15.0 | Surface frozen; runtime audit maps each finding to a WCAG criterion. |
| `dnd` | Beta | 1.15.0 | Surface frozen; keyboard model hardened; accessibility statement. |
| `media` | Beta | 1.15.0 | Composable surface frozen; SSR-safe defaults documented and verified. |
| `plugin` | Beta | 1.15.0 | Hook-bus / DI / lifecycle frozen; install/uninstall symmetry proven. |
| `devtools` | Beta | 1.15.0 | Surface frozen; versioned bridge protocol + reference extension. |
| `testing` | Beta | 1.15.0 | Testing-Library-parity surface frozen; runner integration documented. |
| `storybook` | Beta | 1.15.0 | Helper surface frozen; `unsafeHtml` security contract pinned. |
| `concurrency` | Experimental | 1.15.0 | CSP-safe module workers; client UI-scheduling primitives; surface frozen. |
| `ssr` | Experimental | 1.15.0 | Directive parity, resumability, production hydration; surface frozen. |
| `server` | Experimental | 1.15.0 | Sessions, CSRF, guards, auth; `ctx`/`app` contract frozen. |

> "Targeting Stable" means the module's public surface is frozen for one minor
> cycle ahead of graduation; see each module guide for its exit-criteria
> checklist.

## Per-module status history

Each release records module status transitions and any flagged breaking changes
here, so the road-to-stable is auditable. Format mirrors the
[CHANGELOG](CHANGELOG.md) "Module status" sections.

- **`router`**
  - _Unreleased_ — Additive opt-in file-route convention (typed `load` / `action`,
    `createFileRoutes`) bridging `router` / `ssr` / `server` ([#149]). No breaking
    changes; `router` remains **Stable**.
  - Stable since the early public releases (programmatic SPA routing).
- **`view`** — Beta → _targeting Stable in 1.15.0_; directive set and expression
  grammar frozen ([#136]).
- **`forms`** — Beta → _targeting Stable in 1.15.0_; batteries-included surface
  frozen, progressive-enhancement actions added ([#139], [#140]).
- **`i18n`** — Beta → _targeting Stable in 1.15.0_; formatting/locale surface
  frozen, ICU MessageFormat coverage documented ([#141]).
- **`a11y`** — Beta → _targeting Stable in 1.15.0_; surface frozen, audit WCAG
  scope documented ([#142]).
- **`dnd`** — Beta → _targeting Stable in 1.15.0_; surface frozen, keyboard model
  hardened ([#143]).
- **`media`** — graduated into batteries-included tier (1.14.0); Beta →
  _targeting Stable in 1.15.0_; composable surface frozen and verified ([#144]).
- **`plugin`** — graduated into batteries-included tier (1.14.0); Beta →
  _targeting Stable in 1.15.0_; install/uninstall symmetry proven ([#145]).
- **`devtools`** — graduated into batteries-included tier (1.14.0); Beta →
  _targeting Stable in 1.15.0_; versioned bridge protocol ([#146]).
- **`testing`** — graduated into batteries-included tier (1.14.0); Beta →
  _targeting Stable in 1.15.0_; runner integration documented ([#147]).
- **`storybook`** — Beta → _targeting Stable in 1.15.0_; `unsafeHtml` contract
  pinned ([#148]).
- **`concurrency`** — Experimental → _targeting Stable in 1.15.0_; CSP-safe
  module workers remove the mandatory `'unsafe-eval'` ([#133], [#134], [#135]).
- **`ssr`** — Experimental → _targeting Stable in 1.15.0_; directive parity,
  resumability, production hydration resolved; surface frozen.
- **`server`** — Experimental → _targeting Stable in 1.15.0_; first-party
  sessions/CSRF/guards/auth resolved; `ctx`/`app` contract frozen.

[#133]: https://github.com/bQuery/bQuery/issues/133
[#134]: https://github.com/bQuery/bQuery/issues/134
[#135]: https://github.com/bQuery/bQuery/issues/135
[#136]: https://github.com/bQuery/bQuery/issues/136
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
