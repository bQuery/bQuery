---
title: View
---

::: tip What's new in 1.15.0
View **graduated to Stable in 1.15.0**: the directive contract is frozen, the documented `bq-for` duplicate-key and object-expression edge cases are resolved, declarative [enter/leave/move transitions](#transitions) bind the `motion` engine to `bq-if`/`bq-show`/`bq-for`, and an [optional compiler](#optional-compiler-build-step) precompiles `bq-*` expressions. See [Stability](#stability).
:::

The view module provides declarative DOM bindings similar to Vue/Svelte templates, but without requiring a compiler. Bindings are evaluated at runtime using bQuery's reactive system. Internally, the view module is now split into focused submodules while the public API remains unchanged.

```ts
import { mount } from '@bquery/bquery/view';
import { signal, computed } from '@bquery/bquery/reactive';
```

For convenience, `@bquery/bquery/view` re-exports the reactive primitives `signal`, `computed`, `effect`, and `batch`, so view-only setups can use a single import:

```ts
import { mount, signal, computed, effect, batch } from '@bquery/bquery/view';
```

## Stability

`view` is the declarative rendering layer and has been **Beta**. Its directive contract grew materially in 1.14.0 (`bq-once`, `bq-init`, `bq-pre`, `bq-cloak`, `bq-html-safe`, `bq-memo`, and the full `bq-on` modifier system). The work to graduate it is tracked in [#136](https://github.com/bQuery/bQuery/issues/136): freeze the directive set and grammar for one minor cycle, resolve the documented parser edge cases, and publish a versioned directive reference with per-directive SSR support. It **graduated to Stable in 1.15.0**, with the surface frozen under the no-breaking-changes-between-minors contract.

### Exit criteria

- [x] **Directive set + expression grammar frozen for one minor** — see [Frozen directive reference](#frozen-directive-reference-1150) below; no additive directives land during the freeze.
- [x] **`bq-for` duplicate-key edge case resolved** ([#136](https://github.com/bQuery/bQuery/issues/136)) — a deterministic, referentially-stable composite key replaces the colliding key (so duplicate rows reuse their DOM), and the warning is dev-only and emitted once per offending key instead of on every re-render.
- [x] **Object-expression parsing edge case resolved** — shorthand properties (`bq-class="{ active }"`) now behave like JS object shorthand (`{ active: active }`) instead of being silently dropped.
- [x] **Per-directive SSR support documented** ([#128](https://github.com/bQuery/bQuery/issues/128)) — see the [matrix](#per-directive-ssr-support) below.
- [x] **Public surface frozen** (no breaking directive/grammar changes) — committed under the Stable contract from 1.15.0.

### Frozen directive reference (1.15.0)

The frozen directive set: `bq-text`, `bq-html`, `bq-html-safe`, `bq-if`, `bq-show`, `bq-for`, `bq-class`, `bq-style`, `bq-bind:*`, `bq-model`, `bq-on` (+ modifiers), `bq-once`, `bq-init`, `bq-pre`, `bq-cloak`, `bq-memo`, `bq-error`, `bq-aria`, `bq-ref`. The declarative transition companions (`bq-transition`, `bq-in`, `bq-out`, `bq-transition-duration`, `bq-transition-easing`, `bq-animate`) and the `bq-key` / `:key` companion are part of the frozen surface. The expression grammar is standard JavaScript expressions evaluated against the binding context.

### Per-directive SSR support

The SSR renderer evaluates a subset of directives into hydration-ready markup; the rest attach on the client during hydration. Pass `{ directives: 'full' }` to `renderToString()` to server-render the interactive directives, and `onUnsupportedDirective` to enforce the boundary (see the [SSR guide](./ssr)).

| Directive                                                     | SSR (`static`) | SSR (`full`) | Client (hydrate)  |
| ------------------------------------------------------------- | -------------- | ------------ | ----------------- |
| `bq-text` / `bq-html`                                         | yes            | yes          | yes               |
| `bq-if` / `bq-show` / `bq-for`                                | yes            | yes          | yes               |
| `bq-class` / `bq-style` / `bq-bind:*`                         | yes            | yes          | yes               |
| `bq-model`                                                    | no             | yes (value)  | yes               |
| `bq-on:*`                                                     | no             | marker only  | yes (attaches)    |
| `bq-html-safe` / `bq-once` / `bq-init` / `bq-memo` / `bq-ref` | no             | no           | yes (client-only) |
| `bq-error` / `bq-aria`                                        | no             | no           | yes               |
| Transitions (`bq-transition`/`bq-in`/…)                       | no             | no           | yes (client-only) |

Transitions are inherently client-only (they animate live DOM); on the server the companion attributes are inert and stripped/ignored.

## Basic Usage

```html
<div id="app">
  <input bq-model="name" />
  <p bq-text="greeting"></p>
</div>
```

```ts
const name = signal('World');
const greeting = computed(() => `Hello, ${name.value}!`);

const view = mount('#app', { name, greeting });
```

## Directives

### bq-text

Binds text content:

```html
<p bq-text="message"></p>
<span bq-text="count + ' items'"></span>
```

### bq-html

Binds innerHTML (sanitized by default):

```html
<div bq-html="richContent"></div>
```

Sanitization can be disabled (use with caution):

```ts
mount('#app', { content }, { sanitize: false });
```

### bq-if

Conditional rendering (removes/inserts element):

```html
<div bq-if="isLoggedIn">Welcome back!</div>
<div bq-if="!isLoggedIn">Please log in.</div>
```

### bq-show

Toggle visibility via CSS display:

```html
<div bq-show="isVisible">This toggles display: none</div>
```

### bq-class

Dynamic class binding:

```html
<!-- Object syntax -->
<div bq-class="{ active: isActive, disabled: isDisabled }"></div>

<!-- Expression returning string -->
<div bq-class="currentTheme"></div>

<!-- Expression returning array -->
<div bq-class="[baseClass, conditionalClass]"></div>
```

### bq-style

Dynamic inline styles:

```html
<!-- Object syntax -->
<div bq-style="{ color: textColor, fontSize: size + 'px' }"></div>

<!-- Expression returning object -->
<div bq-style="computedStyles"></div>
```

### bq-model

Two-way binding for inputs:

```html
<!-- Text input -->
<input bq-model="username" />

<!-- Checkbox -->
<input type="checkbox" bq-model="isChecked" />

<!-- Radio buttons -->
<input type="radio" value="a" bq-model="selected" />
<input type="radio" value="b" bq-model="selected" />

<!-- Select -->
<select bq-model="selectedOption">
  <option value="1">One</option>
  <option value="2">Two</option>
</select>
```

### bq-error

Render validation or error messages from a form field, signal, computed value, or plain expression.

```html
<!-- Bind a field object -->
<p bq-error="form.fields.email"></p>

<!-- Bind the error signal directly -->
<p bq-error="form.fields.email.error"></p>

<!-- Bind any reactive string source -->
<p bq-error="serverError"></p>
```

`bq-error` sets `textContent`, hides the element when the message is empty, applies `aria-hidden="true"` only when the message is empty and you did not already provide `aria-hidden`, and adds accessible defaults with `role="alert"` and `aria-live="assertive"` unless you already provided those attributes.

```ts
const serverError = signal('');
mount('#app', { form, serverError });
```

### bq-aria

Bind ARIA attributes from an object literal or an expression that returns an object.

```html
<!-- Object syntax -->
<button bq-aria="{ expanded: isOpen, controls: panelId, label: buttonLabel }">Toggle menu</button>

<!-- Expression returning an object -->
<nav bq-aria="navAria"></nav>
```

`bq-aria` automatically prefixes keys with `aria-`, removes attributes for `null`, `undefined`, or empty strings, serializes booleans as `"true"` / `"false"`, and keeps previously applied ARIA attributes in sync when the object shape changes.

```ts
const navAria = signal({
  label: 'Primary navigation',
  current: 'page',
});

mount('#app', { isOpen, panelId, buttonLabel, navAria });
```

### bq-bind:attr

Bind any attribute:

```html
<a bq-bind:href="url" bq-bind:title="tooltip">Link</a>
<img bq-bind:src="imageSrc" bq-bind:alt="imageAlt" />
<button bq-bind:disabled="isDisabled">Submit</button>
```

Falsy values remove the attribute:

```html
<input bq-bind:required="isRequired" />
<!-- If isRequired is false, the 'required' attribute is removed -->
```

### bq-on:event

Event binding:

```html
<button bq-on:click="handleClick">Click me</button>
<input bq-on:input="updateValue" bq-on:blur="validate" />
<form bq-on:submit="handleSubmit">...</form>
```

Access the event object with `$event`:

```html
<button bq-on:click="handleClick($event)">Click</button> <input bq-on:keydown="onKey($event)" />
```

Access the element with `$el`:

```html
<input bq-on:focus="onFocus($el)" />
```

Event listeners also support common modifiers such as `.stop`, `.prevent`,
`.self`, `.capture`, `.passive`, and `.once`. When `.prevent` is present,
passive mode is disabled automatically so `event.preventDefault()` still works.

### bq-cloak

Use `bq-cloak` to hide pre-hydration or pre-mount markup until the view reaches
that element:

```html
<div bq-cloak>
  <p bq-text="message"></p>
</div>
```

```css
[bq-cloak] {
  display: none;
}
```

The attribute is removed during processing so the subtree becomes visible once
the view has mounted.

### bq-pre

Use `bq-pre` to skip directive processing for an element and its descendants:

```html
<section bq-pre>
  <code bq-text="left-as-authored"></code>
</section>
```

This is useful for code samples or third-party DOM islands that should remain
untouched. If `bq-cloak` is also present on the same element, the cloak marker is
still removed even though the subtree is skipped.

### bq-for

List rendering with optional keyed reconciliation for optimal DOM reuse:

```html
<!-- Basic -->
<ul>
  <li bq-for="item in items" bq-text="item.name"></li>
</ul>

<!-- With index -->
<ul>
  <li bq-for="(item, index) in items">
    <span bq-text="index + 1"></span>:
    <span bq-text="item.name"></span>
  </li>
</ul>

<!-- With key for efficient updates (recommended for dynamic lists) -->
<ul>
  <li bq-for="item in items" :key="item.id" bq-text="item.name"></li>
</ul>
```

#### Keyed Reconciliation

When items in a list have unique identifiers, use the `:key` attribute to enable efficient DOM updates. This is similar to Vue's `v-for` with `:key` or React's `key` prop.

**Without a key:** Elements are matched by index. On reorder, DOM nodes stay where they are and the new values are written into each position's item signal — so per-row DOM state (focus, input values, open/closed toggles) sticks to the position, not the item.

**With a key:** Elements are matched by their unique key. If items are reordered, existing DOM nodes are moved rather than recreated, preserving component state and improving performance.

```html
<!-- Using :key (preferred shorthand) -->
<li bq-for="user in users" :key="user.id" bq-text="user.name"></li>

<!-- Alternative: bq-key -->
<li bq-for="user in users" bq-key="user.id" bq-text="user.name"></li>
```

::: tip When to Use Keys
Always use `:key` when:

- List items can be added, removed, or reordered
- Items have associated state (like form inputs)
- Items contain expensive child components
- The list is frequently updated

Keys should be:

- Unique within the list
- Stable (same item → same key across updates)
- Not based on array index (defeats the purpose)
  :::

```ts
const users = signal([
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
  { id: 3, name: 'Charlie' },
]);

mount('#app', { users });

// Reordering preserves DOM elements:
users.value = [
  { id: 3, name: 'Charlie' },
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
];
```

### bq-ref

Element reference:

```html
<input bq-ref="inputEl" />
```

```ts
const inputEl = signal<HTMLInputElement | null>(null);

mount('#app', { inputEl });

// After mount, inputEl.value is the <input> element
inputEl.value?.focus();
```

## Transitions

Declarative enter/leave/move transitions bind the [`motion`](./motion) engine to the structural directives — no lifecycle glue required. They are a thin layer over `motion` (Web Animations for enter/leave, FLIP for moves) and automatically respect the user's reduced-motion preference.

```html
<!-- enter/leave on conditional render -->
<div bq-if="open" bq-transition="fade" bq-transition-duration="200">…</div>

<!-- separate in / out -->
<li bq-if="visible" bq-in="slide-up" bq-out="fade">…</li>

<!-- FLIP move on list reorder -->
<ul>
  <li bq-for="item in items" bq-key="item.id" bq-animate="flip">…</li>
</ul>
```

### Companion attributes

| Attribute                | Applies to                     | Purpose                                                       |
| ------------------------ | ------------------------------ | ------------------------------------------------------------- |
| `bq-transition`          | `bq-if` / `bq-show` / `bq-for` | Named preset used for **both** enter and leave.               |
| `bq-in`                  | `bq-if` / `bq-show` / `bq-for` | Enter-only preset (overrides `bq-transition` for enter).      |
| `bq-out`                 | `bq-if` / `bq-show` / `bq-for` | Leave-only preset (overrides `bq-transition` for leave).      |
| `bq-transition-duration` | same                           | Duration in milliseconds (default `200`; FLIP default `300`). |
| `bq-transition-easing`   | same                           | CSS easing (default `ease`; FLIP default `ease-out`).         |
| `bq-animate="flip"`      | `bq-for`                       | FLIP move animation when list items reorder.                  |

Built-in presets: `fade`, `scale`, `slide`, `slide-up`, `slide-down`, `slide-left`, `slide-right`. (`slide` is an alias for `slide-up`; an unknown name falls back to `fade`.)

### Behaviour

- **No animation on first paint.** Initial render is not animated — only subsequent inserts/removals/reorders are (parity with Vue/Svelte, which require an explicit appear transition).
- **Leave defers removal.** `bq-if` keeps the element mounted until its leave animation finishes, then swaps in the placeholder; `bq-for` removes the row only after its leave resolves.
- **Race-safe.** Re-showing an element while it is leaving cancels the pending removal and animates it back in.
- **Reduced motion.** When `prefers-reduced-motion` is set (or `setReducedMotion(true)`), animations are skipped and state changes commit immediately.

```ts
import { mount, signal } from '@bquery/bquery/view';

const items = signal([{ id: 1, label: 'One' }]);
mount('#list', {
  items,
  add: () => (items.value = [...items.value, { id: items.value.length + 1, label: 'New' }]),
});
```

```html
<ul id="list">
  <li
    bq-for="item in items"
    bq-key="item.id"
    bq-animate="flip"
    bq-in="slide-up"
    bq-out="fade"
    bq-text="item.label"
  ></li>
</ul>
```

## Optional compiler (build step)

`view` evaluates directive expressions at runtime via `new Function()` — exactly right for the zero-build CDN story, but it requires `'unsafe-eval'` in your CSP and pays a parse cost on the hot path. The **opt-in** compiler at `@bquery/bquery/view/compiler` pre-parses `bq-*` expressions at build time and emits optimized, `with`-free update functions. The runtime evaluator stays the default; compiled and runtime paths are behaviourally identical, and any expression the compiler can't statically handle transparently falls back to runtime.

```ts
import { compileToModule } from '@bquery/bquery/view/compiler';

const { code, stats } = compileToModule(templateHtml);
// Write `code` to disk and import it once before mounting. The emitted module
// calls registerCompiledExpressions(...) — no `new Function()`, CSP-safe.
console.log(`${stats.compiled}/${stats.total} expressions compiled`);
```

The emitted module registers the precompiled functions via `registerCompiledExpressions()` (from `@bquery/bquery/view`); the runtime then uses them automatically. You can also register a map by hand and clear it with `clearCompiledExpressions()`:

```ts
import { registerCompiledExpressions, clearCompiledExpressions } from '@bquery/bquery/view';

registerCompiledExpressions({ 'count + 1': ($ctx) => $ctx.count + 1 });
// …later, to restore the pure runtime path (e.g. in tests):
clearCompiledExpressions();
```

### CLI

A dependency-free CLI compiles template files to sibling modules (pass explicit paths; let your shell expand globs):

```bash
bquery-view-compile --out-dir src/views/.compiled src/views/*.html
```

Or drive it from a build script with `compileFiles()` / `runCompileCli()`. The compiler is intentionally **not** a build tool of its own — `compileViews()` and `compileToModule()` are small transforms usable from any bundler (Vite/esbuild/Rollup).

### What compiles

The transform is conservative: identifiers, member access, calls, arithmetic/logical/comparison operators, ternaries, array and object literals (including shorthand), and string literals compile. It bails — and the expression falls back to runtime — on assignments (except `++`/`--`, which compile), arrow/`function` bodies, `new`, spread, regex and template literals. Those skipped expressions are listed in `stats.skipped` with a reason, so nothing is silently dropped.

## Mounting

### mount()

Mount a view to an existing element:

```ts
const name = signal('World');

const view = mount('#app', {
  name,
  greeting: computed(() => `Hello, ${name.value}!`),
  handleClick: () => console.log('Clicked!'),
});
```

With options:

```ts
const view = mount('#app', context, {
  prefix: 'x', // Use x-text instead of bq-text
  sanitize: false, // Disable HTML sanitization
});
```

### View Instance

The returned view object:

```ts
type View = {
  el: Element; // The root element
  context: BindingContext; // The binding context
  update: (newContext: Partial<BindingContext>) => void;
  destroy: () => void; // Cleanup all effects
};
```

### Updating Context

```ts
const view = mount('#app', { count: signal(0) });

// Add new values to context
view.update({
  newValue: signal('hello'),
});
```

### Cleanup

Always destroy views when done:

```ts
view.destroy();
```

### Clearing Expression Cache

The view module caches compiled expressions for performance. In rare cases (e.g., testing or dynamic template changes), you may want to clear this cache:

```ts
import { clearExpressionCache } from '@bquery/bquery/view';

// Clear all cached expression functions
clearExpressionCache();
```

::: tip When to Use
You typically don't need to call this. It's mainly useful for:

- Test environments that mount/unmount many views
- Hot module replacement (HMR) scenarios
- Memory-constrained applications with many dynamic templates

:::

## Templates

Create reusable template functions:

```ts
import { createTemplate } from '@bquery/bquery/view';

const TodoItem = createTemplate(`
  <li bq-class="{ completed: done }">
    <input type="checkbox" bq-model="done" />
    <span bq-text="text"></span>
  </li>
`);

// Create instances
const item1 = TodoItem({
  done: signal(false),
  text: 'Buy groceries',
});

const item2 = TodoItem({
  done: signal(true),
  text: 'Walk the dog',
});

document.querySelector('#list')!.append(item1.el, item2.el);

// Cleanup
item1.destroy();
item2.destroy();
```

## Custom Prefix

Use a custom directive prefix:

```html
<div id="app">
  <p x-text="message"></p>
  <div x-if="showDetails">Details</div>
</div>
```

```ts
mount('#app', context, { prefix: 'x' });
```

## Expressions

Directives accept JavaScript expressions:

```html
<!-- Arithmetic -->
<span bq-text="count + 1"></span>

<!-- Ternary -->
<span bq-text="isActive ? 'Active' : 'Inactive'"></span>

<!-- Method calls -->
<span bq-text="items.length"></span>

<!-- Template literals (with proper escaping) -->
<span bq-text="`Total: ${total}`"></span>
```

## Integration with Components

Use view bindings inside Web Components. `mount()` takes a selector string or an `Element`, so create a container element, put the `bq-*` markup into it, and mount that container:

```ts
import { mount, type View } from '@bquery/bquery/view';
import { signal } from '@bquery/bquery/reactive';

class CounterApp extends HTMLElement {
  private view: View | null = null;

  connectedCallback() {
    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
    const container = document.createElement('div');
    container.innerHTML = `
      <span bq-text="count"></span>
      <button bq-on:click="increment()">+</button>
    `;
    root.replaceChildren(container);

    const count = signal(0);
    this.view = mount(container, {
      count,
      increment: () => count.value++,
    });
  }

  disconnectedCallback() {
    this.view?.destroy();
    this.view = null;
  }
}

customElements.define('counter-app', CounterApp);
```

::: warning
Don't mount a view onto markup that bQuery's `component()` helper renders: its `render()` output is re-written on every update, which would destroy the mounted bindings (and `connected()` runs before the first render, so the markup doesn't exist yet at that point). Inside `component()`, use its own `signals` bindings instead, or mount into a container the component never re-renders.
:::

## Type Reference

```ts
type BindingContext = Record<string, unknown>;

type MountOptions = {
  prefix?: string; // Default: 'bq'
  sanitize?: boolean; // Default: true
};

type View = {
  el: Element;
  context: BindingContext;
  update: (newContext: Partial<BindingContext>) => void;
  destroy: () => void;
};
```

### `parseDirective()`

`parseDirective()` is exported for tooling and advanced integrations that need to
inspect directive syntax without mounting a view.

Pass the directive name after removing the `bq-` prefix:

```ts
import { parseDirective } from '@bquery/bquery/view';

const parsed = parseDirective('on:click.stop.prevent');

console.log(parsed.directive); // 'on'
console.log(parsed.arg); // 'click'
console.log(parsed.modifiers.has('stop')); // true
console.log(parsed.modParams); // [Object: null prototype] {} (no prototype methods)
```

`parseDirective()` also parses `name-value` modifiers such as `debounce-300` into `modParams`:

```ts
const parsed = parseDirective('model.debounce-300.trim');
console.log(parsed.modParams.debounce); // '300'
```

::: warning `modParams` is for tooling only
No built-in directive consumes `modParams` today — it exists for custom directives and external tooling. In particular:

- `bq-model` supports **no modifiers**; anything after the directive name is ignored.
- On `bq-on` keyboard events, any modifier that isn't a reserved keyword (`.stop`, `.prevent`, `.self`, `.capture`, `.once`, `.passive`, system keys, mouse buttons) is treated as a **key filter** — `bq-on:keydown.debounce-300` adds the key filter `debounce`, so the handler only fires when `event.key` is literally `"debounce"`, i.e. never. Use `debounce()` from `@bquery/bquery/core` inside the handler instead.

:::

## Security Considerations

::: danger Expression Evaluation Warning
The view module uses `new Function()` to evaluate directive expressions at runtime. This is similar to how Vue and Alpine.js work, but carries important security implications.
:::

### What This Means

When you write:

```html
<span bq-text="user.name"></span>
```

The expression `user.name` is evaluated dynamically at runtime using JavaScript's `new Function()` constructor. This is essentially equivalent to `eval()` in terms of security.

### Safe Usage

✅ **DO** use expressions from developer-controlled templates:

```html
<!-- In your HTML file or template literal -->
<div bq-if="isLoggedIn" bq-text="username"></div>
```

✅ **DO** sanitize context values that come from users:

```ts
const userInput = signal(sanitizeHtml(untrustedInput));
mount('#app', { userInput });
```

### Unsafe Usage

❌ **NEVER** use expressions derived from user input:

```ts
// DANGEROUS! Never do this:
const userExpression = getUserInput(); // e.g., "alert('hacked')"
element.setAttribute('bq-text', userExpression);
mount(element, context);
```

❌ **NEVER** load templates with bq-\* attributes from untrusted sources:

```ts
// DANGEROUS! Template could contain malicious expressions:
const template = await fetch('/api/user-template').then((r) => r.text());
container.innerHTML = template;
mount(container, context); // Malicious bq-on:click expressions could execute
```

### If You Need User-Generated Templates

If your application requires loading templates from external sources:

1. **Validate attribute values** before mounting - strip or escape bq-\* attributes
2. **Use an allowlist** of permitted expressions
3. **Consider a sandboxed approach** using iframes for truly untrusted content
4. **Use static bindings** with sanitized values instead of dynamic expressions:

```ts
// Instead of allowing bq-text="userExpression"
// Use a safe static binding:
element.textContent = sanitizeHtml(userValue);
```

### Why Not Use a Safer Parser?

A fully sandboxed expression parser would:

- Add significant bundle size
- Reduce expression flexibility
- Still require careful security review

The current approach matches industry standards (Vue, Alpine, Angular) while keeping the implementation focused and predictable. The key is ensuring expressions come only from trusted sources.

<!-- uniform-template-footer -->

## Directive reference (1.15.0, frozen)

| Directive                            | Purpose                                                                                                                                        |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `bq-text`                            | Set element text content from an expression.                                                                                                   |
| `bq-html` / `bq-html-safe`           | Render HTML — `bq-html-safe` sanitizes before insertion.                                                                                       |
| `bq-model`                           | Two-way binding for inputs, selects, textareas, checkboxes.                                                                                    |
| `bq-show` / `bq-if`                  | Toggle visibility or DOM mounting on a condition.                                                                                              |
| `bq-for`                             | Render lists from arrays (non-array values render nothing); supports keyed reconciliation via `:key` / `bq-key`.                               |
| `bq-on:event[.mods]`                 | Event handler with modifier matrix (`.prevent`, `.stop`, `.once`, `.passive`, `.capture`, `.self`, `.left`, `.right`, `.middle`, key filters). |
| `bq-class` / `bq-style`              | Reactive class / style objects.                                                                                                                |
| `bq-bind:*` / `bq-aria`              | Reactive attribute binding / ARIA bag.                                                                                                         |
| `bq-once`                            | Run the binding exactly once, then untrack.                                                                                                    |
| `bq-init`                            | Execute an expression on mount only.                                                                                                           |
| `bq-pre`                             | Skip directive parsing in this subtree (preserve literal source).                                                                              |
| `bq-cloak`                           | Hide until the view is mounted to prevent FOUC.                                                                                                |
| `bq-memo`                            | Marker directive: evaluates its expression once, untracked; the subtree still binds normally (no caching).                                     |
| `bq-error`                           | Render a validation/error message from a signal, field, or `{ error }` object; toggles `hidden`, adds `role="alert"` / `aria-live`.            |
| `bq-transition` / `bq-in` / `bq-out` | Declarative enter/leave [transitions](#transitions) on `bq-if` / `bq-show` / `bq-for` (companion attributes).                                  |
| `bq-animate="flip"`                  | FLIP [move transition](#transitions) when `bq-for` items reorder.                                                                              |

## Pitfalls and gotchas

- View expressions run through `new Function(...)` — your CSP must allow `'unsafe-eval'`, or you precompile expressions with the [optional compiler](#optional-compiler-build-step) / `registerCompiledExpressions()` so the runtime evaluator is skipped.
- `bq-html` sanitizes when the `sanitize` mount option is `true` (the default); `bq-html-safe` sanitizes unconditionally — prefer it for untrusted content to guard against accidental `sanitize: false`.
- `bq-for` requires stable keys for reordering — supply `:key="item.id"` (or `bq-key="item.id"`) to avoid re-creating subtrees.
- `bq-model` supports text-like inputs, textareas, single-select `<select>`, checkboxes, and radios. `<select multiple>` is not supported — it reads only the first selected option as a single string.
- Call `destroy()` on the `View` returned by `mount()` when removing dynamic views — leaked bindings keep signals subscribed.

## Performance notes

- Key your `bq-for` lists (`:key="item.id"`) so reorders move DOM nodes instead of rewriting every row in place.
- Use `bq-once` for write-once data (translations, server-injected props) to skip per-update work.
- Cache compiled templates with `createTemplate()` when instantiating many copies.

## Testing this module

- Import `mount()` from `@bquery/bquery/view`, then pair it with `screen`, `within()`, `fireEvent.*`, and `tick()` from `@bquery/bquery/testing` to drive views in `bun:test`.
- Combine with `mockSignal()` to assert reactivity at the directive level.

## Related modules

- [Reactive](./reactive) — the signal layer view bindings subscribe to.
- [Component](./components) — declarative components that compose views.
- [Security](./security) — sanitizer, Trusted Types, and CSP guidance for `bq-html`.
- [Plugin](./plugin) — register custom directives (`tooltip`, `tooltip:arrow`, …).

## Version history

- **1.16.0** — per-update work moved to bind time (object-expression parsing, transition resolution, directive parsing memoized, sandbox proxies cached per context); unchanged DOM writes skipped in `bq-text`/`bq-bind`/`bq-model`/`bq-html` (fixes the `bq-model` caret reset); `bq-for` dispatched before other directives on the same element; `bq-once`/`bq-memo`/`bq-init` evaluate untracked; `bq-html` children are no longer directive-bound.
- **1.15.0** — **graduated to Stable**: directive set + grammar frozen; `bq-for` duplicate-key and object-expression (`{ active }` shorthand) edge cases resolved; declarative enter/leave/move transitions (`bq-transition`, `bq-in`, `bq-out`, `bq-transition-duration`, `bq-transition-easing`, `bq-animate="flip"`); optional `@bquery/bquery/view/compiler` build step with `registerCompiledExpressions` / `clearCompiledExpressions` runtime hooks.
- **1.14.0** — `parseDirective`, `ParsedDirective`, new directives `bq-once`, `bq-init`, `bq-pre`, `bq-cloak`, `bq-html-safe`, `bq-memo`, full `bq-on` modifier system.
