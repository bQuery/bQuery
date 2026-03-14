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

## Lifecycle hooks

- `beforeMount()` – runs before the element renders (can modify initial state)
- `connected()` – runs when the element mounts
- `beforeUpdate(newProps, oldProps)` – runs before re-render; return `false` to prevent update
- `updated(change?)` – runs after re-render; receives attribute-change metadata for prop-driven updates and `undefined` for state/signal updates
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
