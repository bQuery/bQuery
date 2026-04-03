# SSR

The SSR module renders bQuery templates to HTML strings on the server, serializes store state for transfer, and hydrates the client-side DOM back into a live reactive application.

```ts
import {
  deserializeStoreState,
  hydrateMount,
  hydrateStore,
  hydrateStores,
  renderToString,
  serializeStoreState,
} from '@bquery/bquery/ssr';
```

---

## Server-Side Rendering

### `renderToString()`

Renders a bQuery template with reactive context into a static HTML string. Signals and computed values in the context are automatically unwrapped.

```ts
function renderToString(
  template: string,
  data: BindingContext,
  options?: RenderOptions
): SSRResult;
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `template` | `string` | HTML template with `bq-*` directives |
| `data` | `BindingContext` | Data object (signals are unwrapped automatically) |
| `options` | `RenderOptions` | Optional rendering configuration |

#### `RenderOptions`

```ts
type RenderOptions = {
  /** Directive prefix. Default: `'bq'` */
  prefix?: string;
  /** Remove directives from output HTML. Default: `false` */
  stripDirectives?: boolean;
  /** Include serialized store state. Accepts `true` (all stores) or an array of store IDs. Default: `false` */
  includeStoreState?: boolean | string[];
};
```

#### `SSRResult`

```ts
type SSRResult = {
  /** The rendered HTML string */
  html: string;
  /** Serialized store state (only when `includeStoreState` is enabled) */
  storeState?: string;
};
```

#### Supported SSR Directives

| Directive | Description |
|-----------|-------------|
| `bq-text` | Sets text content from a context value |
| `bq-html` | Sets innerHTML from a context value |
| `bq-if` | Conditionally includes the element |
| `bq-show` | Toggles `display: none` based on a condition |
| `bq-for` | Repeats the element for each array item |
| `bq-class` | Applies CSS classes from an object or string |
| `bq-style` | Applies inline styles from an object or string |
| `bq-bind:*` | Binds any attribute (e.g., `bq-bind:href`) |

#### Examples

**Basic rendering:**

```ts
const { html } = renderToString(
  '<div id="app"><h1 bq-text="title"></h1></div>',
  { title: 'Hello SSR' }
);

console.log(html);
// <div id="app"><h1>Hello SSR</h1></div>
```

**With conditional and loop:**

```ts
const { html } = renderToString(
  `<ul>
    <li bq-for="item in items" bq-text="item"></li>
  </ul>
  <p bq-if="showFooter">Footer</p>`,
  { items: ['A', 'B', 'C'], showFooter: true }
);
```

**Strip directives from output:**

```ts
const { html } = renderToString(
  '<h1 bq-text="title"></h1>',
  { title: 'Clean Output' },
  { stripDirectives: true }
);
// <h1>Clean Output</h1>  (no bq-text attribute in output)
```

**With store state serialization:**

```ts
import { createStore } from '@bquery/bquery/store';

const settings = createStore({
  id: 'settings',
  state: () => ({ theme: 'dark', locale: 'en' }),
});

const { html, storeState } = renderToString(
  '<div bq-text="title"></div>',
  { title: 'Dashboard' },
  { includeStoreState: true }
);

console.log(storeState);
// JSON string with all store state
```

---

## Store State Serialization

### `serializeStoreState()`

Serializes all or selected stores to a JSON string and a `<script>` tag ready for embedding in server-rendered HTML. The output is sanitized to prevent XSS.

```ts
function serializeStoreState(
  options?: SerializeOptions
): SerializeResult;
```

#### `SerializeOptions`

```ts
type SerializeOptions = {
  /** ID of the script tag embedded in the page. Default: `'__BQUERY_STORE_STATE__'` */
  scriptId?: string;
  /** Global variable name used to pass state to the client. Default: `'__BQUERY_INITIAL_STATE__'` */
  globalKey?: string;
  /** Only serialize specific stores. If omitted, all stores are serialized. */
  storeIds?: string[];
  /** Custom serialize function. Defaults to `JSON.stringify`. */
  serialize?: (data: unknown) => string;
};
```

#### `SerializeResult`

```ts
type SerializeResult = {
  /** Raw JSON string of all serialized stores */
  stateJson: string;
  /** Ready-to-embed `<script>` tag */
  scriptTag: string;
};
```

#### Example

```ts
const { scriptTag, stateJson } = serializeStoreState({
  scriptId: '__BQUERY_STORE_STATE__',
  globalKey: '__BQUERY_INITIAL_STATE__',
  storeIds: ['settings', 'user'],
});

// Embed in your server response
const serverHtml = `
  <html>
    <body>
      <div id="app">...</div>
      ${scriptTag}
    </body>
  </html>
`;
```

---

## Client-Side Hydration

### `deserializeStoreState()`

Reads store state from the global variable set by the SSR script tag. Automatically cleans up the global key and script element after reading.

```ts
function deserializeStoreState(
  globalKey?: string,
  scriptId?: string
): DeserializedStoreState;
```

| Parameter | Type | Default |
|-----------|------|---------|
| `globalKey` | `string` | `'__BQUERY_INITIAL_STATE__'` |
| `scriptId` | `string` | `'__BQUERY_STORE_STATE__'` |

#### `DeserializedStoreState`

```ts
type DeserializedStoreState = Record<string, Record<string, unknown>>;
```

#### Example

```ts
// On the client, after the page loads:
const state = deserializeStoreState();
// { settings: { theme: 'dark', locale: 'en' }, user: { name: 'Ada' } }
```

### `hydrateStore()`

Applies pre-serialized state to a single store using its `$patch` method.

```ts
function hydrateStore(
  storeId: string,
  state: Record<string, unknown>
): void;
```

```ts
hydrateStore('settings', { theme: 'dark', locale: 'en' });
```

### `hydrateStores()`

Convenience wrapper that calls `hydrateStore()` for each entry in the deserialized state map.

```ts
function hydrateStores(
  stateMap: DeserializedStoreState
): void;
```

```ts
const state = deserializeStoreState();
hydrateStores(state);
```

### `hydrateMount()`

Reuses server-rendered DOM and attaches reactive view bindings. Unlike `mount()`, it does not re-render the HTML — it reuses the existing markup and wires up directives.

```ts
function hydrateMount(
  selector: string | Element,
  context: BindingContext,
  options?: HydrateMountOptions
): View;
```

#### `HydrateMountOptions`

```ts
type HydrateMountOptions = MountOptions & {
  /** Enables hydration mode. Default: `true` */
  hydrate?: true;
};
```

#### Example

```ts
import { hydrateMount } from '@bquery/bquery/ssr';

// Hydrate the server-rendered DOM
const view = hydrateMount('#app', {
  title: 'Dashboard',
  items: ['A', 'B', 'C'],
}, { hydrate: true });
```

---

## Full SSR Workflow

### 1. Server: Render and serialize

```ts
import { renderToString, serializeStoreState } from '@bquery/bquery/ssr';
import { createStore } from '@bquery/bquery/store';

// Define stores
const settings = createStore({
  id: 'settings',
  state: () => ({ theme: 'dark' }),
});

// Render template
const { html } = renderToString(
  '<div id="app"><h1 bq-text="title"></h1></div>',
  { title: 'Welcome' },
  { stripDirectives: true }
);

// Serialize stores
const { scriptTag } = serializeStoreState();

// Compose the full page
const page = `
<!DOCTYPE html>
<html>
  <body>
    ${html}
    ${scriptTag}
    <script type="module" src="/client.js"></script>
  </body>
</html>
`;
```

### 2. Client: Hydrate

```ts
// client.js
import { deserializeStoreState, hydrateStores, hydrateMount } from '@bquery/bquery/ssr';

// Restore store state from the embedded script tag
const state = deserializeStoreState();
hydrateStores(state);

// Hydrate the pre-rendered DOM
hydrateMount('#app', { title: 'Welcome' }, { hydrate: true });
```

---

## Notes

- Serialized script output escapes dangerous content to avoid XSS when embedding state into HTML.
- `globalKey` can be customized when integrating with existing server frameworks (e.g., Express, Hono, Elysia).
- Hydration reuses existing markup and attaches view bindings instead of replacing the DOM wholesale.
- `renderToString` works in non-browser environments that provide a DOM-like API (e.g., `happy-dom`, `linkedom`).
- Prototype-pollution keys (`__proto__`, `constructor`, `prototype`) are filtered during serialization.
