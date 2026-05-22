# Getting Started

**The full-stack web framework that speaks jQuery.**

bQuery.js is a batteries-included TypeScript framework for the modern web. It spans reactive DOM scripting, Web Components, routing, state, forms, accessibility helpers, SSR, and server-side request handling while keeping a familiar jQuery-inspired API and a zero mandatory build step — or your preferred bundler.

You do not need to adopt the whole framework at once. Start with the layer that matches your app today, then compose in more modules as your needs grow.

> **Stability**: Core, Reactive, Security, Component, Motion, Platform, Router,
> and Store are considered stable. View, Forms, i18n, A11y, DnD, Media, Plugin,
> Devtools, Testing, and Storybook are in beta. SSR, Server, and Concurrency
> are experimental — APIs may change between minor versions.

## Where to start

**I want reactive DOM scripting without a build step:**
→ Start with [Core](./api-core.md) and [Reactive](./reactive.md)

**I'm building a single-page application:**
→ Start with [Router](./router.md), [Store](./store.md), and [View](./view.md)

**I'm building a full-stack app with SSR:**
→ Start with [SSR](./ssr.md) and [Server](./server.md)

**I want to use Web Components:**
→ Start with [Component](./components.md)

## Installation

### Zero-build via CDN

The quickest way to use bQuery is directly in the browser without any build step. The example below is fully self-contained — save it as `index.html`, open it in a browser, and clicking the button updates the label reactively.

```html
<!DOCTYPE html>
<html>
  <head>
    <title>bQuery Demo</title>
  </head>
  <body>
    <button id="counter">Count: 0</button>

    <script type="module">
      import { $, signal, effect } from 'https://unpkg.com/@bquery/bquery@1/dist/full.es.mjs';

      const count = signal(0);

      effect(() => {
        $('#counter').text(`Count: ${count.value}`);
      });

      $('#counter').on('click', () => {
        count.value++;
      });
    </script>
  </body>
</html>
```

What is going on here:

- `$('#counter')` returns a chainable `BQueryElement` wrapping the matching DOM node. It throws if no element matches — use `$$()` (in `@bquery/bquery/core`) when zero matches is acceptable.
- `signal(0)` creates a writable reactive value. Reading `count.value` inside a reactive context registers a dependency; writing `count.value = …` notifies dependents.
- `effect(() => …)` runs the callback immediately and again whenever any signal it read inside changes. Here it reads `count.value`, so the button label re-renders on every click.
- `.on('click', …)` attaches a direct event listener with the same chainable style as jQuery. For delegated handling on dynamic descendants, use `.delegate()` from Core.

> The full ES module bundle is served from `https://unpkg.com/@bquery/bquery@1/dist/full.es.mjs` (used above) or `https://cdn.jsdelivr.net/npm/@bquery/bquery@1/+esm`. Both expose the same public API surface as the npm package — see [Module Imports](#module-imports) below.

### Package Manager

Install with your favorite package manager:

```bash
# npm
npm install @bquery/bquery

# bun
bun add @bquery/bquery

# pnpm
pnpm add @bquery/bquery
```

### Vite + TypeScript

Use any modern bundler — Vite, Rspack, esbuild, tsup, Rollup, or webpack — without extra configuration. bQuery ships ESM, CJS, UMD, and `.d.ts` files, so TypeScript projects get full type inference out of the box. A minimal Vite entry looks like this:

```ts
import { $, signal, effect } from '@bquery/bquery';

const count = signal(0);

effect(() => {
  $('#counter').text(`Count: ${count.value}`);
});
```

The root `@bquery/bquery` entry re-exports the most commonly used helpers (selectors, signals, components, view mount, security, default config, etc.). For smaller bundles, import directly from a sub-path such as `@bquery/bquery/reactive` — every sub-path is tree-shakeable and listed in [Module Imports](#module-imports).

## Module Imports

bQuery is modular by design. There are two ways to import:

1. **From the root entry** `@bquery/bquery` — gives you the most commonly used helpers (`$`, `signal`, `component`, `mount`, `sanitize`, `defineBqueryConfig`, …) with the convenience of a single import path. The `/full` entry adds every public type for CDN consumers.
2. **From a sub-path** such as `@bquery/bquery/reactive` — narrows the bundler's tree-shaking surface and matches the directory layout in `src/`. Every module listed below ships its own `index.ts` barrel and is independently tree-shakeable.

Both paths resolve to the same TypeScript declarations, so type inference, IDE jump-to-definition, and auto-import behave identically.

```ts
// Full import
import {
  $,
  signal,
  component,
  registerDefaultComponents,
  transition,
  sanitize,
  defineBqueryConfig,
  useCookie,
} from '@bquery/bquery';

// Core only (selectors, DOM, events)
import { $, $$, utils } from '@bquery/bquery/core';

// Core utilities as named exports
import { debounce, merge, uid } from '@bquery/bquery/core';

// Reactive only (signals, computed, effects, async, HTTP, realtime)
import {
  signal,
  computed,
  effect,
  batch,
  useFetch,
  createHttp,
  useWebSocket,
  useEventSource,
  useResource,
} from '@bquery/bquery/reactive';

// Concurrency only (zero-build worker tasks, pools, and helpers)
import {
  callWorkerMethod,
  createReactiveTaskPool,
  createRpcPool,
  createRpcWorker,
  createTaskPool,
  createTaskWorker,
  isConcurrencySupported,
  parallel,
  runTask,
} from '@bquery/bquery/concurrency';

// Components only (Web Components + default library)
import { bool, component, html, registerDefaultComponents } from '@bquery/bquery/component';

// Motion only (transitions, animations)
import { transition, spring, flip } from '@bquery/bquery/motion';

// Security only (sanitization)
import { sanitize, escapeHtml, sanitizeHtml, trusted } from '@bquery/bquery/security';

// Platform only (storage, cache, config, cookies, page meta, accessibility)
import {
  storage,
  cache,
  notifications,
  buckets,
  defineBqueryConfig,
  useCookie,
  definePageMeta,
  useAnnouncer,
} from '@bquery/bquery/platform';

// Storybook helpers
import { storyHtml, when } from '@bquery/bquery/storybook';

// Forms, i18n, accessibility, drag & drop, media
import { createForm, required } from '@bquery/bquery/forms';
import { createI18n } from '@bquery/bquery/i18n';
import { trapFocus, skipLink } from '@bquery/bquery/a11y';
import { draggable, sortable } from '@bquery/bquery/dnd';
import { mediaQuery, useViewport, clipboard } from '@bquery/bquery/media';

// Plugins, devtools, testing, SSR, server
import { use } from '@bquery/bquery/plugin';
import { enableDevtools } from '@bquery/bquery/devtools';
import { renderComponent, waitFor } from '@bquery/bquery/testing';
import { createSSRContext, renderToResponse, renderToStringAsync } from '@bquery/bquery/ssr';
import { createServer } from '@bquery/bquery/server';
```

## Modules at a glance

| Module          | Description                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Core**        | Selectors, DOM manipulation, traversal, events, and typed utilities                                                             |
| **Reactive**    | Signals, computed values, effects, batching, HTTP clients, polling, streaming, and REST composables                             |
| **Concurrency** | Zero-build worker tasks, explicit RPC helpers, bounded pools, reactive worker state wrappers, and high-level collection helpers |
| **Component**   | Typed Web Components with scoped reactivity and Shadow DOM control                                                              |
| **Storybook**   | Safe string-template helpers for stories and boolean attributes                                                                 |
| **Motion**      | Transitions, morphing, parallax, typewriter, FLIP, scroll, and springs                                                          |
| **Security**    | Sanitization, Trusted Types, CSP helpers, and trusted fragments                                                                 |
| **Platform**    | Storage, cache, cookies, page metadata, announcers, and shared config                                                           |
| **Router**      | SPA routing, redirects, constrained params, guards, and declarative links                                                       |
| **Store**       | Signal-based state, persistence, migrations, and action lifecycle hooks                                                         |
| **View**        | Declarative bindings, directives, and plugin-powered custom directives                                                          |
| **Forms**       | Reactive form state, validation, and submit orchestration                                                                       |
| **i18n**        | Reactive locale state, translation, pluralization, and Intl formatting                                                          |
| **A11y**        | Focus management, skip navigation, live regions, media preferences, and audits                                                  |
| **DnD**         | Draggable elements, drop zones, and sortable lists                                                                              |
| **Media**       | Viewport, network, battery, geolocation, sensors, and clipboard wrappers                                                        |
| **Plugin**      | Global plugin registration for custom directives and components                                                                 |
| **Devtools**    | Runtime inspection helpers for signals, stores, components, and timelines                                                       |
| **Testing**     | Component mounts, mock signals/router, event helpers, and async assertions                                                      |
| **SSR**         | Runtime-agnostic HTML, streaming, `Response` rendering, hydration islands, adapters, and store-state handoff                    |
| **Server**      | Express-inspired backend routing, middleware, safe response helpers, and WebSocket sessions                                     |

## Quick Examples

### DOM Manipulation

`@bquery/bquery/core` provides the chainable selector API. `$()` returns a single-element wrapper that throws when nothing matches; `$$()` returns a collection that may be empty. Both expose the familiar jQuery-style methods (`addClass`, `css`, `text`, `html`, `attr`, `on`, etc.), and every mutating method returns `this` so you can keep chaining.

```ts
import { $ } from '@bquery/bquery/core';

// Select and chain operations
$('#myElement')
  .addClass('active')
  .css({ color: 'blue', 'font-size': '16px' })
  .text('Hello, bQuery!');

// Event handling
$('#button').on('click', () => {
  console.log('Button clicked!');
});
```

`text()` is safe for untrusted input because it writes `textContent`, while `html()` and the HTML insertion helpers sanitize string content via the [Security module](./security.md). `attr()` sets attributes directly with `setAttribute()`, so escape or validate untrusted values before writing them. When you genuinely need to inject pre-trusted markup, use the explicit escape hatch `.raw.innerHTML` on the underlying element — that opt-in is deliberate.

### Reactive State

Signals are the foundation of bQuery's reactivity. A `signal()` holds a value; reading `.value` inside an `effect()`, `computed()`, or component template registers a fine-grained dependency, and writing `.value = …` only re-runs the readers that actually depended on it. Use `.peek()` to read without subscribing.

```ts
import { signal, computed, effect } from '@bquery/bquery/reactive';

// Create reactive state
const firstName = signal('John');
const lastName = signal('Doe');

// Derive computed values
const fullName = computed(() => `${firstName.value} ${lastName.value}`);

// React to changes
effect(() => {
  document.title = fullName.value;
});

// Update triggers reactivity
firstName.value = 'Jane'; // Title updates automatically
```

`computed()` is read-only and memoized — it only recomputes when one of its tracked dependencies changes. For two-way derived state, use `linkedSignal()` from the same module. To group several writes into a single notification, wrap them in `batch(() => …)`.

### Async Data & Fetching

`useFetch()` is the reactive companion to `fetch()`. It returns `data`, `pending`, and `error` signals and re-runs when any signal listed in `watch` changes, so the URL builder always reflects the latest input. Returning a falsy URL pauses the request, which is convenient for conditional loading.

```ts
import { signal, useFetch } from '@bquery/bquery/reactive';

const userId = signal(1);
const user = useFetch<{ id: number; name: string }>(() => `/api/users/${userId.value}`, {
  watch: [userId],
  query: { include: 'profile' },
});

if (user.pending.value) {
  console.log('Loading…');
}

console.log(user.data.value, user.error.value);
```

See [Reactive › Async data](./reactive.md) for the full option list (`immediate`, `transform`, `cache`, `dedupe`, `retry`, abort signals, etc.).

### HTTP, resources & streaming

`createHttp()` returns a typed client with shared defaults (base URL, headers, retry, interceptors). `useResource()` is a higher-level wrapper that exposes signal-backed REST state, and `useEventSource()` / `useWebSocket()` lift Server-Sent Events and WebSocket streams into reactive signals you can read from any effect, component, or view binding.

```ts
import { createHttp, useEventSource, useResource } from '@bquery/bquery/reactive';

const api = createHttp({ baseUrl: 'https://api.example.com', retry: 2 });
const profile = useResource<{ id: number; name: string }>('/users/1', {
  baseUrl: 'https://api.example.com',
});
const events = useEventSource<{ status: string }>('/events/profile');

const { data } = await api.get('/users');
console.log(data, profile.pending.value, events.status.value);
```

All four helpers share the same lifecycle conventions (`pending`, `error`, `abort()`/`close()`), so swapping transports as your needs evolve is mostly a matter of swapping the constructor.

### Web Components

`component()` defines a real custom element with typed props, optional `styles`, and a `render()` function returning a sanitized tagged-template string. Props are reflected as attributes for primitives; non-string props can be set imperatively via the instance `setProp()` / `getProp()` helpers documented in the [Component guide](./components.md).

```ts
import { component, html } from '@bquery/bquery/component';

component('greeting-card', {
  props: {
    name: { type: String, required: true },
    message: { type: String, default: 'Welcome!' },
  },
  styles: `
    .card { padding: 1rem; border-radius: 8px; background: #f0f0f0; }
    h2 { margin: 0 0 0.5rem 0; }
  `,
  render({ props }) {
    return html`
      <div class="card">
        <h2>Hello, ${props.name}!</h2>
        <p>${props.message}</p>
      </div>
    `;
  },
});

// Usage: <greeting-card name="World" message="How are you?"></greeting-card>
```

`html` is a sanitizing tagged template — interpolated values are HTML-escaped automatically. Use `safeHtml` plus `bool('aria-pressed', value)` from the same module when you need boolean-attribute shorthand without manual concatenation.

### Default Components & Global Config

`defineBqueryConfig()` sets framework-wide defaults — component tag prefix, base URL for fetch helpers, and motion preferences. `registerDefaultComponents()` then registers the built-in component library (button, card, modal, etc.) under that prefix and returns the resolved tag names so you can compose them in templates without hard-coding strings.

```ts
import { defineBqueryConfig, registerDefaultComponents, useCookie } from '@bquery/bquery';

defineBqueryConfig({
  components: { prefix: 'ui' },
  fetch: { baseUrl: 'https://api.example.com' },
  transitions: { skipOnReducedMotion: true, classes: ['page-transition'] },
});

const tags = registerDefaultComponents();
const theme = useCookie<'light' | 'dark'>('theme', { defaultValue: 'light' });

console.log(tags.button); // ui-button
theme.value = 'dark';
```

`useCookie()` returns a writable signal backed by `document.cookie`; setting `.value` updates the cookie and notifies subscribers across the page. The same module exposes `storage` (Web Storage with JSON + signal helpers), `cache`, `notifications`, `definePageMeta`, and `useAnnouncer` — see [Platform](./platform.md) for the full surface.

### Storybook authoring

```ts
import { storyHtml, when } from '@bquery/bquery/storybook';

export const Playground = {
  args: { disabled: false },
  render: ({ disabled }: { disabled: boolean }) =>
    storyHtml`
      <ui-card>
        <ui-button ?disabled=${disabled}>Save</ui-button>
        ${when(disabled, '<small>Currently disabled</small>', '<small>Ready</small>')}
      </ui-card>
    `,
};
```

### SSR, server, and testing

bQuery's SSR module operates on standard `Request` / `Response` objects and runs unmodified on Bun, Deno, and Node ≥ 24. `createServer()` from `@bquery/bquery/server` is a minimal, dependency-free router whose `handle()` method accepts a URL or `Request` and returns a `Response`. The [Testing](./testing.md) helpers mount components in `happy-dom`, dispatch events, and `await` async assertions.

```ts
import { renderComponent, fireEvent, waitFor } from '@bquery/bquery/testing';
import { createSSRContext, renderToResponse } from '@bquery/bquery/ssr';
import { createServer } from '@bquery/bquery/server';

const mounted = renderComponent('ui-button', { props: { variant: 'primary' } });
fireEvent(mounted.el, 'click');
await waitFor(() => mounted.el.isConnected);

const app = createServer();
app.get('/', (ctx) => {
  const ssr = createSSRContext({ request: ctx.request });
  return renderToResponse(
    '<html><head></head><body><div id="app"><p bq-text="title"></p></div></body></html>',
    { title: 'Hello from the server' },
    { context: ssr, etag: true }
  );
});

console.log(await app.handle('http://localhost/'));
mounted.unmount();
```

`renderToResponse()` understands ETags and conditional requests automatically when `etag: true` is set — a `304 Not Modified` is returned to clients whose cached response is still fresh. For streaming responses use `renderToStream()`; for non-HTTP rendering use `renderToStringAsync()`.

## Local Development

If you're developing bQuery itself:

```bash
# Install dependencies
bun install

# Start documentation dev server
bun run dev

# Start Storybook
bun run storybook

# Run tests
bun test

# Build library bundle
bun run build

# Verify release / AI guidance sync
bun run check:ai-guidance

# Build documentation site
bun run build:docs
```

## Browser Support

| Browser | Version | Support |
| ------- | ------- | ------- |
| Chrome  | 90+     | ✅ Full |
| Firefox | 90+     | ✅ Full |
| Safari  | 15+     | ✅ Full |
| Edge    | 90+     | ✅ Full |

> **Note:** Internet Explorer is not supported by design.

## Next Steps

Ready to go beyond snippets? The step-by-step [**Tutorial**](./tutorial.md) walks through building a real Notes app from zero, layering in Core, Reactive, View, Store, Forms, Router, Component, Motion, Platform, A11y, and Testing one feature at a time.

For module-specific deep dives:

- [Core API](./api-core.md) - Learn about selectors and DOM manipulation
- [Agents](./agents.md) - Build agent UIs with bQuery
- [Reactive](./reactive.md) - Understand signals and reactivity
- [Components](./components.md) - Build Web Components
- [Storybook](./storybook.md) - Author safe Storybook stories
- [Motion](./motion.md) - Add animations and transitions
- [Security](./security.md) - Sanitization and CSP
- [Platform](./platform.md) - Storage, cache, cookies, page meta, announcers, and config
- [Forms](./forms.md) - Build reactive forms with validators
- [i18n](./i18n.md) - Localize messages and formatting
- [Accessibility](./a11y.md) - Manage focus, announcements, and audits
- [Drag & Drop](./dnd.md) - Add draggable and sortable interactions
- [Media](./media.md) - Read browser and device state reactively
- [Plugin System](./plugin.md) - Register custom directives and components
- [Devtools](./devtools.md) - Inspect signals, stores, and timelines
- [Testing](./testing.md) - Mount components and assert async behavior
- [SSR](./ssr.md) - Render templates on the server and hydrate on the client
- [Server](./server.md) - Build lightweight backend routes and WebSocket handlers
