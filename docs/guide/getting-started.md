# Getting Started

bQuery.js is designed for zero-build usage and modern build setups alike. You can start with plain HTML or use Vite for a fast dev server.

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

// Reactive only (signals, computed, effects, async composables)
import { signal, computed, effect, batch, useFetch, createUseFetch } from '@bquery/bquery/reactive';

// Components only (Web Components + default library)
import { component, html, registerDefaultComponents } from '@bquery/bquery/component';

// Motion only (transitions, animations)
import { transition, spring, flip } from '@bquery/bquery/motion';

// Security only (sanitization)
import { sanitize, escapeHtml } from '@bquery/bquery/security';

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
```

## Modules at a glance

| Module        | Description                                        | Size (gzip) |
| ------------- | -------------------------------------------------- | ----------- |
| **Core**      | Selectors, DOM manipulation, events, utilities     | ~8.1 KB     |
| **Reactive**  | `signal`, `computed`, `effect`, async data/fetch   | ~0.4 KB     |
| **Component** | Lightweight Web Components with props and defaults | ~1.6 KB     |
| **Motion**    | View transitions, FLIP, timelines, scroll, springs | ~3.5 KB     |
| **Security**  | HTML sanitizing, Trusted Types, CSP                | ~0.6 KB     |
| **Platform**  | Storage, cache, cookies, page meta, announcers     | ~1.6 KB     |
| **Router**    | SPA routing, navigation guards, history API        | ~2.0 KB     |
| **Store**     | Signal-based state management, persistence         | ~0.4 KB     |
| **View**      | Declarative DOM bindings, directives               | ~3.3 KB     |

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

- [Core API](./api-core.md) - Learn about selectors and DOM manipulation
- [Agents](./agents.md) - Build agent UIs with bQuery
- [Reactive](./reactive.md) - Understand signals and reactivity
- [Components](./components.md) - Build Web Components
- [Motion](./motion.md) - Add animations and transitions
- [Security](./security.md) - Sanitization and CSP
- [Platform](./platform.md) - Storage, cache, cookies, page meta, announcers, and config
