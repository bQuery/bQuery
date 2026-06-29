# Plugin System

::: tip What's new in 1.14.0
The plugin module graduated to a batteries-included tier in 1.14.0 with a hook bus (`addFilter` / `applyFilters`, `addAction` / `doAction`), DI container helpers (`createInjectionKey` / `provide` / `inject`), plugin-scoped `ctx.onCleanup`, async `install()`, plugin metadata (`version`, `description`, `dependencies`, `dependencyMode`), `unuse()` / `uninstall()`, directive lifecycle objects, and namespaced directives like `tooltip:arrow`. See the [1.14.0 release notes](/release-notes/1.14#plugin-batteries-included).
:::

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

Directives can now declare `{ mounted, unmounted }` hooks and use
plugin-namespaced names like `tooltip:arrow`.

---

## Stability

`plugin` has been **Beta**, and it is the extensibility contract the whole ecosystem would build on — yet its surface is one minor old (the hook bus, DI container, async install, namespaced directives, and `unuse`/`uninstall` all arrived in 1.14.0). Third-party authors cannot target a moving extension API. The work to graduate it is tracked in [#145](https://github.com/bQuery/bQuery/issues/145): freeze the hook-bus / DI / install-lifecycle / directive-registration surface for one minor cycle, publish this plugin-author guide, and prove install/uninstall symmetry. It **graduated to Stable in 1.15.0**, with the surface frozen under the no-breaking-changes-between-minors contract.

### Exit criteria

- [x] **Public surface frozen for one minor** — see [Frozen surface reference](#frozen-surface-reference-1150) below. The new `definePlugin()` authoring helper is additive.
- [x] **Plugin-author guide published** ([#145](https://github.com/bQuery/bQuery/issues/145)) — see [Plugin-author guide](#plugin-author-guide) (lifecycle, hook timing, DI resolution, directive namespacing).
- [x] **Install/uninstall symmetry tested** ([#145](https://github.com/bQuery/bQuery/issues/145)) — `uninstall()` leaves **no** directives, filters, actions, or DI bindings behind; re-install is clean.
- [x] **Surface frozen** (no breaking changes) — committed under the Stable contract from 1.15.0.

### Frozen surface reference (1.15.0)

The frozen public surface of `@bquery/bquery/plugin`:

- **Lifecycle:** `use`, `unuse`, `uninstall`, `isInstalled`, `resetPlugins`, and the new (additive) `definePlugin`.
- **Install context:** `directive`, `component`, `addFilter`, `applyFilters`, `addAction`, `doAction`, `provide`, `inject`, `onCleanup`.
- **Free-standing hooks:** `addFilter`, `applyFilters`, `addAction`, `doAction`, `removeFilter`, `removeAction`, `listFilters`, `listActions`, `resetHooks`.
- **DI:** `createInjectionKey`, `provide`, `inject`, `hasProvided`, `resetDi`.
- **Introspection:** `getInstalledPlugins`, `getPluginInfo`, `getCustomDirective`, `getCustomDirectives`.

## Plugin-author guide

A plugin is a plain object with a `name` and an `install(ctx, options)` function. Wrap it in `definePlugin()` for type inference of `options` and a single, stable entry point:

```ts
import { definePlugin, use } from '@bquery/bquery/plugin';

const myPlugin = definePlugin({
  name: 'my-plugin',
  version: '1.0.0',
  async install(ctx, options: { prefix: string }) {
    ctx.provide('logger', console); // DI binding
    ctx.directive('my:thing', (el) => {
      /* … */
    }); // namespaced directive
    ctx.addFilter('view:render', (html: string) => html); // hook
    ctx.onCleanup(() => {
      /* extra teardown */
    });
  },
});

await use(myPlugin, { prefix: 'app' });
```

### Lifecycle and hook timing

- **Install** runs once per name on `use(plugin)`. A duplicate `use()` of the same `name` is a no-op. `install()` may be `async`; `await use(plugin)` resolves when it finishes, and concurrent `use()` calls for the same name share the in-flight promise.
- **Atomic install:** if `install()` throws (or its returned promise rejects), every contribution made so far is rolled back — the directive registry is restored from a snapshot and filters/actions/DI bindings registered under the plugin are removed. A failed install leaves no partial state.
- **Dependencies:** list prerequisite plugin names in `dependencies`. Missing dependencies throw by default (`dependencyMode: 'error'`) or warn (`'warn'`).
- **Uninstall** runs on `unuse(name)` / `uninstall(name)`: it removes the plugin's directives, filters, actions, and DI bindings, then runs `onCleanup` callbacks. `resetPlugins()` uninstalls everything (so plugin cleanups run).

### Install/uninstall symmetry (the contract)

Everything registered through `ctx` is **owned** by the plugin and removed on uninstall — this symmetry is the stable guarantee third-party authors can rely on:

| Registered via                              | Removed on uninstall?                                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `ctx.directive()`                           | ✅ Yes                                                                                                  |
| `ctx.addFilter()` / `ctx.addAction()`       | ✅ Yes (by owner)                                                                                       |
| `ctx.provide()`                             | ✅ Yes (by owner)                                                                                       |
| `ctx.onCleanup(fn)`                         | ✅ `fn` is invoked                                                                                      |
| `ctx.component()` (`customElements.define`) | ⚠️ **No** — the browser cannot un-define a custom element; it stays registered but is no longer tracked |

Use `ctx.onCleanup()` for anything you create outside the context (timers, global listeners, DOM nodes).

### DI resolution rules

- `ctx.provide(key, value)` registers under a string, `symbol`, or a typed `createInjectionKey<T>()`. `ctx.inject(key)` / the free-standing `inject(key)` returns the value or `undefined`.
- Last write wins for the same key; the binding is owned by the providing plugin and removed on its uninstall. Prefer `createInjectionKey<T>()` for type-safe resolution and to avoid string collisions across plugins.

### Directive-namespacing conventions

- Names are given **without** the `bq-` prefix (`'tooltip'` → `bq-tooltip`); passing a `bq-`-prefixed name throws.
- Use a `namespace:variant` form (e.g. `'tooltip:arrow'`) to group a plugin's directives and avoid collisions. Registering a name that already exists throws, so two plugins cannot silently clobber each other's directives.

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

<!-- uniform-template-footer -->

## Pitfalls and gotchas

- `install()` may be async (1.14.0); concurrent installs of the same plugin name are serialized — do not assume parallel execution.
- `unuse(name)` / `uninstall(name)` detach plugin-owned directives, hooks, and DI bindings — anything you registered manually outside `ctx` survives.
- Namespaced directives like `tooltip:arrow` are parsed via `parseDirective`; the colon is significant.
- Dependencies declared in metadata default to `dependencyMode: 'error'`; use `'warn'` for optional deps.
- DI keys created via `createInjectionKey()` are scoped to the container — use `hasProvided()` before `inject()` when optional.

## Performance notes

- Hook callbacks run synchronously in registration order; keep filter functions pure and fast.
- Use `addAction` for side effects and `addFilter` for value transforms — do not mix.

## Testing this module

- `getInstalledPlugins({ withMetadata: true })` and `getPluginInfo(name)` make assertions about install state explicit.
- Pair with store's `clearPlugins()` in `afterEach` for clean teardown.

## Related modules

- [View](./view) — register custom directives.
- [Component](./components) — DI for shared services (`formContextKey`, etc.).
- [Devtools](./devtools) — inspect installed plugins via `installBrowserBridge`.

## Version history

- **1.15.0** — **graduated to Stable**: hook-bus / DI / install-lifecycle / directive-registration surface frozen for one minor cycle ([#145](https://github.com/bQuery/bQuery/issues/145)). New additive `definePlugin()` authoring helper; plugin-author guide published; install/uninstall symmetry (no leaked directives/filters/actions/DI) covered by tests.
- **1.14.0** — hook bus (`addFilter` / `applyFilters` / `addAction` / `doAction`), DI (`createInjectionKey` / `provide` / `inject` / `hasProvided`), `unuse` / `uninstall`, async `install`, plugin metadata, dependency mode, namespaced directive names, directive lifecycle objects.
