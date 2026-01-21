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
      import { $, signal, effect } from 'https://unpkg.com/bQuery@1/full.js';

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
npm install bquery

# bun
bun add bquery

# pnpm
pnpm add bquery
```

### Vite + TypeScript

```ts
import { $, signal, effect } from 'bquery';

const count = signal(0);

effect(() => {
  $('#counter').text(`Count: ${count.value}`);
});
```

## Module Imports

bQuery is modular by design. You can import everything from the main entry point or pick specific modules:

```ts
// Full import
import { $, signal, component, transition, sanitize, storage } from 'bquery';

// Core only (selectors, DOM, events)
import { $, $$, utils } from 'bquery/core';

// Reactive only (signals, computed, effects)
import { signal, computed, effect, batch } from 'bquery/reactive';

// Components only (Web Components)
import { component, html } from 'bquery/component';

// Motion only (transitions, animations)
import { transition, spring, flip } from 'bquery/motion';

// Security only (sanitization)
import { sanitize, escapeHtml } from 'bquery/security';

// Platform only (storage, cache, notifications)
import { storage, cache, notifications, buckets } from 'bquery/platform';
```

## Quick Examples

### DOM Manipulation

```ts
import { $ } from 'bquery/core';

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
import { signal, computed, effect } from 'bquery/reactive';

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

### Web Components

```ts
import { component, html } from 'bquery/component';

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

## Local Development

If you're developing bQuery itself:

```bash
# Install dependencies
bun install

# Start documentation dev server
bun run dev

# Start playground demo
bun run playground

# Run tests
bun test

# Build documentation
bun run build
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
- [Reactive](./reactive.md) - Understand signals and reactivity
- [Components](./components.md) - Build Web Components
- [Motion](./motion.md) - Add animations and transitions
- [Security](./security.md) - Sanitization and CSP
