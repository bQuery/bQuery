<p align="center">
  <img src="https://raw.githubusercontent.com/bQuery/bQuery/main/assets/bquerry-logo.svg" alt="bQuery.js Logo" width="120" />
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
[![JsDelivr](https://data.jsdelivr.com/v1/package/npm/@bquery/bquery/badge)](https://www.jsdelivr.com/package/npm/@bquery/bquery)

</p>

**The jQuery for the modern Web Platform.**

bQuery.js is a slim, TypeScript-first library that combines jQuery's direct DOM workflow with modern features like reactivity, async data composables, HTTP clients, polling and pagination helpers, realtime transports, REST workflows, Web Components, motion utilities, routing, stores, declarative views, accessibility helpers, forms, i18n, media signals, drag-and-drop, plugins, devtools, testing utilities, and SSR — without a mandatory build step.

> **New in 1.8.0:** the Reactive module now also covers transport-ready workflows such as `createHttp()`, `usePolling()`, `usePaginatedFetch()`, `useInfiniteFetch()`, `useWebSocket()`, `useEventSource()`, `useResource()`, `useSubmit()`, `createRequestQueue()`, and `deduplicateRequest()`.

## Highlights

- **Zero-build capable**: runs directly in the browser; build tools are optional.
- **Transport-ready reactive data**: fetch composables, HTTP clients, polling, pagination, WebSocket / SSE, REST helpers, and request coordination plug directly into signals.
- **Security-focused**: DOM writes are sanitized by default; Trusted Types supported.
- **Modular**: the core stays small; extra modules are opt-in.
- **TypeScript-first**: clear types and strong IDE support.
- **Tree-shakeable**: import only what you need.
- **Storybook-ready**: default components can be previewed and developed in Storybook with dedicated story template helpers.

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

## Import Strategies

```ts
// Full bundle (all modules)
import {
  $,
  signal,
  component,
  registerDefaultComponents,
  defineBqueryConfig,
} from '@bquery/bquery';

// Core only
import { $, $$ } from '@bquery/bquery/core';

// Core utilities (named exports, tree-shakeable)
import { debounce, merge, uid, once, utils } from '@bquery/bquery/core';

// Reactive only
import {
  signal,
  computed,
  effect,
  linkedSignal,
  persistedSignal,
  useAsyncData,
  useFetch,
  createUseFetch,
  createHttp,
  http,
  usePolling,
  usePaginatedFetch,
  useInfiniteFetch,
  useWebSocket,
  useWebSocketChannel,
  useEventSource,
  useResource,
  useResourceList,
  useSubmit,
  createRestClient,
  createRequestQueue,
  deduplicateRequest,
} from '@bquery/bquery/reactive';

// Components only
import {
  bool,
  component,
  defineComponent,
  html,
  registerDefaultComponents,
} from '@bquery/bquery/component';

// Motion only
import { transition, spring, animate, timeline } from '@bquery/bquery/motion';

// Security only
import { sanitize, sanitizeHtml, trusted } from '@bquery/bquery/security';

// Platform only
import { storage, cache, useCookie, definePageMeta, useAnnouncer } from '@bquery/bquery/platform';

// Router, Store, View
import { createRouter, navigate } from '@bquery/bquery/router';
import { createStore, defineStore } from '@bquery/bquery/store';
import { mount, createTemplate } from '@bquery/bquery/view';

// Forms, i18n, accessibility, drag & drop, media
import { createForm, required, email } from '@bquery/bquery/forms';
import { createI18n } from '@bquery/bquery/i18n';
import { trapFocus, rovingTabIndex } from '@bquery/bquery/a11y';
import { draggable, droppable, sortable } from '@bquery/bquery/dnd';
import { mediaQuery, useViewport, clipboard } from '@bquery/bquery/media';

// Plugins, devtools, testing, SSR
import { use } from '@bquery/bquery/plugin';
import { enableDevtools, inspectSignals } from '@bquery/bquery/devtools';
import { renderComponent, fireEvent, waitFor } from '@bquery/bquery/testing';
import { renderToString, hydrateMount, serializeStoreState } from '@bquery/bquery/ssr';

// Storybook helpers
import { storyHtml, when } from '@bquery/bquery/storybook';
```

## Modules at a glance

| Module        | Description                                                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Core**      | Selectors, DOM manipulation, events, traversal, and typed utilities                                              |
| **Reactive**  | `signal`, `computed`, `effect`, async data, HTTP clients, polling, pagination, WebSocket / SSE, and REST helpers |
| **Component** | Typed Web Components with scoped reactivity and configurable Shadow DOM                                          |
| **Storybook** | Safe story template helpers with boolean-attribute shorthand                                                     |
| **Motion**    | View transitions, FLIP, morphing, parallax, typewriter, springs, and timelines                                   |
| **Security**  | HTML sanitization, Trusted Types, CSP helpers, and trusted fragment composition                                  |
| **Platform**  | Storage, cache, cookies, page metadata, announcers, and shared runtime config                                    |
| **Router**    | SPA routing, constrained params, redirects, guards, `useRoute()`, and `<bq-link>`                                |
| **Store**     | Signal-based state management, persistence, migrations, and action hooks                                         |
| **View**      | Declarative DOM bindings, directives, and plugin-provided custom directives                                      |
| **Forms**     | Reactive form state with sync/async validation and submit handling                                               |
| **i18n**      | Reactive locales, interpolation, pluralization, lazy loading, and Intl formatting                                |
| **A11y**      | Focus traps, live-region announcements, roving tabindex, skip links, and audits                                  |
| **DnD**       | Draggable elements, droppable zones, and sortable lists                                                          |
| **Media**     | Reactive browser/device signals for viewport, network, battery, geolocation, and more                            |
| **Plugin**    | Global plugin registration for custom directives and Web Components                                              |
| **Devtools**  | Runtime inspection helpers for signals, stores, components, and timelines                                        |
| **Testing**   | Component mounting, mock signals/router helpers, and async test utilities                                        |
| **SSR**       | Server-side rendering, hydration, and store-state serialization                                                  |

Storybook authoring helpers are also available as a dedicated entry point via `@bquery/bquery/storybook`.

## Quick examples

### Core – DOM & events

```ts
import { $, $$ } from '@bquery/bquery/core';

$('#save').on('click', (event) => {
  console.log('Saved', event.type);
});

$('#list').delegate('click', '.item', (event, target) => {
  console.log('Item clicked', target.textContent);
});

$('#box').addClass('active').css({ opacity: '0.8' }).attr('data-state', 'ready');

const color = $('#box').css('color');

if ($('#el').is('.active')) {
  console.log('Element is active');
}

$$('.container').find('.item').addClass('found');
```

### Reactive – signals

```ts
import {
  signal,
  computed,
  effect,
  batch,
  watch,
  watchDebounce,
  watchThrottle,
  readonly,
  linkedSignal,
} from '@bquery/bquery/reactive';

const count = signal(0);
const doubled = computed(() => count.value * 2);

effect(() => {
  console.log('Count changed', count.value);
});

watch(count, (newVal, oldVal) => {
  console.log(`Changed from ${oldVal} to ${newVal}`);
});

watchDebounce(count, (newVal) => {
  console.log('Debounced count', newVal);
}, 150);

const readOnlyCount = readonly(count);

batch(() => {
  count.value++;
  count.value++;
});

count.dispose();

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

### Reactive – async data & fetch

```ts
import { signal, useFetch, createUseFetch } from '@bquery/bquery/reactive';

const userId = signal(1);

const user = useFetch<{ id: number; name: string }>(() => `/users/${userId.value}`, {
  baseUrl: 'https://api.example.com',
  watch: [userId],
  query: { include: 'profile' },
});

const useApiFetch = createUseFetch({
  baseUrl: 'https://api.example.com',
  headers: { 'x-client': 'bquery-readme' },
});

const settings = useApiFetch<{ theme: string }>('/settings');

console.log(user.pending.value, user.data.value, settings.error.value);
```

### Reactive – HTTP, streaming & request coordination

```ts
import {
  createHttp,
  createRequestQueue,
  deduplicateRequest,
  useEventSource,
  useWebSocket,
} from '@bquery/bquery/reactive';

const api = createHttp({
  baseUrl: 'https://api.example.com',
  retry: {
    count: 2,
    onRetry: (error, attempt) => console.warn(`Retry #${attempt}`, error.message),
  },
});

const queue = createRequestQueue({ concurrency: 4 });
const ws = useWebSocket<{ type: string; payload: unknown }>('wss://api.example.com/live');
const sse = useEventSource<{ token: string }>('/api/stream');

const users = await deduplicateRequest('/users', () => queue.add(() => api.get('/users')));

console.log(users.data, ws.status.value, sse.eventName.value);
```

### Components – Web Components

```ts
import {
  bool,
  component,
  defineComponent,
  html,
  registerDefaultComponents,
  safeHtml,
} from '@bquery/bquery/component';
import { sanitizeHtml, trusted } from '@bquery/bquery/security';

const badge = trusted(sanitizeHtml('<span class="badge">Active</span>'));

component('user-card', {
  props: {
    username: { type: String, required: true },
    age: { type: Number, validator: (v) => v >= 0 && v <= 150 },
  },
  state: { count: 0 },
  beforeMount() {
    console.log('About to mount');
  },
  connected() {
    console.log('Mounted');
  },
  beforeUpdate(newProps, oldProps) {
    return newProps.username !== oldProps.username;
  },
  updated(change) {
    console.log('Updated because of', change?.name ?? 'state/signal change');
  },
  onError(error) {
    console.error('Component error:', error);
  },
  render({ props, state }) {
    return safeHtml`
      <button class="user-card" ${bool('disabled', state.count > 3)}>
        ${badge}
        <span>Hello ${props.username}</span>
      </button>
    `;
  },
});

const UserCard = defineComponent('user-card-manual', {
  props: { username: { type: String, required: true } },
  render: ({ props }) => html`<div>Hello ${props.username}</div>`,
});

customElements.define('user-card-manual', UserCard);

const tags = registerDefaultComponents({ prefix: 'ui' });
console.log(tags.button); // ui-button
```

### Storybook – authoring helpers

```ts
import { storyHtml, when } from '@bquery/bquery/storybook';

export const Primary = {
  args: { disabled: false, label: 'Save' },
  render: ({ disabled, label }) =>
    storyHtml`
      <ui-card>
        <ui-button ?disabled=${disabled}>${label}</ui-button>
        ${when(!disabled, '<small>Ready to submit</small>')}
      </ui-card>
    `,
};
```

### Motion – animations

```ts
import { animate, keyframePresets, spring, transition } from '@bquery/bquery/motion';

await transition({
  update: () => {
    $('#content').text('Updated');
  },
  classes: ['page-transition'],
  types: ['navigation'],
  skipOnReducedMotion: true,
});

await animate(card, {
  keyframes: keyframePresets.pop(),
  options: { duration: 240, easing: 'ease-out' },
});

const x = spring(0, { stiffness: 120, damping: 14 });
x.onChange((value) => {
  element.style.transform = `translateX(${value}px)`;
});
await x.to(100);
```

### Security – sanitizing

```ts
import { sanitize, escapeHtml, sanitizeHtml, trusted } from '@bquery/bquery/security';
import { safeHtml } from '@bquery/bquery/component';

const safeMarkup = sanitize(userInput);
const safe = sanitize('<form id="cookie">...</form>');
const urlSafe = sanitize('<a href="java\u200Bscript:alert(1)">click</a>');
const secureLink = sanitize('<a href="https://external.com" target="_blank">Link</a>');
const safeSrcset = sanitize('<img srcset="safe.jpg 1x, javascript:alert(1) 2x">');
const safeForm = sanitize('<form action="javascript:alert(1)">...</form>');
const escaped = escapeHtml('<script>alert(1)</script>');
const icon = trusted(sanitizeHtml('<span class="icon">♥</span>'));
const button = safeHtml`<button>${icon}<span>Save</span></button>`;
```

### Platform – config, cookies & accessibility

```ts
import {
  defineBqueryConfig,
  useCookie,
  definePageMeta,
  useAnnouncer,
  storage,
  notifications,
} from '@bquery/bquery/platform';

defineBqueryConfig({
  fetch: { baseUrl: 'https://api.example.com' },
  transitions: { skipOnReducedMotion: true, classes: ['page-transition'] },
  components: { prefix: 'ui' },
});

const theme = useCookie<'light' | 'dark'>('theme', { defaultValue: 'light' });
const cleanupMeta = definePageMeta({ title: 'Dashboard' });
const announcer = useAnnouncer();

theme.value = 'dark';
announcer.announce('Preferences saved');
cleanupMeta();

const local = storage.local();
await local.set('theme', theme.value);

const permission = await notifications.requestPermission();
if (permission === 'granted') {
  notifications.send('Build complete', {
    body: 'Your docs are ready.',
  });
}
```

### Router – SPA navigation

```ts
import { effect } from '@bquery/bquery/reactive';
import { createRouter, navigate, currentRoute } from '@bquery/bquery/router';

const router = createRouter({
  routes: [
    { path: '/', name: 'home', component: HomePage },
    { path: '/user/:id', name: 'user', component: UserPage },
    { path: '*', component: NotFound },
  ],
});

router.beforeEach(async (to) => {
  if (to.path === '/admin' && !isAuthenticated()) {
    await navigate('/login');
    return false;
  }
});

effect(() => {
  console.log('Current path:', currentRoute.value.path);
});
```

### Forms – reactive validation

```ts
import { createForm, email, required } from '@bquery/bquery/forms';

const form = createForm({
  fields: {
    name: { initialValue: '', validators: [required()] },
    email: { initialValue: '', validators: [required(), email()] },
  },
  onSubmit: async (values) => {
    await fetch('/api/signup', {
      method: 'POST',
      body: JSON.stringify(values),
    });
  },
});

await form.handleSubmit();
console.log(form.isValid.value, form.fields.email.error.value);
```

### i18n – locale-aware content

```ts
import { createI18n } from '@bquery/bquery/i18n';

const i18n = createI18n({
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en: { greeting: 'Hello, {name}!' },
    de: { greeting: 'Hallo, {name}!' },
  },
});

console.log(i18n.t('greeting', { name: 'Ada' }));
i18n.$locale.value = 'de';
```

### Accessibility, media, and drag & drop

```ts
import { trapFocus, announceToScreenReader } from '@bquery/bquery/a11y';
import { mediaQuery, useViewport } from '@bquery/bquery/media';
import { draggable } from '@bquery/bquery/dnd';

const modalTrap = trapFocus(document.querySelector('#dialog')!);
announceToScreenReader('Dialog opened');

const isDark = mediaQuery('(prefers-color-scheme: dark)');
const viewport = useViewport();
const drag = draggable(document.querySelector('#card')!, { bounds: 'parent' });

console.log(isDark.value, viewport.value.width);

drag.destroy();
modalTrap.release();
```

### Plugins, devtools, testing, and SSR

```ts
import { use } from '@bquery/bquery/plugin';
import { enableDevtools, getTimeline } from '@bquery/bquery/devtools';
import { renderComponent, fireEvent } from '@bquery/bquery/testing';
import { renderToString } from '@bquery/bquery/ssr';

use({
  name: 'focus-plugin',
  install(ctx) {
    ctx.directive('focus', (el) => (el as HTMLElement).focus());
  },
});

enableDevtools(true, { logToConsole: true });
console.log(getTimeline());

const mounted = renderComponent('ui-button', { props: { variant: 'primary' } });
fireEvent(mounted.el, 'click');

const { html } = renderToString('<p bq-text="label"></p>', { label: 'Hello SSR' });
console.log(html);

mounted.unmount();
```

### Store – state management

```ts
import {
  createStore,
  createPersistedStore,
  defineStore,
  mapGetters,
  watchStore,
} from '@bquery/bquery/store';

const counterStore = createStore({
  id: 'counter',
  state: () => ({ count: 0, name: 'Counter' }),
  getters: {
    doubled: (state) => state.count * 2,
  },
  actions: {
    increment() {
      this.count++;
    },
  },
});

const settingsStore = createPersistedStore({
  id: 'settings',
  state: () => ({ theme: 'dark', language: 'en' }),
});

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
const getters = mapGetters(counter, ['doubled']);

watchStore(
  counter,
  (state) => state.count,
  (value) => {
    console.log('Count changed:', value, getters.doubled);
  }
);
```

### View – declarative bindings

```ts
import { mount, createTemplate } from '@bquery/bquery/view';
import { signal } from '@bquery/bquery/reactive';

const count = signal(0);
const items = signal(['Apple', 'Banana', 'Cherry']);

mount('#app', {
  count,
  items,
  increment: () => count.value++,
});
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
- **Storybook**: [docs/guide/storybook.md](docs/guide/storybook.md)
- **Reactivity**: [docs/guide/reactive.md](docs/guide/reactive.md)
- **Motion**: [docs/guide/motion.md](docs/guide/motion.md)
- **Security**: [docs/guide/security.md](docs/guide/security.md)
- **Platform**: [docs/guide/platform.md](docs/guide/platform.md)
- **Router**: [docs/guide/router.md](docs/guide/router.md)
- **Store**: [docs/guide/store.md](docs/guide/store.md)
- **View**: [docs/guide/view.md](docs/guide/view.md)
- **Forms**: [docs/guide/forms.md](docs/guide/forms.md)
- **i18n**: [docs/guide/i18n.md](docs/guide/i18n.md)
- **Accessibility**: [docs/guide/a11y.md](docs/guide/a11y.md)
- **Drag & Drop**: [docs/guide/dnd.md](docs/guide/dnd.md)
- **Media**: [docs/guide/media.md](docs/guide/media.md)
- **Plugin System**: [docs/guide/plugin.md](docs/guide/plugin.md)
- **Devtools**: [docs/guide/devtools.md](docs/guide/devtools.md)
- **Testing Utilities**: [docs/guide/testing.md](docs/guide/testing.md)
- **SSR / Hydration**: [docs/guide/ssr.md](docs/guide/ssr.md)

## Local Development

```bash
# Install dependencies
bun install

# Start VitePress docs
bun run dev

# Run Storybook
bun run storybook

# Run tests
bun test

# Build library
bun run build

# Build docs
bun run build:docs

# Generate API documentation
bun run docs:api
```

## Project Structure

```text
bQuery.js
├── src/
│   ├── core/       # Selectors, DOM ops, events, utils
│   ├── reactive/   # Signals, computed, effects, async data
│   ├── component/  # Web Components helper + default library
│   ├── storybook/  # Story template helpers
│   ├── motion/     # View transitions, FLIP, springs
│   ├── security/   # Sanitizer, CSP, Trusted Types
│   ├── platform/   # Storage, cache, cookies, meta, config
│   ├── router/     # SPA routing, navigation guards
│   ├── store/      # State management, persistence
│   ├── view/       # Declarative DOM bindings
│   ├── forms/      # Reactive forms + validators
│   ├── i18n/       # Internationalization + formatting
│   ├── a11y/       # Accessibility utilities
│   ├── dnd/        # Drag & drop helpers
│   ├── media/      # Browser and device reactive signals
│   ├── plugin/     # Global plugin system
│   ├── devtools/   # Runtime inspection helpers
│   ├── testing/    # Test utilities
│   └── ssr/        # Server-side rendering + hydration
├── docs/           # VitePress documentation
├── .storybook/     # Storybook config
├── stories/        # Component stories
├── tests/          # bun:test suites
└── dist/           # Built files (ESM, UMD, IIFE)
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## AI Agent Support

This project provides dedicated context files for AI coding agents:

- **[AGENT.md](AGENT.md)** — Architecture, module API reference, coding conventions, common tasks
- **[llms.txt](llms.txt)** — Compact LLM-optimized project summary
- **[.github/copilot-instructions.md](.github/copilot-instructions.md)** — GitHub Copilot context

## License

MIT – See [LICENSE.md](LICENSE.md) for details.
