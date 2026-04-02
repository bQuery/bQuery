# Testing

The testing module provides focused helpers for mounting components, mocking reactive state, dispatching events, and waiting for async conditions. All utilities work with `bun:test` and `happy-dom`.

```ts
import {
  fireEvent,
  flushEffects,
  mockRouter,
  mockSignal,
  renderComponent,
  waitFor,
} from '@bquery/bquery/testing';
```

---

## Mounting Components

### `renderComponent()`

Mounts a custom element for testing. Creates the element, injects props and slots, appends it to the DOM, and returns a handle for assertions and cleanup.

```ts
function renderComponent(
  tagName: string,
  options?: RenderComponentOptions
): RenderResult;
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `tagName` | `string` | The custom element tag name (must be registered) |
| `options` | `RenderComponentOptions` | Optional props, slots, and container |

#### `RenderComponentOptions`

```ts
interface RenderComponentOptions {
  /** Attributes/properties to set on the element before connecting. */
  props?: Record<string, unknown>;
  /** Slot content. A string fills the default slot. An object maps slot names to HTML strings. */
  slots?: string | Record<string, string>;
  /** Custom container element. Defaults to `document.body`. */
  container?: HTMLElement;
}
```

#### `RenderResult`

```ts
interface RenderResult {
  /** The mounted custom element. */
  el: HTMLElement;
  /** Removes the element from the DOM. The container is not removed automatically. */
  unmount: () => void;
}
```

#### Examples

**Render with props:**

```ts
const { el, unmount } = renderComponent('ui-button', {
  props: { variant: 'primary', disabled: false },
});

expect(el.getAttribute('variant')).toBe('primary');
unmount();
```

**Render with default slot:**

```ts
const { el, unmount } = renderComponent('ui-button', {
  slots: 'Click me',
});

expect(el.textContent).toContain('Click me');
unmount();
```

**Render with named slots:**

```ts
const { el, unmount } = renderComponent('ui-card', {
  slots: {
    header: '<h2>Card Title</h2>',
    default: '<p>Card content</p>',
    footer: '<button>Save</button>',
  },
});

unmount();
```

**Render into a custom container:**

```ts
const container = document.createElement('section');
document.body.appendChild(container);

const { el, unmount } = renderComponent('ui-panel', {
  container,
  props: { open: true },
});

unmount();
container.remove();
```

---

## Mocking Signals

### `mockSignal()`

Creates a controllable signal with `set()` and `reset()` helpers. Extends the standard `Signal` interface with test-friendly methods.

```ts
function mockSignal<T>(initialValue: T): MockSignal<T>;
```

#### `MockSignal<T>`

```ts
interface MockSignal<T> extends Signal<T> {
  /** Set the signal to a specific value. */
  set(value: T): void;
  /** Reset the signal to its initial value. */
  reset(): void;
  /** The value passed to `mockSignal()`. */
  readonly initialValue: T;
}
```

#### Examples

**Basic usage:**

```ts
const count = mockSignal(0);

count.set(5);
expect(count.value).toBe(5);

count.reset();
expect(count.value).toBe(0);
expect(count.initialValue).toBe(0);
```

**Use with effects:**

```ts
import { effect } from '@bquery/bquery/reactive';

const name = mockSignal('Ada');
const log: string[] = [];

effect(() => {
  log.push(name.value);
});

name.set('Grace');
expect(log).toEqual(['Ada', 'Grace']);

name.reset();
expect(log).toEqual(['Ada', 'Grace', 'Ada']);
```

**Use with computed:**

```ts
import { computed } from '@bquery/bquery/reactive';

const price = mockSignal(100);
const tax = computed(() => price.value * 0.2);

expect(tax.value).toBe(20);

price.set(200);
expect(tax.value).toBe(40);
```

---

## Mocking the Router

### `mockRouter()`

Creates a lightweight mock router for testing route-dependent components without touching the History API.

```ts
function mockRouter(options?: MockRouterOptions): MockRouter;
```

#### `MockRouterOptions`

```ts
interface MockRouterOptions {
  /** Route definitions for matching. */
  routes?: MockRouteDefinition[];
  /** Initial path. Default: `'/'` */
  initialPath?: string;
  /** Base path prefix. Default: `''` */
  base?: string;
}
```

#### `MockRouteDefinition`

```ts
interface MockRouteDefinition {
  path: string;
  [key: string]: unknown;
}
```

#### `MockRouter`

```ts
interface MockRouter {
  /** Navigate to a path (pushes to signal). */
  push(path: string): void;
  /** Replace the current path (no history entry). */
  replace(path: string): void;
  /** Reactive current route signal. */
  readonly currentRoute: Signal<TestRoute>;
  /** All registered routes. */
  readonly routes: MockRouteDefinition[];
  /** Clean up the router. */
  destroy(): void;
}
```

#### `TestRoute`

```ts
interface TestRoute {
  path: string;
  params: Record<string, string>;
  query: Record<string, string | string[]>;
  matched: MockRouteDefinition | null;
  hash: string;
}
```

#### Examples

**Basic navigation:**

```ts
const router = mockRouter({
  routes: [
    { path: '/' },
    { path: '/docs' },
    { path: '/user/:id' },
  ],
  initialPath: '/',
});

expect(router.currentRoute.value.path).toBe('/');

router.push('/docs');
expect(router.currentRoute.value.path).toBe('/docs');

router.push('/user/42');
expect(router.currentRoute.value.params).toEqual({ id: '42' });

router.destroy();
```

**With query and hash:**

```ts
const router = mockRouter({
  routes: [{ path: '/search' }],
});

router.push('/search?q=bquery&page=2#results');
expect(router.currentRoute.value.query).toEqual({ q: 'bquery', page: '2' });
expect(router.currentRoute.value.hash).toBe('#results');

router.destroy();
```

**Reactive route testing:**

```ts
import { effect } from '@bquery/bquery/reactive';

const router = mockRouter({
  routes: [{ path: '/' }, { path: '/about' }],
});

const visited: string[] = [];

effect(() => {
  visited.push(router.currentRoute.value.path);
});

router.push('/about');

expect(visited).toEqual(['/', '/about']);

router.destroy();
```

---

## Event Dispatching

### `fireEvent()`

Dispatches a synthetic event on an element and flushes any pending reactive effects. This ensures that event handlers and their side effects are fully processed before assertions.

```ts
function fireEvent(
  el: Element,
  eventName: string,
  options?: FireEventOptions
): boolean;
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `el` | `Element` | The target element |
| `eventName` | `string` | Event name (e.g., `'click'`, `'input'`, `'submit'`) |
| `options` | `FireEventOptions` | Optional event configuration |

#### `FireEventOptions`

```ts
interface FireEventOptions {
  /** Whether the event bubbles. Default: `true` */
  bubbles?: boolean;
  /** Whether the event is cancelable. Default: `true` */
  cancelable?: boolean;
  /** Whether the event crosses shadow DOM. Default: `true` */
  composed?: boolean;
  /** Custom data for `CustomEvent.detail`. */
  detail?: unknown;
}
```

**Returns:** `true` if the event was not canceled (same as `EventTarget.dispatchEvent()`), or `false` if `preventDefault()` was called on a cancelable event.

#### Examples

**Click event:**

```ts
const button = document.createElement('button');
let clicked = false;
button.addEventListener('click', () => { clicked = true; });
document.body.appendChild(button);

fireEvent(button, 'click');
expect(clicked).toBe(true);

button.remove();
```

**Custom event with detail:**

```ts
const el = document.createElement('div');
let receivedDetail: unknown;
el.addEventListener('custom', (e: Event) => {
  receivedDetail = (e as CustomEvent).detail;
});
document.body.appendChild(el);

fireEvent(el, 'custom', { detail: { action: 'save' } });
expect(receivedDetail).toEqual({ action: 'save' });

el.remove();
```

---

## Flushing Effects

### `flushEffects()`

Synchronously flushes all pending reactive effects. Useful after `batch()` calls or when you need to verify side effects before assertions.

```ts
function flushEffects(): void;
```

```ts
import { signal, effect, batch } from '@bquery/bquery/reactive';
import { flushEffects } from '@bquery/bquery/testing';

const count = signal(0);
const log: number[] = [];

effect(() => {
  log.push(count.value);
});

batch(() => {
  count.value = 1;
  count.value = 2;
});

flushEffects();

expect(log).toEqual([0, 2]);
```

---

## Async Conditions

### `waitFor()`

Waits for a predicate to return `true`, polling at regular intervals with a timeout.

```ts
function waitFor(
  predicate: () => boolean | Promise<boolean>,
  options?: WaitForOptions
): Promise<void>;
```

#### `WaitForOptions`

```ts
interface WaitForOptions {
  /** Maximum time to wait in milliseconds. Default: `1000` */
  timeout?: number;
  /** Polling interval in milliseconds. Default: `10` */
  interval?: number;
}
```

**Throws:** `Error` if the predicate does not return `true` within the timeout.

#### Examples

**Wait for DOM change:**

```ts
await waitFor(
  () => document.querySelector('[data-ready="true"]') !== null,
  { timeout: 2000 }
);
```

**Wait for async state:**

```ts
import { signal } from '@bquery/bquery/reactive';

const loaded = signal(false);

setTimeout(() => { loaded.value = true; }, 50);

await waitFor(() => loaded.value, { timeout: 500, interval: 10 });
```

**Wait for element text:**

```ts
await waitFor(() => {
  const el = document.querySelector('#status');
  return el?.textContent === 'Complete';
});
```

---

## Full Test Example

```ts
import { describe, expect, it, afterEach } from 'bun:test';
import { signal, effect, computed } from '@bquery/bquery/reactive';
import {
  renderComponent,
  mockSignal,
  mockRouter,
  fireEvent,
  flushEffects,
  waitFor,
} from '@bquery/bquery/testing';

describe('ui-counter', () => {
  it('increments on click', () => {
    const { el, unmount } = renderComponent('ui-counter', {
      props: { start: 0 },
    });

    const button = el.shadowRoot?.querySelector('button');
    if (button) {
      fireEvent(button, 'click');
    }

    expect(el.shadowRoot?.textContent).toContain('1');
    unmount();
  });
});

describe('mockSignal', () => {
  it('tracks and resets', () => {
    const count = mockSignal(10);
    count.set(20);
    expect(count.value).toBe(20);
    count.reset();
    expect(count.value).toBe(10);
  });
});

describe('router', () => {
  it('navigates with params', () => {
    const router = mockRouter({
      routes: [{ path: '/user/:id' }],
    });

    router.push('/user/99');
    expect(router.currentRoute.value.params.id).toBe('99');
    router.destroy();
  });
});
```

---

## Notes

- These helpers keep tests concise without introducing extra runtime dependencies.
- `renderComponent()` creates and removes DOM elements — always call `unmount()` to prevent leaks.
- `mockRouter()` does not touch `window.history` — it is purely signal-based.
- `fireEvent()` dispatches events and calls `flushEffects()` automatically so you don't need to flush manually after events.
- `waitFor()` supports both synchronous and asynchronous predicates.
