# Introduction

bQuery.js is a **batteries-included TypeScript framework for the modern web**. It brings the directness and ergonomics of jQuery's API to fine-grained reactivity, Web Components, SPA routing, state management, motion, accessibility, i18n, drag-and-drop, server-side rendering, and a dependency-free backend — all in one modular system with **zero runtime dependencies**.

> If you only need a quick installation walkthrough, jump to **[Getting Started](/guide/getting-started)**. This page explains the *why*.

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
- **Drop-in jQuery compatibility.** The API is *inspired by* jQuery, not a clone of it. See the [Migration Guide](/guide/migration) for a translation table.

## Stability matrix

bQuery follows semver. The maturity of each module today:

| Status         | Modules                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| **Stable**     | `core`, `reactive`, `security`, `component`, `motion`, `platform`, `router`, `store`                    |
| **Beta**       | `view`, `forms`, `i18n`, `a11y`, `dnd`, `media`, `plugin`, `devtools`, `testing`, `storybook`           |
| **Experimental** | `ssr`, `server`, `concurrency`                                                                        |

Stable modules will not introduce breaking changes between minor releases. Beta and experimental modules may evolve faster — breaking changes for those are flagged in the [Release Notes](/release-notes/).

`ssr` is **targeting Stable in 1.15.0**: its substantive prerequisites (directive parity, resumability, production hydration) are resolved, and its public surface is now frozen for one minor cycle. See the [SSR Stability section](/guide/ssr) for the exit-criteria checklist, frozen surface, and per-runtime support matrix.

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
