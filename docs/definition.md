# bQuery.js — Framework Specification v1.0

> _"The jQuery for the Modern Web Platform"_

---

## 1. Philosophy & Design Principles

### 1.1 Mission Statement

bQuery.js bridges **vanilla JavaScript** and **build-step frameworks**. It offers modern features (reactivity, components, motion) with the simplicity and directness that made jQuery successful.

### 1.2 Core Principles

| Principle                    | Description                                                                            |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| **Zero Build**               | Works directly in the browser via CDN or ES Modules. Vite is optional for development. |
| **Progressive Enhancement**  | Enhances native HTML/JS without replacing it. Every feature is opt-in.                 |
| **Secure by Default**        | DOM writes are sanitized by default. CSP- and Trusted-Types-compatible.                |
| **Predictable & Debuggable** | No virtual DOM or hidden magic. State changes map directly to DOM updates.             |
| **Tiny Footprint**           | Core stays minimal. Extra modules are lazy-loadable and tree-shakeable.                |
| **Typed & Documented**       | TypeScript-first APIs with inline TSDoc for every public surface.                      |

### 1.3 Target Audience

- Developers building **multi-page applications** (MPAs)
- **CMS/WordPress themes** with interactive blocks
- **Prototyping** and fast UI experiments
- **Legacy projects** modernizing incrementally
- Teams avoiding **React/Vue overhead**

---

## 2. Architecture

### 2.1 Modular Layout

```text
bQuery.js
├── @core       (selectors, DOM ops, events, utils)
├── @reactive   (signals, computed, effects, binding)
├── @component  (define, template, lifecycle, shadow DOM)
├── @motion     (view transitions, FLIP, springs)
└── @security   (sanitizer, CSP compatibility, Trusted Types)
```

### 2.2 Import Strategies

```ts
// Full bundle (CDN, zero build)
import { $, signal, component } from 'https://unpkg.com/bQuery@1/full.js';

// Core only
import { $ } from 'bquery/core';

// À la carte
import { $, $$ } from 'bquery/core';
import { signal, computed } from 'bquery/reactive';
```

### 2.3 OOP Core Contracts

The core is intentionally object-oriented to keep DOM operations **predictable**, **chainable**, and **discoverable**.

```ts
/**
 * OOP wrapper for a single DOM element.
 * - Keeps API chainable
 * - Encapsulates read/write operations
 */
class BQueryElement {
  /** The underlying native element (read-only). */
  readonly node: Element;

  /**
   * Add a CSS class and return `this` for chaining.
   */
  addClass(name: string): this;

  /**
   * Set HTML with sanitization by default.
   */
  html(value: string): this;
}

/**
 * Collection wrapper for multiple DOM elements.
 */
class BQueryCollection {
  /** Total matched elements. */
  readonly length: number;
  /** Iterate each matched element. */
  each(fn: (el: BQueryElement, index: number) => void): this;
}
```

### 2.4 DRY Architecture Rules

- **Single source of truth** for selectors and DOM helpers in `src/core/shared.ts`.
- **Reusable primitives** (signals/effects) live in `src/reactive/signal.ts`.
- **Cross-module utilities** only in `src/core/utils.ts` to avoid duplication.
- **Module boundaries are strict**: no cross-imports that create circular dependencies.

---

---

## 3. API Reference

### 3.1 Core Module (`@core`)

#### 3.1.1 Selectors

```ts
const button = $('#submit');
const items = $$('.item');
```

#### 3.1.2 DOM Manipulation

```ts
$('#box').addClass('active').css({ opacity: '0.8' }).attr('data-state', 'ready');

$('#content').text('Hello');
$('#content').html('<b>Bold</b>'); // sanitized by default
```

#### 3.1.3 Events

```ts
$('#save').on('click', (event) => {
  console.log('Saved', event.type);
});
```

#### 3.1.4 Utilities

```ts
import { utils } from 'bquery/core';

const id = utils.uid();
const config = utils.merge({ a: 1 }, { b: 2 });
```

#### 3.1.5 In-Code Documentation (TSDoc)

All public APIs include inline documentation for IDEs and generated docs.

```ts
/**
 * Create a unique, stable ID scoped to the current session.
 * @returns A short, collision-resistant string.
 */
export function uid(): string;
```

---

### 3.2 Reactive Module (`@reactive`)

```ts
import { signal, computed, effect, batch } from 'bquery/reactive';

const count = signal(0);
const doubled = computed(() => count.value * 2);

effect(() => {
  console.log(count.value);
});

batch(() => {
  count.value = 1;
  count.value = 2;
});
```

#### 3.2.1 Reactive Contracts

- `signal<T>` exposes **mutable state** via `.value`.
- `computed<T>` is **pure and lazy**; no side-effects inside.
- `effect` is **side-effect only**; no state writes unless wrapped in `batch`.

---

### 3.3 Component Module (`@component`)

```ts
import { component, html } from 'bquery/component';

component('user-card', {
  props: {
    username: { type: String, required: true },
  },
  render({ props }) {
    return html`<div>Hello ${props.username}</div>`;
  },
});
```

#### 3.3.1 Component Lifecycle

- `connected` → runs when the element mounts.
- `disconnected` → runs on teardown.
- `updated` → runs after reactive props change.

---

### 3.4 Motion Module (`@motion`)

```ts
import { transition } from 'bquery/motion';

await transition(() => {
  $('#content').text('Updated');
});
```

---

### 3.5 Security Module (`@security`)

```ts
import { sanitize } from 'bquery/security';

const safeHtml = sanitize(userInput);
```

---

### 3.6 Platform Module (`@platform`)

Unified endpoints for web platform storage and system APIs. The goal is a consistent, promise-based interface with predictable errors.

#### 3.6.1 Storage Adapters

```ts
import { storage } from 'bquery/platform';

// localStorage
const local = storage.local();
await local.set('theme', 'dark');
const theme = await local.get<string>('theme');

// sessionStorage
const session = storage.session();
await session.set('wizardStep', 2);

// IndexedDB (key-value facade)
const db = storage.indexedDB({ name: 'bquery', store: 'kv' });
await db.set('user', { id: 1, name: 'Ada' });
const user = await db.get<{ id: number; name: string }>('user');
```

##### Adapter Interface

```ts
type StorageAdapter = {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
};
```

#### 3.6.2 Storage Buckets

```ts
import { buckets } from 'bquery/platform';

const bucket = await buckets.open('assets');
await bucket.put('avatar', new Blob(['...']));
const avatar = await bucket.get('avatar');
await bucket.remove('avatar');
```

#### 3.6.3 Notifications

```ts
import { notifications } from 'bquery/platform';

const permission = await notifications.requestPermission();
if (permission === 'granted') {
  notifications.send('Build complete', {
    body: 'Your docs are ready.',
  });
}
```

#### 3.6.4 Cache Storage

```ts
import { cache } from 'bquery/platform';

const assets = await cache.open('bquery-assets');
await assets.add('/styles.css');
const response = await assets.match('/styles.css');
await assets.remove('/styles.css');
```

---

---

## 4. Implementation Notes

### 4.1 TypeScript First

- Public APIs are typed.
- Internal modules are organized by capability (`core`, `reactive`, `component`, `motion`, `security`).
- OOP wrappers (`BQueryElement`, `BQueryCollection`) keep DOM operations predictable and chainable.

### 4.2 Documentation in Code

- Use **TSDoc** on every exported function/class/type.
- Keep examples **copy-pasteable** and minimal.
- Document **default behavior** (e.g., sanitization, event delegation).

### 4.3 DRY Conventions

- No duplicated DOM helpers or selector logic across modules.
- Shared type definitions live in a single module per domain.
- Prefer composition over inheritance for new features.

### 4.4 Error Handling

- Public APIs return **predictable** errors with descriptive messages.
- Async platform APIs always reject with `Error` instances.
- Errors never expose sensitive HTML content.

---

## 5. Tooling & Project Structure

This repo uses **Bun**, **Vite**, **VitePress**, and **TypeScript**.

```text
.
├── docs/                 # VitePress site
├── playground/           # Vite demo app
├── src/                  # TypeScript source
├── tests/                # bun:test suites
├── package.json
└── tsconfig.json
```

### 5.1 Scripts

- `bun run dev` — VitePress docs
- `bun run build` — Build docs
- `bun run preview` — Preview docs
- `bun run playground` — Vite playground
- `bun test` — Run tests

### 5.2 Tooling Contracts

- **Bun** is the runtime and test runner. No Node-only globals in source.
- **Vite** powers the playground and local dev builds.
- **VitePress** builds the documentation site from `docs/`.
- **TypeScript** is required for all public APIs and examples.

### 5.3 Local Development Flow

1. `bun install`
2. `bun run dev` (docs)
3. `bun run playground` (examples)
4. `bun test` (verify behavior)

---

## 6. Testing Strategy

- Unit tests live in `tests/` and run via `bun test`.
- Each module has a dedicated test file (e.g., `core.test.ts`).
- Tests must cover **happy path** and **edge cases** (empty selections, null inputs, invalid HTML).
- Keep tests **isolated** and **deterministic**.

## 7. Compatibility

| Browser | Version | Support |
| ------- | ------- | ------- |
| Chrome  | 90+     | ✅ Full |
| Firefox | 90+     | ✅ Full |
| Safari  | 15+     | ✅ Full |
| Edge    | 90+     | ✅ Full |

> **No IE support** by design.
