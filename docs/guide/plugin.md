# Plugin System

The plugin module lets you register reusable integrations that add custom directives and Web Components globally. Plugins are installed at most once (by name) and integrate directly with the view module.

```ts
import {
  use,
  unuse,
  isInstalled,
  getInstalledPlugins,
  getPluginInfo,
  getCustomDirective,
  getCustomDirectives,
  resetPlugins,
  // Hooks (1.14+)
  addFilter,
  applyFilters,
  addAction,
  doAction,
  // DI (1.14+)
  createInjectionKey,
  provide,
  inject,
} from '@bquery/bquery/plugin';
```

## What's new in 1.14

### Hooks, filters, and DI

Plugins (and your app code) can publish and consume named hooks. Filters are
WP-style synchronous pipelines; actions are fire-and-forget event buses.

```ts
import { addFilter, applyFilters, addAction, doAction } from '@bquery/bquery/plugin';

addFilter('format-title', (title: string) => title.toUpperCase());
const out = applyFilters('format-title', 'hello'); // 'HELLO'

addAction('analytics:event', (name: string) => track(name));
doAction('analytics:event', 'page-view');
```

Dependency injection works at container scope (parallel to component-level
`provide` / `inject`):

```ts
import { createInjectionKey, provide, inject } from '@bquery/bquery/plugin';

const ApiClientKey = createInjectionKey<ApiClient>('api-client');
provide(ApiClientKey, new ApiClient());
const api = inject(ApiClientKey);
```

### Plugin install context

Plugins receive an enriched context with `addFilter`, `addAction`, `provide`,
`inject`, and `onCleanup`. Anything registered through the context is
plugin-owned and removed automatically by `unuse(name)` / `uninstall(name)`.

```ts
use({
  name: 'tooltip',
  version: '1.0.0',
  description: 'Lightweight tooltip directive',
  dependencies: ['popper'],
  dependencyMode: 'error',
  install(ctx) {
    ctx.directive('tooltip', {
      mounted(el, value) {
        /* ... */
      },
      unmounted(el) {
        /* ... */
      },
    });
    ctx.onCleanup(() => {
      // detach global listeners, caches, etc.
    });
  },
});
```

### Async install

`install` may return `void | Promise<void>`. Concurrent installs of the same
plugin are serialised, and `use()` resolves once any async install finishes.

### Uninstall

```ts
unuse('tooltip'); // detach directives, hooks, DI bindings, run onCleanup callbacks
```

### Plugin metadata

```ts
getInstalledPlugins({ withMetadata: true });
// [{ name: 'tooltip', version: '1.0.0', description: '...', dependencies: ['popper'] }]

getPluginInfo('tooltip');
```

### Directive lifecycle objects

Directives can now declare `{ mounted, updated, unmounted }` hooks and use
plugin-namespaced names like `tooltip:arrow`.

---

## Installing a Plugin

### `use()`

Registers a plugin. The plugin's `install()` function receives a context object for registering directives and components. Plugins are installed at most once (by name) — calling `use()` again with the same plugin name is a safe no-op.

```ts
function use<TOptions = unknown>(plugin: BQueryPlugin<TOptions>, options?: TOptions): void;
```

| Parameter | Type                     | Description                                  |
| --------- | ------------------------ | -------------------------------------------- |
| `plugin`  | `BQueryPlugin<TOptions>` | Plugin object with `name` and `install()`    |
| `options` | `TOptions`               | Optional configuration passed to `install()` |

**Throws:** If the plugin is missing a valid `name` or `install` function.

#### Example: Custom directive plugin

```ts
const tooltipPlugin = {
  name: 'tooltip',
  install(ctx) {
    ctx.directive('tooltip', (el, expression) => {
      el.setAttribute('title', expression);
      el.style.cursor = 'help';
    });
  },
};

use(tooltipPlugin);
```

After registration, `bq-tooltip="some text"` can be used in templates processed by `mount()`.

#### Example: Plugin with options

```ts
interface AnalyticsOptions {
  endpoint: string;
  sampleRate: number;
}

const analyticsPlugin: BQueryPlugin<AnalyticsOptions> = {
  name: 'analytics',
  install(ctx, options) {
    ctx.directive('track', (el, expression) => {
      el.addEventListener('click', () => {
        fetch(options!.endpoint, {
          method: 'POST',
          body: JSON.stringify({ event: expression }),
        });
      });
    });
  },
};

use(analyticsPlugin, { endpoint: '/api/events', sampleRate: 0.1 });
```

#### Example: Registering custom components

```ts
class BqHello extends HTMLElement {
  connectedCallback() {
    this.textContent = 'Hello from a plugin';
  }
}

use({
  name: 'hello-component',
  install(ctx) {
    ctx.component('bq-hello', BqHello);
  },
});
```

---

## Introspection Helpers

### `isInstalled()`

Checks whether a plugin with the given name has been registered.

```ts
function isInstalled(name: string): boolean;
```

```ts
console.log(isInstalled('tooltip')); // true
console.log(isInstalled('unknown')); // false
```

### `getInstalledPlugins()`

Returns a read-only array of all installed plugin names.

```ts
function getInstalledPlugins(): readonly string[];
```

```ts
console.log(getInstalledPlugins());
// ['tooltip', 'hello-component']
```

### `getCustomDirective()`

Retrieves the handler function for a specific custom directive. Returns `undefined` if the directive was not registered.

```ts
function getCustomDirective(name: string): CustomDirectiveHandler | undefined;
```

| Parameter | Type     | Description                                   |
| --------- | -------- | --------------------------------------------- |
| `name`    | `string` | The directive name (without the `bq-` prefix) |

```ts
const handler = getCustomDirective('tooltip');
if (handler) {
  console.log('Tooltip directive is registered');
}
```

### `getCustomDirectives()`

Returns a snapshot of all registered custom directives.

```ts
function getCustomDirectives(): readonly CustomDirective[];
```

```ts
const directives = getCustomDirectives();
for (const d of directives) {
  console.log(d.name, typeof d.handler);
}
// tooltip function
```

---

## Testing and Cleanup

### `resetPlugins()`

Clears all installed plugins and custom directives. This is primarily useful in tests so each test can start from a clean plugin registry.

```ts
function resetPlugins(): void;
```

```ts
import { resetPlugins } from '@bquery/bquery/plugin';

// In a test setup/teardown
afterEach(() => {
  resetPlugins();
});
```

---

## Type Definitions

### `BQueryPlugin<TOptions>`

```ts
interface BQueryPlugin<TOptions = unknown> {
  /** Unique name for the plugin (used for idempotency). */
  readonly name: string;
  /** Called once during `use()`. Register directives and components here. */
  install(context: PluginInstallContext, options?: TOptions): void;
}
```

### `PluginInstallContext`

The context object passed to a plugin's `install()` function.

```ts
interface PluginInstallContext {
  /** Register a custom directive handler. */
  directive(name: string, handler: CustomDirectiveHandler): void;
  /** Register a custom element. */
  component(
    tagName: string,
    constructor: CustomElementConstructor,
    options?: ElementDefinitionOptions
  ): void;
}
```

### `CustomDirectiveHandler`

```ts
type CustomDirectiveHandler = (
  el: Element,
  expression: string,
  context: BindingContext,
  cleanups: CleanupFn[]
) => void;
```

| Parameter    | Type             | Description                                                                                                                   |
| ------------ | ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `el`         | `Element`        | The DOM element with the directive attribute                                                                                  |
| `expression` | `string`         | The raw attribute value (expression text) from the template; if you need it evaluated, evaluate it against `context` yourself |
| `context`    | `BindingContext` | The reactive data context from `mount()`                                                                                      |
| `cleanups`   | `CleanupFn[]`    | Push cleanup functions here; they run when the view unmounts                                                                  |

### `CustomDirective`

```ts
interface CustomDirective {
  readonly name: string;
  readonly handler: CustomDirectiveHandler;
}
```

---

## Full Example: Building a Tooltip Plugin

```ts
import { use, isInstalled } from '@bquery/bquery/plugin';
import { mount } from '@bquery/bquery/view';
import { signal } from '@bquery/bquery/reactive';

// 1. Define the plugin
const tooltipPlugin = {
  name: 'tooltip',
  install(ctx) {
    ctx.directive('tooltip', (el, expression, _context, cleanups) => {
      const tooltip = document.createElement('div');
      tooltip.className = 'tooltip';
      tooltip.textContent = expression;
      tooltip.style.display = 'none';

      el.appendChild(tooltip);

      const show = () => {
        tooltip.style.display = 'block';
      };
      const hide = () => {
        tooltip.style.display = 'none';
      };

      el.addEventListener('mouseenter', show);
      el.addEventListener('mouseleave', hide);

      // Register cleanup so listeners are removed on unmount
      cleanups.push(() => {
        el.removeEventListener('mouseenter', show);
        el.removeEventListener('mouseleave', hide);
        tooltip.remove();
      });
    });
  },
};

// 2. Register the plugin BEFORE mount()
use(tooltipPlugin);

// 3. Use in a template
document.body.innerHTML = `
  <div id="app">
    <button bq-tooltip="Click to save">Save</button>
  </div>
`;

const message = signal('Click to save');
mount('#app', { message });
```

---

## Notes

- Installation is idempotent per plugin name.
- Custom directives integrate directly with the view module's `mount()`.
- Plugin registration should generally happen before `mount()` or component/router setup.
- The `cleanups` array in directive handlers ensures proper teardown when views unmount.
- Plugins can register both directives and custom elements in the same `install()` call.
