# FAQ & Troubleshooting

Common questions and solutions for bQuery.js — from first-time setup to production debugging.

## General

### What is bQuery.js?

bQuery.js is a TypeScript-first, zero-build-capable DOM library that brings modern platform features to vanilla JavaScript. Think of it as a bridge between jQuery's simplicity and a full framework's power — without the framework lock-in.

```ts
import { $, signal, effect } from '@bquery/bquery';

const count = signal(0);
effect(() => {
  $('#counter').text(`Count: ${count.value}`);
});

$('#increment').on('click', () => count.value++);
```

### How is bQuery different from jQuery?

| Feature            | jQuery                   | bQuery                                      |
| ------------------ | ------------------------ | ------------------------------------------- |
| Reactivity         | Manual DOM updates       | Signals, computed, effects                  |
| TypeScript         | Community types          | Built-in strict types                       |
| Security           | Raw `$(...).html()`      | Sanitized by default                        |
| Bundle             | ~87 kB minified          | Tree-shakeable, import only what you need   |
| Components         | None                     | Web Components with typed props             |
| Async Data         | `$.ajax()`               | Signals, fetch, polling, WebSocket, SSE     |
| Build Step         | None needed              | None needed (Vite optional)                 |

### Do I need a build step?

No. bQuery works directly in the browser via CDN:

```html
<script type="module">
  import { $, signal, effect } from 'https://cdn.jsdelivr.net/npm/@bquery/bquery@1/+esm';

  const name = signal('World');
  effect(() => $('#greeting').text(`Hello, ${name.value}!`));
</script>
```

For production apps, a bundler like Vite provides tree-shaking, TypeScript, and smaller bundles — but it's always optional.

### What browsers are supported?

Chrome 90+, Firefox 90+, Safari 15+, and Edge 90+. Internet Explorer is not supported.

### Can I use bQuery with React, Vue, or other frameworks?

bQuery is designed for vanilla JavaScript and standalone use. You _can_ use its reactive primitives alongside frameworks, but it's not designed as a drop-in for framework component trees. It shines in:

- Multi-page apps (MPAs)
- CMS themes (WordPress, Ghost, etc.)
- Rapid prototyping
- Modernizing legacy jQuery codebases
- Anywhere you want framework-level features without framework complexity

---

## Installation & Setup

### How do I install bQuery?

**Via package manager:**

```bash
# npm
npm install @bquery/bquery

# bun (recommended)
bun add @bquery/bquery

# pnpm
pnpm add @bquery/bquery
```

**Via CDN (no install needed):**

```html
<script type="module">
  import { $ } from 'https://cdn.jsdelivr.net/npm/@bquery/bquery@1/+esm';
</script>
```

### How do I import specific modules?

Each module has its own entry point for optimal tree-shaking:

```ts
// Import only what you need
import { $, $$ } from '@bquery/bquery/core';
import { signal, computed, effect } from '@bquery/bquery/reactive';
import { createForm, required } from '@bquery/bquery/forms';
import { transition, spring } from '@bquery/bquery/motion';
import { sanitizeHtml } from '@bquery/bquery/security';
```

Or import everything at once:

```ts
import { $, signal, createForm, transition } from '@bquery/bquery';
```

### Why does `$()` throw an error?

`$()` throws if the element is not found in the DOM. This is intentional — it prevents silent bugs from missing elements:

```ts
// ❌ Throws if #missing doesn't exist
const el = $('#missing');

// ✅ Use $$() for optional queries (returns empty collection)
const els = $$('#maybe-exists');
if (els.length > 0) {
  // element exists
}
```

### I see "Cannot find module '@bquery/bquery'" in my editor

Make sure you have:

1. Installed the package: `npm install @bquery/bquery`
2. A `tsconfig.json` with `"moduleResolution": "bundler"` or `"node16"`
3. Restarted your TypeScript server

---

## Reactivity

### When do I use `signal()` vs `computed()` vs `linkedSignal()`?

| Primitive         | Use case                                    | Writable |
| ----------------- | ------------------------------------------- | -------- |
| `signal(value)`   | Mutable state that you set directly         | ✅       |
| `computed(fn)`    | Derived value that auto-updates             | ❌       |
| `linkedSignal(fn)`| Derived value that you _can_ override       | ✅       |

```ts
const firstName = signal('Ada');
const lastName = signal('Lovelace');
const fullName = computed(() => `${firstName.value} ${lastName.value}`);
// fullName.value → 'Ada Lovelace' (read-only, updates automatically)
```

### What is the difference between `.value` and `.peek()`?

- `.value` — reads the signal and **subscribes** the current effect/computed to changes
- `.peek()` — reads without subscribing (no reactive tracking)

```ts
effect(() => {
  console.log(count.value);  // re-runs when count changes
  console.log(count.peek()); // reads current value, but won't trigger re-run
});
```

### Why is my effect not running?

Common causes:

1. **No `.value` read inside the effect** — effects only track signals accessed via `.value`
2. **Using `.peek()` instead of `.value`** — `.peek()` doesn't create subscriptions
3. **Signal changed before the effect was created** — effects run once immediately, then on changes
4. **Reading signals conditionally** — if a branch isn't reached, those signals won't be tracked

```ts
// ❌ Won't track — no .value access
effect(() => {
  const data = mySignal; // just the signal object, not its value
});

// ✅ Tracks correctly
effect(() => {
  const data = mySignal.value; // subscribes to changes
});
```

### How do I stop an effect?

`effect()` returns a dispose function:

```ts
const stop = effect(() => {
  console.log(count.value);
});

// Later, stop watching
stop();
```

For scoped cleanup, use `effectScope()`:

```ts
import { effectScope } from '@bquery/bquery/reactive';

const scope = effectScope();
scope.run(() => {
  effect(() => { /* ... */ });
  effect(() => { /* ... */ });
});

// Dispose all effects at once
scope.stop();
```

---

## Components

### How do I create a Web Component?

```ts
import { component, html } from '@bquery/bquery/component';

component('my-greeting', {
  props: { name: 'World' },
  render({ props }) {
    return html`<p>Hello, ${props.name}!</p>`;
  },
});
```

```html
<my-greeting name="bQuery"></my-greeting>
```

### Why isn't my component rendering?

1. **Component not registered** — make sure `component()` is called before the element appears in the DOM
2. **Name must contain a hyphen** — Web Component names require a dash: `my-component`, not `mycomponent`
3. **Script loaded after DOM** — use `type="module"` or `defer` to ensure scripts run in order

---

## Forms

### How do I validate a form?

```ts
import { createForm, required, email } from '@bquery/bquery/forms';

const form = createForm({
  fields: {
    email: { initialValue: '', validators: [required(), email()] },
    password: { initialValue: '', validators: [required()] },
  },
  onSubmit: async (values) => {
    await fetch('/api/login', {
      method: 'POST',
      body: JSON.stringify(values),
    });
  },
});

// Check validation state
console.log(form.isValid.value);       // false initially
console.log(form.fields.email.error.value); // 'Required'
```

### How do I show server-side validation errors?

```ts
const result = await submitToServer(form.getValues());
if (result.errors) {
  form.setErrors(result.errors); // { email: 'Already registered' }
}
```

---

## Security

### Is bQuery safe against XSS?

Yes, by default. All HTML-writing APIs sanitize content automatically:

```ts
const userInput = '<script>alert("xss")</script>';

// ✅ Sanitized — script tags are stripped
$('#output').html(userInput);

// For trusted content from your own code, use .raw
$('#output').raw.innerHTML = trustedContent;
```

### What is Trusted Types support?

bQuery is compatible with the [Trusted Types API](https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API), which provides an additional layer of XSS protection enforced by the browser. See the [Security guide](/guide/security) for setup details.

---

## Performance

### How do I batch multiple signal updates?

Use `batch()` to group updates and prevent unnecessary re-renders:

```ts
import { batch, signal, effect } from '@bquery/bquery/reactive';

const firstName = signal('');
const lastName = signal('');

effect(() => {
  console.log(`${firstName.value} ${lastName.value}`);
});

// ✅ Effect runs once with both values updated
batch(() => {
  firstName.value = 'Ada';
  lastName.value = 'Lovelace';
});
```

### My page is slow — how do I optimize?

1. **Use `batch()`** to group signal updates
2. **Use `$$()` instead of `$()` in loops** to avoid throwing on missing elements
3. **Import only what you need** — granular imports reduce bundle size
4. **Use `untrack()`** when reading signals without needing reactivity
5. **Use `effectScope()`** to clean up effects when removing dynamic UI sections

---

## View Module

### What does `mount()` do?

`mount()` connects reactive state to HTML using declarative directives:

```html
<div id="app">
  <p bq-text="greeting"></p>
  <input bq-model="name" />
</div>
```

```ts
import { mount, signal } from '@bquery/bquery/view';

const name = signal('World');
const greeting = signal('Hello!');

mount('#app', { name, greeting });
```

### What directives are available?

| Directive      | Purpose                          |
| -------------- | -------------------------------- |
| `bq-text`      | Set text content                 |
| `bq-html`      | Set inner HTML (sanitized)       |
| `bq-if`        | Conditionally show/remove        |
| `bq-show`      | Toggle visibility (CSS)          |
| `bq-class`     | Toggle CSS classes               |
| `bq-style`     | Set inline styles                |
| `bq-for`       | Repeat elements for a list       |
| `bq-model`     | Two-way input binding            |
| `bq-bind`      | Bind attributes                  |
| `bq-on`        | Attach event listeners           |
| `bq-error`     | Display form validation errors   |
| `bq-aria`      | Reactive ARIA attribute binding  |

---

## Router

### How do I set up client-side routing?

```ts
import { effect } from '@bquery/bquery/reactive';
import { createRouter, navigate, currentRoute } from '@bquery/bquery/router';

createRouter({
  routes: [
    { path: '/', component: () => showPage('home') },
    { path: '/about', component: () => showPage('about') },
    { path: '/user/:id', component: () => showUser(currentRoute.value.params.id) },
  ],
});

// createRouter() tracks the current route; render the matched view in an effect.
effect(() => {
  const component = currentRoute.value.matched?.component;
  if (!component) return;

  const result = component();
  if (result instanceof Promise) {
    void result.catch((error) => console.error('Route render failed', error));
  }
});

// Navigate programmatically
navigate('/about');

// Read current route reactively
effect(() => {
  console.log(currentRoute.value.path);
});
```

---

## Debugging

### How do I inspect signals at runtime?

```ts
import { signal } from '@bquery/bquery/reactive';
import { enableDevtools, inspectSignals, logSignals, trackSignal } from '@bquery/bquery/devtools';

const count = signal(0);

enableDevtools(true);
trackSignal('count', () => count.peek(), () => 0);
console.table(inspectSignals());
logSignals(); // prints all tracked signals to console
```

### How do I debug reactive updates?

Use `watch()` to log signal changes:

```ts
import { watch } from '@bquery/bquery/reactive';

watch(mySignal, (newVal, oldVal) => {
  console.log('Changed:', oldVal, '→', newVal);
});
```

---

## Build & Development

### What are the development commands?

```bash
bun install          # install dependencies
bun test             # run tests
bun run build        # production build
bun run lint         # lint with ESLint
bun run lint:types   # TypeScript type check
bun run dev          # VitePress docs server
bun run storybook    # Storybook dev server
```

### How do I contribute?

See the [Contributing guide](https://github.com/bQuery/bQuery/blob/main/CONTRIBUTING.md). In short:

1. Fork and clone the repo
2. `bun install`
3. Make small, focused changes
4. Add tests for new features
5. Run `bun test` and `bun run lint`
6. Open a PR with a clear description

---

## Still stuck?

If your question isn't answered here:

1. Check the [Getting Started guide](/guide/getting-started) for setup issues
2. Browse the module-specific guides in the sidebar
3. Search existing [GitHub Issues](https://github.com/bQuery/bQuery/issues)
4. Open a new issue if you've found a bug
