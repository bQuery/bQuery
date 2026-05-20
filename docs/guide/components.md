# Components

Components are lightweight Web Components with typed props, optional state, and a render function.
Internally, the component module is now split into focused submodules (types, props coercion, render helpers), with no breaking API changes.

```ts
import { bool, component, safeHtml } from '@bquery/bquery/component';
import { sanitizeHtml, trusted } from '@bquery/bquery/security';

const activeBadge = trusted(sanitizeHtml('<em>Active</em>'));

component('user-card', {
  props: {
    username: { type: String, required: true },
    avatar: { type: String, default: '/default-avatar.png' },
    active: { type: Boolean, default: false },
  },
  state: { clicks: 0 },
  styles: `
    .card { display: grid; gap: 0.5rem; padding: 1rem; }
    .active { border: 1px solid #4f46e5; }
  `,
  connected() {
    console.log('mounted');
  },
  updated(change) {
    console.log('updated because of', change?.name ?? 'state/signal change');
  },
  render({ props, state }) {
    return safeHtml`
      <button class="card ${props.active ? 'active' : ''}" ${bool('disabled', !props.active)}>
        <img src="${props.avatar}" alt="${props.username}" />
        <strong>${props.username}</strong>
        ${props.active ? activeBadge : ''}
        <span>Clicks: ${state.clicks}</span>
      </button>
    `;
  },
});
```

## Default component library

`registerDefaultComponents()` registers a small, dependency-free set of native UI primitives that are ready for Storybook previews and zero-build usage.

```ts
import { defineBqueryConfig } from '@bquery/bquery/platform';
import { registerDefaultComponents } from '@bquery/bquery/component';

defineBqueryConfig({
  components: { prefix: 'ui' },
});

const tags = registerDefaultComponents();

console.log(tags);
// {
//   button: 'ui-button',
//   card: 'ui-card',
//   input: 'ui-input',
//   textarea: 'ui-textarea',
//   checkbox: 'ui-checkbox'
// }
```

Available defaults:

- `button` – pill-shaped button with `variant`, `size`, `type`, and `disabled` props
- `card` – simple container with optional `title`, `footer`, and `elevated`
- `input` – labeled text input emitting `input` events with `{ value }`
- `textarea` – labeled textarea emitting `input` events with `{ value }`
- `checkbox` – labeled checkbox emitting `change` events with `{ checked }`

### Slots and events

The default components expose regular slots and bubble composed custom events so they work well inside forms, routers, or shadow boundaries.

```html
<ui-card title="Profile">
  <ui-input label="Name"></ui-input>
  <ui-button variant="secondary">Save</ui-button>
</ui-card>
```

```ts
const field = document.querySelector('ui-input');
field?.addEventListener('input', (event) => {
  console.log((event as CustomEvent<{ value: string }>).detail.value);
});
```

## Props

Props are defined with a `type` and optional `required`/`default`/`validator`.

```ts
props: {
  count: { type: Number, default: 0 },
  enabled: { type: Boolean, default: true },
  meta: { type: Object, default: {} },
  age: {
    type: Number,
    default: 0,
    validator: (v) => v >= 0 && v <= 150
  },
}
```

### Prop validation

Add a `validator` function to validate prop values:

```ts
props: {
  email: {
    type: String,
    required: true,
    validator: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  },
}
```

If validation fails, the component throws an error (caught by `onError` if defined).

### Prop coercion

- `String` → raw string
- `Number` → `Number(value)` (fallback to raw string on `NaN`)
- `Boolean` → `'true' | '' | '1'` => `true`, `'false' | '0'` => `false`
- `Object`/`Array` → `JSON.parse` (fallback to raw string)
- Custom function/constructor → called or constructed

If you need to force constructor semantics for custom classes or value objects, set `construct: true` on the prop definition.

```ts
props: {
  publishedAt: {
    type: Date,
    construct: true,
  },
}
```

Missing required props without a default throw an error at runtime.

## State

State is a simple internal object that can be updated via `setState`.

```ts
const el = document.querySelector('user-card') as HTMLElement & {
  setState: (key: string, value: unknown) => void;
};

el.setState('clicks', 1);
```

If you provide an explicit state generic, state reads and writes stay strongly typed across `render()`, lifecycle hooks, and the returned element class.

```ts
import { component, html } from '@bquery/bquery/component';

type Props = { label: string };
type State = { count: number; ready: boolean };

component<Props, State>('typed-counter', {
  props: {
    label: { type: String, required: true },
  },
  state: {
    count: 0,
    ready: false,
  },
  connected() {
    this.setState('count', this.getState('count') + 1);
  },
  render({ props, state }) {
    return html`<div>${props.label}: ${state.count} (${state.ready})</div>`;
  },
});
```

## Signals

Declare external reactive inputs via `signals` when a component should re-render in response to signals or computed values.

```ts
import { component, html } from '@bquery/bquery/component';
import { computed, signal } from '@bquery/bquery/reactive';

const theme = signal<'light' | 'dark'>('light');
const themeClass = computed(() => `theme-${theme.value}`);

component('theme-badge', {
  props: {},
  signals: { themeClass },
  render({ signals }) {
    return html`<span class="${signals.themeClass.value}">Theme</span>`;
  },
});
```

Only declared signals trigger re-renders, which keeps component updates predictable and avoids accidental subscriptions to unrelated reactive reads.

## Shadow DOM control

Components render into an open shadow root by default, but you can opt into closed shadow roots or render directly into the host element.

```ts
component('inline-banner', {
  shadow: false,
  render: () => html`<p class="banner">Rendered in light DOM</p>`,
});

component('private-panel', {
  shadow: 'closed',
  render: () => html`<section>Closed shadow root</section>`,
});
```

## Lifecycle hooks

- `beforeMount()` – runs before the element renders (can modify initial state)
- `connected()` – runs when the element mounts
- `onAttributeChanged(name, oldValue, newValue)` – runs for observed prop attributes plus anything listed in `observeAttributes`
- `beforeUpdate(newProps, oldProps)` – runs before re-render; return `false` to prevent update
- `updated(change?)` – runs after re-render; receives attribute-change metadata for prop-driven updates and `undefined` for state/signal updates
- `onAdopted()` – runs when the element is adopted into a different `Document`
- `disconnected()` – runs on teardown
- `onError(error)` – handles errors during lifecycle/render

```ts
component('my-element', {
  props: { count: { type: Number, default: 0 } },
  beforeMount() {
    console.log('About to mount');
  },
  connected() {
    console.log('Mounted');
  },
  beforeUpdate(newProps, oldProps) {
    // Prevent update if count is negative, and skip no-op updates
    if (newProps.count < 0) return false;
    return newProps.count !== oldProps.count;
  },
  updated() {
    console.log('Updated');
  },
  disconnected() {
    console.log('Disconnected');
  },
  onError(error) {
    console.error('Error:', error);
  },
  render({ props }) {
    return html`<div>Count: ${props.count}</div>`;
  },
});
```

### Observing extra attributes

If you need lifecycle reactions for attributes that are not part of `props`, declare them via `observeAttributes`.

```ts
component('live-panel', {
  observeAttributes: ['data-state'],
  onAttributeChanged(name, oldValue, newValue) {
    console.log(name, oldValue, newValue);
  },
  render: () => html`<div>Watching data-state</div>`,
});
```

## Scoped reactivity helpers

`useSignal()`, `useComputed()`, and `useEffect()` create component-local reactive resources that are cleaned up automatically when the element disconnects.

Call them from lifecycle hooks such as `beforeMount()`, `connected()`, `onAdopted()`, or `onAttributeChanged()` — not from `render()`.

```ts
import { component, html, useComputed, useEffect, useSignal } from '@bquery/bquery/component';

component('scoped-counter', {
  connected() {
    const count = useSignal(0);
    const doubled = useComputed(() => count.value * 2);

    useEffect(() => {
      console.log('Scoped value:', doubled.value);
    });

    this.setState('count', count.value);
    this.setState('doubled', doubled.value);
  },
  state: { count: 0, doubled: 0 },
  render({ state }) {
    return html`<p>${state.count} → ${state.doubled}</p>`;
  },
});
```

## Rendering helpers

- `html` – template literal helper for building HTML strings
- `safeHtml` – escapes interpolated values for safety
- `trusted(sanitizeHtml(...))` – opt in to reusing a sanitized fragment inside `safeHtml`

Rendered component output is sanitized before it is written into the Shadow DOM. That keeps custom elements aligned with bQuery's security-by-default model while still allowing standard form attributes used by the default component library.

If a component needs a few additional tags or attributes, add a `sanitize` option to extend the component render allowlist without changing global sanitization defaults:

```ts
component('bq-dialog', {
  sanitize: {
    allowAttributes: ['open'],
  },
  render: () => html`<div role="dialog" open>Hello</div>`,
});
```

Only opt into attributes whose values you control or validate. In particular,
`style` is excluded by default and bQuery does not sanitize CSS values for you,
so enabling it for untrusted input can reintroduce security risks.

## Manual element class creation

If you need access to the element class (e.g., to register manually or extend behavior), use `defineComponent`:

```ts
import { defineComponent } from '@bquery/bquery/component';

const UserCard = defineComponent('user-card', {
  props: {
    username: { type: String, required: true },
  },
  render: ({ props }) => html`<div>${props.username}</div>`,
});

customElements.define('user-card', UserCard);
```

## Emitting events

The render function receives `emit` for custom events:

```ts
render({ emit }) {
  emit('change', { value: 1 });
  return html`<div>...</div>`;
}
```

## Storybook helpers

For Storybook string renderers, use `@bquery/bquery/storybook` to keep stories declarative and sanitized.

```ts
import { storyHtml, when } from '@bquery/bquery/storybook';

export const ButtonStory = {
  args: { disabled: false, label: 'Save' },
  render: ({ disabled, label }: { disabled: boolean; label: string }) =>
    storyHtml`
      <ui-card>
        <ui-button ?disabled=${disabled}>${label}</ui-button>
        ${when(disabled, '<small>Unavailable</small>', '<small>Ready</small>')}
      </ui-card>
    `,
};
```

`storyHtml()` sanitizes interpolated markup and understands Storybook-style boolean attribute shorthand such as `?disabled=${true}`.

## What's new in 1.13.0 — Component framework parity

`@bquery/bquery/component` gained a set of additive primitives that bring it to
parity with mainstream component frameworks while staying zero-dependency and
sanitizer-safe. None of the existing APIs changed.

### Refs and slots

```ts
import { component, html, useEffect, useRef, useSlot } from '@bquery/bquery/component';

component('focus-input', {
  connected() {
    const input = useRef<HTMLInputElement>();
    const items = useSlot(this, 'item'); // Signal<Element[]>
    useEffect(() => console.log('Items:', items.value.length));
    queueMicrotask(() => input.bind(this.shadowRoot!.querySelector('input')!));
  },
  render: () => html`<input /><slot name="item"></slot>`,
});
```

### Delegated event handlers (no inline `on*` attributes, no `eval`)

```ts
import { onClick, bindDelegatedEvents } from '@bquery/bquery/component';

component('counter', {
  connected() { bindDelegatedEvents(this); },
  state: { n: 0 },
  render({ state }) {
    return html`<button ${onClick(() => state.n += 1)}>+ ${state.n}</button>`;
  },
});
```

Handlers are stored in a module-level Map keyed by opaque IDs, so the sanitizer never
sees inline JavaScript.

### Dependency injection

```ts
import { provide, inject, injectionKey } from '@bquery/bquery/component';

const ThemeKey = injectionKey<{ dark: boolean }>('theme');

component('app-shell', {
  connected() { provide(this, ThemeKey, { dark: true }); },
  render: () => html`<slot></slot>`,
});

component('themed-button', {
  connected() {
    const theme = inject(this, ThemeKey, { dark: false });
    console.log(theme!.dark);
  },
  render: () => html`<button><slot></slot></button>`,
});
```

Uses a typed `CustomEvent` over the composed path — no globals.

### Lifecycle additions

- `beforeUnmount()` — symmetric to `beforeMount`, runs before disconnect cleanup.
- `errorBoundary(error, info)` — returning a string renders that markup as a
  fallback when `render()` throws.
- `whenIdle(fn)` — scope-tracked `requestIdleCallback` with `setTimeout` fallback.

### Async data

```ts
import { useAsync } from '@bquery/bquery/component';

connected() {
  const { data, error, loading, refresh } = useAsync(async (signal) =>
    (await fetch('/api/me', { signal })).json()
  );
}
```

Aborts via `AbortController` when the component disconnects or `refresh()` is
re-invoked.

### Imperative props (non-string objects)

```ts
host.setProp('items', ['a', 'b']);
const current = host.getProp<string[]>('items');
```

Triggers a re-render and bypasses attribute serialization for arrays, objects,
and callbacks.

### `css` tagged template + adoptable stylesheets

```ts
import { component, css, html } from '@bquery/bquery/component';

component('themed-card', {
  styles: css`
    :host { display: block; padding: 1rem; }
    h2 { color: ${'#0066cc'}; }
  `,
  render: () => html`<h2><slot></slot></h2>`,
});
```

When Constructable Stylesheets are available, the underlying CSS is shared
across instances via `document.adoptedStyleSheets`. Otherwise the existing
`<style>`-tag pathway is used. Interpolations are CSS-escaped.

### Keyed lists

```ts
import { component, html, keyedList, reconcileKeyed } from '@bquery/bquery/component';

component('todo-list', {
  state: { items: [] as Array<{ id: string; text: string }> },
  render({ state }) {
    return html`<ul>${keyedList(state.items, (it) => it.id, (it) =>
      `<li>${it.text}</li>`
    )}</ul>`;
  },
  updated() {
    const items = this.getState<Array<{ id: string }>>('items');
    reconcileKeyed(
      this.shadowRoot!.querySelector('ul')!,
      items.map((item) => item.id)
    );
  },
});
```
