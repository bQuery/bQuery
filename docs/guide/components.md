# Components

Components are lightweight Web Components with typed props, optional state, and a render function.

```ts
import { component, html, safeHtml } from '@bquery/bquery/component';

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
  updated() {
    console.log('updated');
  },
  render({ props, state }) {
    return html`
      <div class="card ${props.active ? 'active' : ''}">
        <img src="${props.avatar}" alt="${props.username}" />
        <strong>${safeHtml`${props.username}`}</strong>
        <div>Clicks: ${state.clicks}</div>
      </div>
    `;
  },
});
```

## Props

Props are defined with a `type` and optional `required`/`default`.

```ts
props: {
  count: { type: Number, default: 0 },
  enabled: { type: Boolean, default: true },
  meta: { type: Object, default: {} },
}
```

### Prop coercion

- `String` → raw string
- `Number` → `Number(value)` (fallback to raw string on `NaN`)
- `Boolean` → `'true' | '' | '1'` => `true`, `'false' | '0'` => `false`
- `Object`/`Array` → `JSON.parse` (fallback to raw string)
- Custom function/constructor → called or constructed

Missing required props without a default throw an error at runtime.

## State

State is a simple internal object that can be updated via `setState`.

```ts
const el = document.querySelector('user-card') as HTMLElement & {
  setState: (key: string, value: unknown) => void;
};

el.setState('clicks', 1);
```

## Lifecycle hooks

- `connected()` – runs when the element mounts
- `disconnected()` – runs on teardown
- `updated()` – runs after re-render on prop changes

## Rendering helpers

- `html` – template literal helper for building HTML strings
- `safeHtml` – escapes interpolated values for safety

## Emitting events

The render function receives `emit` for custom events:

```ts
render({ emit }) {
  emit('change', { value: 1 });
  return html`<div>...</div>`;
}
```
