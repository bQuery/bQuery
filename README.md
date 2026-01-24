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
```

## Modules at a glance

| Module        | Description                                    | Size (gzip) |
| ------------- | ---------------------------------------------- | ----------- |
| **Core**      | Selectors, DOM manipulation, events, utilities | ~6 KB       |
| **Reactive**  | `signal`, `computed`, `effect`, `batch`        | ~1 KB       |
| **Component** | Lightweight Web Components with props          | ~1.3 KB     |
| **Motion**    | View transitions, FLIP animations, springs     | ~1.2 KB     |
| **Security**  | HTML sanitizing, Trusted Types, CSP            | ~1.6 KB     |
| **Platform**  | Storage, cache, notifications, buckets         | ~1.7 KB     |

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

// Smooth scrolling
$('#section').scrollTo({ behavior: 'smooth' });

// Form serialization
const formData = $('form').serialize(); // Returns object
const queryString = $('form').serializeString(); // Returns URL-encoded string

// Collections
$$('.items').addClass('highlight');
```

### Reactive – signals

```ts
import { signal, computed, effect, batch, watch, readonly } from '@bquery/bquery/reactive';

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
```

### Components – Web Components

```ts
import { component, html } from '@bquery/bquery/component';

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
```

### Motion – animations

```ts
import { transition, spring } from '@bquery/bquery/motion';

// View transitions (with fallback)
await transition(() => {
  $('#content').text('Updated');
});

// Spring physics
const x = spring(0, { stiffness: 120, damping: 14 });
x.onChange((value) => {
  element.style.transform = `translateX(${value}px)`;
});
await x.to(100);
```

### Security – sanitizing

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
│   └── platform/   # Storage, cache, notifications
├── docs/           # VitePress documentation
├── playground/     # Vite demo app
├── tests/          # bun:test suites
└── dist/           # Built files (ESM, UMD, IIFE)
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT – See [LICENSE.md](LICENSE.md) for details.
