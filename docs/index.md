---
layout: home
title: bQuery.js
hero:
  name: bQuery.js
  text: The full-stack framework that speaks jQuery.
  tagline: Batteries-included TypeScript framework with signals, Web Components, routing, SSR, and a dependency-free server — zero mandatory build step.
  image:
    src: /assets/bquerry-logo.svg
    alt: bQuery Logo
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: What is bQuery?
      link: /introduction
    - theme: alt
      text: View on GitHub
      link: https://github.com/bQuery/bQuery
features:
  - icon: ⚡
    title: Zero Build
    details: Works directly in the browser via CDN or ES modules. Vite is optional, not required.
  - icon: 🧠
    title: Fine-grained Reactivity
    details: Signals, computed values, scopes, batching, watch with debounce/throttle, and async data primitives.
  - icon: 🌐
    title: Realtime & HTTP
    details: Built-in HTTP client, polling, pagination, WebSocket/SSE composables, REST helpers, and request deduplication.
  - icon: 🧩
    title: Web Components
    details: Typed Web Components with scoped reactivity, slots, refs, lifecycle hooks, and a previewable default library.
  - icon: 🛡️
    title: Secure by Default
    details: HTML-writing APIs sanitize untrusted input. Trusted Types and CSP-friendly patterns ship out of the box.
  - icon: 🧵
    title: Off-Main-Thread
    details: Zero-build worker tasks, RPC helpers, bounded pools, reactive worker state, and collection helpers.
  - icon: 🛣️
    title: Router & Store
    details: SPA routing with guards and navigation results plus signal-based state management and persistence.
  - icon: 📝
    title: Forms & i18n
    details: Reactive form state, schema validation, locale negotiation, pluralization, and Intl formatting.
  - icon: ♿
    title: Accessibility & Media
    details: Focus traps, live regions, audits, viewport / network / battery signals, clipboard, and reduced-motion helpers.
  - icon: 🖥️
    title: SSR & Server
    details: Runtime-agnostic SSR (Node, Bun, Deno, edge) and a dependency-free backend with WebSocket sessions.
  - icon: 🧪
    title: Testing & Devtools
    details: Component mounts, screen / userEvent helpers, signal mocks, timeline inspection, and snapshot import/export.
  - icon: 🎨
    title: Motion & DnD
    details: Springs, tweens, FLIP, timelines, parallax, drag-and-drop with keyboard a11y, and reactive draggable APIs.
---

## What is bQuery.js?

bQuery.js is a **batteries-included TypeScript framework for the modern web** — not just a DOM utility library. It bundles fine-grained reactivity, Web Components, routing, state management, forms, motion, accessibility, drag-and-drop, runtime-agnostic SSR, and a dependency-free backend behind a familiar **jQuery-inspired API**. Every public module ships its own entry point so bundlers can keep your build small.

Read more in the **[Introduction](/introduction)** or jump straight to **[Getting Started](/guide/getting-started)**.

## Why bQuery?

| You want…                                                | bQuery gives you                                                                                                        |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **A jQuery-style DOM API on modern reactive primitives** | `$(selector)` returns a typed `BQueryElement`; signals and effects participate in chainable code without a virtual DOM. |
| **Zero build for small projects**                        | Drop a `<script type="module">` from a CDN — no Vite, no bundler, no transpiler required.                               |
| **A real framework when projects grow**                  | 23 tree-shakeable modules covering routing, state, forms, SSR, server, motion, a11y, i18n, devtools, testing, plugins.  |
| **One stack for client and server**                      | `@bquery/bquery/ssr` + `@bquery/bquery/server` render and serve from the same runtime (Node, Bun, Deno, or edge).       |
| **Security defaults that don't fight you**               | HTML-writing APIs sanitize untrusted input; Trusted Types and CSP-friendly patterns are first-class.                    |
| **Predictable bundle size**                              | Zero runtime dependencies; every public surface is tree-shakeable; a `/full` bundle is reserved for CDN consumers.      |

## At a glance

```
@bquery/bquery
├── core ─────────── selectors, traversal, events, utilities
├── reactive ─────── signals, computed, watch, async data, HTTP, realtime
├── concurrency ──── worker tasks, RPC, pools, reactive metrics
├── component ────── typed Web Components, slots, refs, lifecycle
├── motion ───────── transitions, springs, tweens, timelines
├── security ─────── sanitization, Trusted Types
├── platform ─────── storage, cache, cookies, page meta
├── router ───────── SPA routing, guards, navigation results
├── store ────────── signal-based state with persistence
├── view ─────────── declarative bq-* directives
├── forms ────────── reactive forms, validators, schema
├── i18n ─────────── locale negotiation, Intl, pluralization
├── a11y ─────────── focus, live regions, audits, prefs
├── dnd ──────────── draggable, droppable, sortable
├── media ────────── viewport, network, clipboard, prefs
├── plugin ───────── hooks, DI, namespaced directives
├── devtools ─────── timeline, signal/store diffs, perf
├── testing ──────── screen, userEvent, mocks
├── storybook ────── safe story helpers
├── ssr ──────────── runtime-agnostic rendering & streaming
└── server ───────── dependency-free routing + WebSockets
```

See the full **[Architecture overview](/concepts/architecture)** and the **[Modules](#i-want-to)** matrix below.

## Install

::: code-group

```bash [npm]
npm install @bquery/bquery
```

```bash [bun]
bun add @bquery/bquery
```

```bash [pnpm]
pnpm add @bquery/bquery
```

```bash [yarn]
yarn add @bquery/bquery
```

```html [CDN]
<script type="module">
  import { $, signal, effect } from 'https://unpkg.com/@bquery/bquery@1/dist/full.es.mjs';
</script>
```

:::

Supported runtimes: **Node.js ≥ 24**, **Bun ≥ 1.3.13**, modern Chromium / Firefox / Safari / Edge. See **[Supported Runtimes](/concepts/runtimes)**.

## Two-minute example — client

```ts
import { $, signal, effect } from '@bquery/bquery';

const count = signal(0);

effect(() => {
  $('#counter').text(`Count: ${count.value}`);
});

$('#counter').on('click', () => {
  count.value++;
});
```

## Two-minute example — server

```ts
import { createServer } from '@bquery/bquery/server';

const app = createServer();

app.get('/', async (ctx) => {
  return ctx.renderResponse(`<h1 bq-text="message"></h1>`, { message: 'Hello from bQuery SSR' });
});

await app.listen({ port: 3000 });
```

Walk through both end-to-end in the **[Tutorial](/guide/tutorial)** and the **[Full-Stack Workflows](/workflows/)**.

## I want to…

| I want to…                                | Start here                                                          |
| ----------------------------------------- | ------------------------------------------------------------------- |
| Reactively update the DOM without a build | [Core](/guide/api-core) + [Reactive](/guide/reactive)               |
| Build a single-page app                   | [Router](/guide/router), [Store](/guide/store), [View](/guide/view) |
| Build Web Components                      | [Component](/guide/components) + [Storybook](/guide/storybook)      |
| Build a full-stack app with SSR           | [SSR](/guide/ssr) + [Server](/guide/server)                         |
| Handle forms, i18n, and a11y              | [Forms](/guide/forms) + [i18n](/guide/i18n) + [A11y](/guide/a11y)   |
| Animate things                            | [Motion](/guide/motion)                                             |
| Move work off the main thread             | [Concurrency](/guide/concurrency)                                   |
| Migrate from jQuery                       | [Migration Guide](/guide/migration)                                 |

## Learn more

- **New to the project?** Start with **[Getting Started](/guide/getting-started)** and follow the **[Tutorial](/guide/tutorial)**.
- **Stuck on a concept?** See **[Core Concepts](/concepts/architecture)** and the **[Glossary](/glossary)**.
- **Looking for snippets?** The **[Cookbook](/cookbook/)** and **[Examples](/guide/examples)** have copy-paste recipes.
- **Coming from jQuery?** Read the **[Migration Guide](/guide/migration)**.
- **Contributing?** Read the **[Contributing Guide](/contributing/)**.
