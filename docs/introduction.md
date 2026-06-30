# Introduction

bQuery.js is a **batteries-included TypeScript framework for the modern web**. It brings the directness and ergonomics of jQuery's API to fine-grained reactivity, Web Components, SPA routing, state management, motion, accessibility, i18n, drag-and-drop, server-side rendering, and a dependency-free backend — all in one modular system with **zero runtime dependencies**.

> If you only need a quick installation walkthrough, jump to **[Getting Started](/guide/getting-started)**. This page explains the _why_.

## Design goals

bQuery is shaped by a handful of explicit, non-negotiable goals:

1. **Familiar API.** A `$(selector)` returning a typed, chainable wrapper still beats most modern alternatives for readability in small-to-medium DOM code. We keep that ergonomic anchor and layer reactivity, components, and SSR on top.
2. **Zero mandatory build step.** The library ships as ESM you can load from a CDN. A bundler is a choice, not a prerequisite.
3. **One stack, client and server.** SSR and server modules are first-class citizens. The same package serves a static site, an SPA, an SSR app, or a JSON API.
4. **Secure by default.** HTML-writing APIs sanitize untrusted input. Trusted Types and CSP-friendly patterns are baked in.
5. **Predictable bundle size.** Zero runtime dependencies. Every public surface lives behind a tree-shakeable sub-path. A `/full` bundle exists only as an opt-in convenience for CDN consumers.
6. **TypeScript-first.** Public APIs are strictly typed; chainable methods preserve their return type; signal values flow through `.value` with full inference.
7. **Runtime agnosticism.** Node ≥ 24, Bun ≥ 1.3.13, Deno, modern evergreen browsers, and edge runtimes are all supported targets.

## Non-goals

These are explicitly **not** goals — calling them out so expectations stay calibrated:

- **Virtual DOM diffing.** bQuery uses fine-grained reactivity via signals + directives + Web Components. There is no VDOM.
- **All-in-one mega-package.** Each module is independently importable; the root entry is a curated convenience, not an unavoidable surface.
- **A new build tool.** bQuery integrates with Vite, Rollup, esbuild, tsup, Rspack, and webpack. It does not ship one of its own.
- **A CSS framework.** Styling is left to the host project. The library is style-agnostic.
- **Drop-in jQuery compatibility.** The API is _inspired by_ jQuery, not a clone of it. See the [Migration Guide](/guide/migration) for a translation table.

## Stability matrix

bQuery follows semver. The maturity of each module today (mirrored from the
canonical [Stability Matrix](https://github.com/bQuery/bQuery/blob/main/STABILITY.md),
the single source of truth enforced by `bun run check:stability`):

| Status           | Modules                                                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stable**       | `core`, `reactive`, `security`, `component`, `motion`, `platform`, `router`, `store`, `view`, `forms`, `i18n`, `a11y`, `dnd`, `media`, `plugin`, `devtools`, `testing`, `storybook`, `concurrency`, `ssr`, `server` |
| **Beta**         | —                                                                                                                                                                                                                   |
| **Experimental** | —                                                                                                                                                                                                                   |

Stable modules will not introduce breaking changes between minor releases. The Beta and Experimental tiers stay in the policy for future modules — any breaking change there would be flagged in the [Release Notes](/release-notes/) — but **as of 1.15.0 the matrix has no Beta or Experimental members**: the release graduated the final thirteen modules to Stable.

`ssr` is **Stable as of 1.15.0**: its substantive prerequisites (directive parity, resumability, production hydration) are resolved, and its public surface is now frozen for one minor cycle. See the [SSR Stability section](/guide/ssr) for the exit-criteria checklist, frozen surface, and per-runtime support matrix.

`server` is also **Stable as of 1.15.0**: its session/middleware prerequisite is resolved (first-party sessions, CSRF, guards, and auth helpers), and the `ctx`/`app` contract is now frozen for one minor cycle. See the [Server Stability section](/guide/server) for the exit-criteria checklist, frozen surface, and per-runtime support matrix.

`concurrency` is also **Stable as of 1.15.0**: its adoption-blocking prerequisite is resolved — CSP-safe module workers (`defineWorker` / `exposeTask`) remove the mandatory `'unsafe-eval'` — and the public surface is now frozen for one minor cycle. It also gains client UI-scheduling primitives (`suspense`, `startTransition`, `deferred`). See the [Concurrency Stability section](/guide/concurrency) for the exit-criteria checklist, frozen surface, and per-environment support matrix.

`view` is also **Stable as of 1.15.0**: the directive set and expression grammar are frozen, the documented `bq-for` duplicate-key and object-expression edge cases are resolved, and a per-directive SSR support matrix is published. It also gains declarative enter/leave/move transitions (binding the `motion` engine to `bq-if`/`bq-show`/`bq-for`) and an optional `@bquery/bquery/view/compiler` build step that precompiles `bq-*` expressions without `'unsafe-eval'`. See the [View Stability section](/guide/view) for the exit-criteria checklist, frozen directive reference, and per-directive SSR matrix.

`forms` is also **Stable as of 1.15.0**: the 1.13 batteries-included surface (validators + combinators, schema builder, field arrays, `bindForm`/`bindField`, scope composables, SSR helpers) is frozen for one minor cycle, the surprising `'manual'` `validationStrategy` default and the SSR serialization boundary (functions / `File` are dropped) are documented as guaranteed contracts, and `createFieldArray()`'s stable-key requirement is now validated with clear errors. It also gains progressive-enhancement form actions — `formAction()` (native POST without JS, fetch-enhanced with pending state when JS is present), `useFormStatus()`, and an `optimistic()` update primitive — composing with validation and the `server` module's CSRF. See the [Forms Stability section](/guide/forms) for the exit-criteria checklist and frozen surface reference.

`i18n` is also **Stable as of 1.15.0**: the formatting/locale surface is frozen for one minor cycle, ICU MessageFormat coverage (`plural`, `selectordinal`, `select`, nested arguments, `offset:`, `=N`, and `#`, all via `Intl.PluralRules`) is documented and tested, and new authoring helpers (`defineMessages`, `formatMessage`) ship alongside optional, build-tool-agnostic message-extraction tooling (`@bquery/bquery/i18n/extract` + the `bquery-i18n` CLI) that scans source and merges catalogs without overwriting translations. See the [i18n Stability section](/guide/i18n) for the exit-criteria checklist, frozen surface, and ICU coverage table.

`a11y` is also **Stable as of 1.15.0**: the surface (focus management, live regions, `inert`/`scrollLock`, preference signals) is frozen for one minor cycle, and the runtime audit's scope is now documented — every rule maps to a WCAG 2.1 criterion and declares what it cannot detect, exposed via the new `auditRules` catalog and a `wcag` field on every finding. See the [A11y Stability section](/guide/a11y) for the exit-criteria checklist, frozen surface, and audit-scope table.

`dnd` is also **Stable as of 1.15.0**: the surface is frozen for one minor cycle, the keyboard interaction model (pick up / move / drop / cancel, with `aria-grabbed` state) is hardened and tested across the `grid` / `delay` / `viewport` options, and an accessibility statement is published — drag announcements route through the shared `a11y` live-region announcer rather than a second channel. See the [DnD Stability section](/guide/dnd) for the exit-criteria checklist, frozen surface, and accessibility statement.

`media` is also **Stable as of 1.15.0**: the 1.14 batteries-included composable surface (25+ device/browser signals) is frozen for one minor cycle, each composable's SSR-safe default and cleanup is documented, and reactivity, idempotent `destroy()`, listener detachment, and `AbortSignal` teardown are verified — a bake-and-verify graduation with no new features. See the [Media Stability section](/guide/media) for the exit-criteria checklist, frozen surface, and per-composable SSR defaults.

`plugin` is also **Stable as of 1.15.0**: the hook-bus, DI container, install lifecycle, and namespaced-directive registration are frozen for one minor cycle, install/uninstall symmetry is proven (nothing a plugin registers leaks after `uninstall()`), and a plugin-author guide is published. It also gains an additive `definePlugin()` authoring helper. See the [Plugin Stability section](/guide/plugin) for the exit-criteria checklist, frozen surface, and author guide.

`devtools` is also **Stable as of 1.15.0**: the surface is frozen for one minor cycle, and the single biggest gap versus React/Vue/Svelte DevTools is addressed — a stable, versioned bridge protocol (`connectDevtoolsBridge` / `createBridgeServer`) and a reference Manifest V3 browser extension (component tree, signal/store inspection, timeline) in `extension/`. See the [DevTools Stability section](/guide/devtools) for the exit-criteria checklist, frozen surface, and bridge protocol.

`testing` is also **Stable as of 1.15.0**: the Testing-Library-parity surface (`screen`/`within`, `userEvent`, `fireEvent`, module mocks, a11y helpers) is frozen for one minor cycle, runner integration beyond `bun:test` (Vitest / Jest) is documented, and the shadow-DOM-aware queries are tested across light and shadow DOM. See the [Testing Stability section](/guide/testing) for the exit-criteria checklist, frozen surface, and runner integration.

`storybook` is also **Stable as of 1.15.0**: the helper surface (`storyHtml`, `storySvg`, `when`, `classMap`, `styleMap`, `ifDefined`, `repeat`, `storyText`, `unsafeHtml`) is frozen for one minor cycle, and the `unsafeHtml` security contract is pinned — everything `storyHtml` interpolates is sanitized via the security module; only brand-checked, author-controlled fragments are inserted verbatim. See the [Storybook Stability section](/guide/storybook) for the exit-criteria checklist, frozen surface, and security contract.

## When to use bQuery

bQuery is a good fit when you want:

- A small reactive layer on an existing server-rendered app, without adopting a heavyweight framework.
- A zero-build prototype that can grow into a real production app without a rewrite.
- One package that covers DOM, reactivity, components, routing, SSR, forms, and a server.
- A modern alternative to vanilla DOM scripting for jQuery-era code that's becoming hard to maintain.

bQuery is **probably not** the right fit when:

- You're already deeply invested in a framework with strong ecosystem fit (Vue, React, Svelte, Angular). Migrating wholesale isn't worth it.
- You need a virtual DOM (e.g., for React Native or non-DOM targets).
- You require an opinionated CSS framework bundled with the runtime.

## Next steps

- **[Getting Started](/guide/getting-started)** — installation and the first running example.
- **[Tutorial](/guide/tutorial)** — build a real app touching Core, Reactive, View, Store, Router, Component, Motion, A11y, and Testing.
- **[Architecture](/concepts/architecture)** — how the modules fit together.
- **[Migration Guide](/guide/migration)** — moving from jQuery.
- **[Best Practices](/guide/best-practices)** — patterns that scale.
