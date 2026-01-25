<p align="center">
  <img src="assets/bquerry-logo.svg" alt="bQuery.js Logo" width="120" />
</p>

<h1 align="center">bQuery.js</h1>

<p align="center">

[![Repo](https://img.shields.io/badge/github-bquery%2Fbquery-24292f?logo=github)](https://github.com/bQuery/bQuery)
[![Stars](https://img.shields.io/github/stars/bquery/bquery?style=flat&logo=github)](https://github.com/bQuery/bQuery/stargazers)
[![Issues](https://img.shields.io/github/issues/bquery/bquery?style=flat&logo=github)](https://github.com/bQuery/bQuery/issues)
[![License](https://img.shields.io/github/license/bquery/bquery?style=flat)](https://github.com/bQuery/bQuery/blob/main/LICENSE.md)
[![npm](https://img.shields.io/npm/v/@bquery/bquery)](https://www.npmjs.com/package/@bquery/bquery)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@bquery/bquery)](https://bundlephobia.com/package/@bquery/bquery)
[![unpkg](https://img.shields.io/badge/unpkg-browse-blue?logo=unpkg)](https://unpkg.com/@bquery/bquery)
[![CodeFactor](https://www.codefactor.io/repository/github/bquery/bquery/badge)](https://www.codefactor.io/repository/github/bquery/bquery)

**The jQuery for the modern Web Platform.**

bQuery.js is a slim, TypeScript-first library that combines jQuery's direct DOM workflow with modern features like reactivity, Web Components, and motion utilities — without a mandatory build step.

## Highlights

- **Zero‑build capable**: runs directly in the browser; build tools are optional.
- **Security‑focused**: DOM writes are sanitized by default; Trusted Types supported.
- **Modular**: the core stays small; extra modules are opt‑in.
- **TypeScript‑first**: clear types and strong IDE support.
- **Tree-shakeable**: import only what you need.

## Installation

### Via npm/bun/pnpm

```bash
# npm
npm install @bquery/bquery

# bun
bun add @bquery/bquery

# pnpm
pnpm add @bquery/bquery
```

### Via CDN (Zero-build)

#### ES Modules (recommended)

```html
<script type="module">
  import { $, signal } from 'https://unpkg.com/@bquery/bquery@1/dist/full.es.mjs';

  const count = signal(0);
  $('#counter').text(`Count: ${count.value}`);
</script>
```

#### UMD (global variable)

```html
<script src="https://unpkg.com/@bquery/bquery@1/dist/full.umd.js"></script>
<script>
  const { $, signal } = bQuery;
  const count = signal(0);
</script>
```

#### IIFE (self-executing)

```html
<script src="https://unpkg.com/@bquery/bquery@1/dist/full.iife.js"></script>
<script>
  const { $, $$ } = bQuery;
  $$('.items').addClass('loaded');
</script>
```

### Import Strategies

```ts
// Full bundle (all modules)
import { $, signal, component } from '@bquery/bquery';

// Core only
import { $, $$ } from '@bquery/bquery/core';

// À la carte (individual modules)
import { signal, computed, effect } from '@bquery/bquery/reactive';
import { component, html } from '@bquery/bquery/component';
import { transition, spring } from '@bquery/bquery/motion';
import { sanitize } from '@bquery/bquery/security';
import { storage, cache } from '@bquery/bquery/platform';
import { createRouter, navigate } from '@bquery/bquery/router';
import { createStore } from '@bquery/bquery/store';
import { mount } from '@bquery/bquery/view';
```

## Modules at a glance

| Module        | Description                                        | Size (gzip) |
| ------------- | -------------------------------------------------- | ----------- |
| **Core**      | Selectors, DOM manipulation, events, utilities     | ~7.7 KB     |
| **Reactive**  | `signal`, `computed`, `effect`, `batch`            | ~1.2 KB     |
| **Component** | Lightweight Web Components with props              | ~1.5 KB     |
| **Motion**    | View transitions, FLIP, timelines, scroll, springs | ~1.2 KB     |
| **Security**  | HTML sanitizing, Trusted Types, CSP                | ~2.2 KB     |
| **Platform**  | Storage, cache, notifications, buckets             | ~1.6 KB     |
| **Router**    | SPA routing, navigation guards, history API        | ~2 KB       |
| **Store**     | Signal-based state management, persistence         | ~1.5 KB     |
| **View**      | Declarative DOM bindings, directives               | ~2.6 KB     |

## Quick examples

### Core – DOM & events

```ts
import { $, $$ } from '@bquery/bquery/core';

// jQuery-style selectors
$('#save').on('click', (event) => {
  console.log('Saved', event.type);
});

// Event delegation for dynamic content
$('#list').delegate('click', '.item', (event, target) => {
  console.log('Item clicked', target.textContent);
});

// Method chaining
$('#box').addClass('active').css({ opacity: '0.8' }).attr('data-state', 'ready');

// DOM manipulation
$('#content').wrap('<div class="wrapper"></div>');
$('#wrapper').unwrap(); // Remove parent wrapper

// Attribute helpers
$('#dialog').toggleAttr('open');

// Smooth scrolling
$('#section').scrollTo({ behavior: 'smooth' });

// Form serialization
const formData = $('form').serialize(); // Returns object
const queryString = $('form').serializeString(); // Returns URL-encoded string

// Collections
$$('.items').addClass('highlight');
$$('.items').append('<li class="item">New</li>');
```

### Reactive – signals

```ts
import {
  signal,
  computed,
  effect,
  batch,
  watch,
  readonly,
  linkedSignal,
} from '@bquery/bquery/reactive';

const count = signal(0);
const doubled = computed(() => count.value * 2);

effect(() => {
  console.log('Count changed', count.value);
});

// Watch with cleanup support
const stop = watch(count, (newVal, oldVal) => {
  console.log(`Changed from ${oldVal} to ${newVal}`);
});

// Read-only signal wrapper
const readOnlyCount = readonly(count);

// Batch updates for performance
batch(() => {
  count.value++;
  count.value++;
});

// Writable computed (linked signal)
const first = signal('Ada');
const last = signal('Lovelace');
const fullName = linkedSignal(
  () => `${first.value} ${last.value}`,
  (next) => {
    const [nextFirst, nextLast] = next.split(' ');
    first.value = nextFirst ?? '';
    last.value = nextLast ?? '';
  }
);

fullName.value = 'Grace Hopper';
```

### Components – Web Components

```ts
import { component, defineComponent, html } from '@bquery/bquery/component';

component('user-card', {
  props: {
    username: { type: String, required: true },
    age: { type: Number, validator: (v) => v >= 0 && v <= 150 },
  },
  // Extended lifecycle hooks
  beforeMount() {
    console.log('About to mount');
  },
  connected() {
    console.log('Mounted');
  },
  beforeUpdate(props) {
    // Return false to prevent update
    return props.username !== '';
  },
  onError(error) {
    console.error('Component error:', error);
  },
  render({ props }) {
    return html`<div>Hello ${props.username}</div>`;
  },
});

// Optional: create the class without auto-registration
const UserCard = defineComponent('user-card', {
  props: { username: { type: String, required: true } },
  render: ({ props }) => html`<div>Hello ${props.username}</div>`,
});
customElements.define('user-card', UserCard);
```

### Motion – animations

```ts
import { animate, keyframePresets, spring, transition } from '@bquery/bquery/motion';

// View transitions (with fallback)
await transition(() => {
  $('#content').text('Updated');
});

// Web Animations helper
await animate(card, {
  keyframes: keyframePresets.pop(),
  options: { duration: 240, easing: 'ease-out' },
});

// Spring physics
const x = spring(0, { stiffness: 120, damping: 14 });
x.onChange((value) => {
  element.style.transform = `translateX(${value}px)`;
});
await x.to(100);
```

### Security – sanitizing

Internally modularized (sanitize core, Trusted Types, CSP helpers) — the public API remains unchanged. For legacy deep imports, `@bquery/bquery/security/sanitize` also re-exports `generateNonce()` and `isTrustedTypesSupported()`.

```ts
import { sanitize, escapeHtml } from '@bquery/bquery/security';

// Sanitize HTML (removes dangerous elements like script, iframe, svg)
const safeHtml = sanitize(userInput);

// DOM clobbering protection (reserved IDs are blocked)
const safe = sanitize('<form id="cookie">...</form>'); // id stripped

// Unicode bypass protection in URLs
const urlSafe = sanitize('<a href="java\u200Bscript:alert(1)">click</a>');

// Automatic link security (adds rel="noopener noreferrer" to external/target="_blank" links)
const secureLink = sanitize('<a href="https://external.com" target="_blank">Link</a>');

// Escape for text display
const escaped = escapeHtml('<script>alert(1)</script>');
```

### Platform – storage & APIs

```ts
import { storage, notifications } from '@bquery/bquery/platform';

// Unified storage API
const local = storage.local();
await local.set('theme', 'dark');
const theme = await local.get<string>('theme');

// Notifications
const permission = await notifications.requestPermission();
if (permission === 'granted') {
  notifications.send('Build complete', {
    body: 'Your docs are ready.',
  });
}
```

### Router – SPA navigation

Internally, the router has been split into focused submodules (matching, navigation, state, links, utilities) with no public API changes.

```ts
import { createRouter, navigate, currentRoute } from '@bquery/bquery/router';

// Create router with routes
const router = createRouter({
  routes: [
    { path: '/', name: 'home', component: HomePage },
    { path: '/user/:id', name: 'user', component: UserPage },
    { path: '*', component: NotFound },
  ],
});

// Navigation guards
router.beforeEach(async (to, from) => {
  if (to.path === '/admin' && !isAuthenticated()) {
    await navigate('/login'); // Redirect
    return false; // Cancel original navigation
  }
});

// Navigate programmatically
await navigate('/user/42');
await navigate('/search?q=bquery'); // Query params in path
await navigate('/login', { replace: true }); // Replace history entry

// Reactive current route
effect(() => {
  console.log('Current path:', currentRoute.value.path);
});
```

### Store – state management

```ts
import { createStore, createPersistedStore } from '@bquery/bquery/store';

// Define a store
const useCounter = createStore({
  id: 'counter',
  state: () => ({ count: 0, name: 'Counter' }),
  getters: {
    doubled: (state) => state.count * 2,
  },
  actions: {
    increment() {
      this.count++;
    },
    async fetchCount() {
      this.count = await api.getCount();
    },
  },
});

// Use the store
const counter = useCounter;
counter.increment();
console.log(counter.doubled); // Reactive getter

// Persisted store (localStorage)
const useSettings = createPersistedStore({
  id: 'settings',
  state: () => ({ theme: 'dark', language: 'en' }),
});

// Factory-style store definition
import { defineStore, mapGetters, watchStore } from '@bquery/bquery/store';

const useCounter = defineStore('counter', {
  state: () => ({ count: 0 }),
  getters: {
    doubled: (state) => state.count * 2,
  },
  actions: {
    increment() {
      this.count++;
    },
  },
});

const counter = useCounter();
const { doubled } = mapGetters(counter, ['doubled']);

watchStore(
  counter,
  (state) => state.count,
  (value) => {
    console.log('Count changed:', value, doubled);
  }
);
```

### View – declarative bindings

Internally modularized into focused submodules; the public API remains unchanged.

```ts
import { mount, createTemplate } from '@bquery/bquery/view';
import { signal } from '@bquery/bquery/reactive';

// Mount reactive bindings to DOM
const count = signal(0);
const items = signal(['Apple', 'Banana', 'Cherry']);

const app = mount('#app', {
  count,
  items,
  increment: () => count.value++,
});

// In HTML:
// <p bq-text="count"></p>
// <button bq-on:click="increment">+1</button>
// <ul><li bq-for="item in items" bq-text="item"></li></ul>
// <input bq-model="count" type="number" />
// <div bq-if="count > 5">Count is high!</div>
// <div bq-class="{ active: count > 0 }"></div>
```

## Browser Support

| Browser | Version | Support |
| ------- | ------- | ------- |
| Chrome  | 90+     | ✅ Full |
| Firefox | 90+     | ✅ Full |
| Safari  | 15+     | ✅ Full |
| Edge    | 90+     | ✅ Full |

> **No IE support** by design.

## Documentation

- **Getting Started**: [docs/guide/getting-started.md](docs/guide/getting-started.md)
- **Core API**: [docs/guide/api-core.md](docs/guide/api-core.md)
- **Agents**: [docs/guide/agents.md](docs/guide/agents.md)
- **Components**: [docs/guide/components.md](docs/guide/components.md)
- **Reactivity**: [docs/guide/reactive.md](docs/guide/reactive.md)
- **Motion**: [docs/guide/motion.md](docs/guide/motion.md)
- **Security**: [docs/guide/security.md](docs/guide/security.md)
- **Platform**: [docs/guide/platform.md](docs/guide/platform.md)
- **Router**: [docs/guide/router.md](docs/guide/router.md)
- **Store**: [docs/guide/store.md](docs/guide/store.md)
- **View**: [docs/guide/view.md](docs/guide/view.md)

## Local Development

```bash
# Install dependencies
bun install

# Start VitePress docs
bun run dev

# Run Vite playground
bun run playground

# Run tests
bun test

# Build library
bun run build

# Generate API documentation
bun run docs:api
```

## Project Structure

```text
bQuery.js
├── src/
│   ├── core/       # Selectors, DOM ops, events, utils
│   ├── reactive/   # Signals, computed, effects
│   ├── component/  # Web Components helper
│   ├── motion/     # View transitions, FLIP, springs
│   ├── security/   # Sanitizer, CSP, Trusted Types
│   ├── platform/   # Storage, cache, notifications
│   ├── router/     # SPA routing, navigation guards
│   ├── store/      # State management, persistence
│   └── view/       # Declarative DOM bindings
├── docs/           # VitePress documentation
├── playground/     # Vite demo app
├── tests/          # bun:test suites
└── dist/           # Built files (ESM, UMD, IIFE)
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT – See [LICENSE.md](LICENSE.md) for details.
