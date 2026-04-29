# Getting Started

bQuery.js is designed for zero-build usage and modern build setups alike. You can start with plain HTML or use Vite for a fast dev server. Since `1.8.0`, the Reactive module also covers HTTP clients, polling, pagination, realtime transports, REST helpers, and request coordination utilities. Since `1.10.0`, the Concurrency module also covers explicit RPC workers, bounded pools, opt-in reactive worker state wrappers, and high-level collection helpers. Since `1.11.0`, bQuery also ships runtime-agnostic SSR helpers such as `renderToStringAsync()` and `renderToResponse()`, plus the `@bquery/bquery/server` entry point for lightweight backend routing and WebSocket sessions.

## Installation

### Zero-build via CDN

The quickest way to use bQuery is directly in the browser without any build step:

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

```ts
import { $, signal, effect } from '@bquery/bquery';

const count = signal(0);

effect(() => {
  $('#counter').text(`Count: ${count.value}`);
});
```

## Module Imports

bQuery is modular by design. You can import everything from the main entry point or pick specific modules:

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

### Reactive State

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

### Async Data & Fetching

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

### HTTP, resources & streaming

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

### Web Components

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

### Default Components & Global Config

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
| Chrome  | 90+     | ✅ Full  |
| Firefox | 90+     | ✅ Full  |
| Safari  | 15+     | ✅ Full  |
| Edge    | 90+     | ✅ Full  |

> **Note:** Internet Explorer is not supported by design.

## Next Steps

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
