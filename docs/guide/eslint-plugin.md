# ESLint Plugin

`@bquery/eslint-plugin` turns several of bQuery's documented invariants into lint rules, so mistakes such as a `$()` call that throws during SSR or a `trusted()` call on user input are caught in the editor instead of in production.

| Rule                                                    | Recommended | Fix        | Catches                                                           |
| ------------------------------------------------------- | ----------- | ---------- | ----------------------------------------------------------------- |
| [`no-top-level-dollar`](#no-top-level-dollar)           | `warn`      | —          | `$()` calls that run on import and throw when the element is gone |
| [`no-dynamic-trusted-html`](#no-dynamic-trusted-html)   | `error`     | suggestion | `trusted()` / `unsafeHtml()` on dynamic, unsanitized values       |
| [`prefer-scoped-reactivity`](#prefer-scoped-reactivity) | `warn`      | suggestion | `signal()` / `computed()` / `effect()` that leak from a component |
| [`no-value-in-untracked`](#no-value-in-untracked)       | `warn`      | suggestion | `.value` reads in `untrack()` / `watch()` callbacks               |
| [`prefer-subpath-imports`](#prefer-subpath-imports)     | `warn`      | autofix    | Imports from the root entry instead of `@bquery/bquery/<module>`  |

All rules follow imports: they only fire for functions imported from `@bquery/bquery`, its module subpaths or `@bquery/bquery/full` (named, renamed or namespace imports). A local function that happens to be called `$` or `trusted` is ignored.

## Installation

The plugin requires ESLint 9 or later and a flat config (`eslint.config.js`).

::: code-group

```sh [bun]
bun add -d eslint @bquery/eslint-plugin
```

```sh [npm]
npm install -D eslint @bquery/eslint-plugin
```

```sh [pnpm]
pnpm add -D eslint @bquery/eslint-plugin
```

:::

## Usage

Add the recommended config to your flat config. It registers the plugin under the `@bquery` prefix and enables every rule:

```js
// eslint.config.js
import bquery from '@bquery/eslint-plugin';

export default [
  // ...your other configs
  bquery.configs.recommended,
];
```

To pick rules or severities yourself, register the plugin and list the rules:

```js
// eslint.config.js
import bquery from '@bquery/eslint-plugin';

export default [
  {
    files: ['src/**/*.{js,ts}'],
    plugins: { '@bquery': bquery },
    rules: {
      '@bquery/no-top-level-dollar': 'error',
      '@bquery/no-dynamic-trusted-html': 'error',
      '@bquery/prefer-scoped-reactivity': 'warn',
      '@bquery/no-value-in-untracked': 'warn',
      '@bquery/prefer-subpath-imports': 'off',
    },
  },
];
```

For TypeScript sources, use the rules together with `@typescript-eslint/parser` as usual; the rules need no type information.

## no-top-level-dollar

`$()` throws when no element matches its selector (`$$()` returns an empty collection instead). A `$()` call at module top level runs as soon as the module is imported — during SSR, in unit tests, or before the DOM is ready — and turns a missing element into an import-time crash.

The rule reports `$()` calls that run on module load: top-level statements, immediately invoked functions, static class fields and static blocks. Calls inside functions, event handlers, lifecycle hooks and instance fields are fine.

It is a warning in the recommended config: a browser-only entry module loaded with `<script type="module">` is deferred until the document is parsed, so top-level `$()` is safe there. Turn the rule off for such files, and keep it on for code that is shared with SSR or imported by tests.

```ts
// ❌ Bad — throws on import when #app is not in the document
import { $ } from '@bquery/bquery/core';

const app = $('#app');
app.text('Ready');
```

```ts
// ✅ Good — runs once the DOM exists
import { $, $$ } from '@bquery/bquery/core';

export function mount() {
  $('#app').text('Ready');
}

// ✅ Good — $$() is safe for optional elements
$$('.toast').remove();
```

## no-dynamic-trusted-html

`trusted()` marks HTML for verbatim insertion into `safeHtml` templates. It expects markup produced by `sanitizeHtml()` or `safeHtml`; passing anything else skips sanitization. `unsafeHtml()` from `@bquery/bquery/storybook` bypasses the `storyHtml` sanitizer entirely.

The rule reports calls whose argument is not static:

- static strings are allowed: string literals, template literals without `${}` expressions, `+` concatenations of those, and `const` bindings initialised with them;
- so is output that bQuery already sanitized or escaped: a direct `sanitizeHtml()` / `sanitize()` / `escapeHtml()` call, or a `safeHtml` / `storyHtml` / `storySvg` tagged template.

Suggestions: wrap the argument of `trusted()` in your imported `sanitizeHtml` (when it is imported), or drop `unsafeHtml()` inside a template so `storyHtml` sanitizes the value.

```ts
// ❌ Bad — user input is spliced verbatim
import { safeHtml } from '@bquery/bquery/component';
import { trusted } from '@bquery/bquery/security';

const markup = safeHtml`<div>${trusted(comment.body)}</div>`;
```

```ts
// ✅ Good — sanitize first, then mark as trusted
import { safeHtml } from '@bquery/bquery/component';
import { sanitizeHtml, trusted } from '@bquery/bquery/security';

const markup = safeHtml`<div>${trusted(sanitizeHtml(comment.body))}</div>`;
```

```ts
// ❌ Bad — story args can be anything
storyHtml`<bq-card>${unsafeHtml(args.content)}</bq-card>`;

// ✅ Good — static, author-controlled markup
const icon = '<svg width="16" height="16"><circle cx="8" cy="8" r="6" /></svg>';
storyHtml`<bq-icon>${unsafeHtml(icon)}</bq-icon>`;
```

## prefer-scoped-reactivity

`signal()`, `computed()` and `effect()` created inside a component live until they are disposed by hand. Their component-scoped counterparts `useSignal()`, `useComputed()` and `useEffect()` are disposed automatically when the component disconnects.

The rule reports unscoped primitives called directly in the `beforeMount`, `connected`, `onAttributeChanged` and `onAdopted` hooks of a `component()` / `defineComponent()` definition — the hooks that run with the component scope active. Calls in nested callbacks (which may run after the scope is gone) and in `render()` (where the `use*` variants throw) are not reported. Definition-level `signals` shared by every instance are left alone.

The suggestion renames the call and, when `useSignal` / `useComputed` / `useEffect` is not imported yet, adds it to an existing named import from `@bquery/bquery` or `@bquery/bquery/component`.

```ts
// ❌ Bad — the effect keeps running after the element is removed
import { component } from '@bquery/bquery/component';
import { effect, signal } from '@bquery/bquery/reactive';

component('live-clock', {
  connected() {
    const now = signal(Date.now());
    effect(() => {
      this.title = new Date(now.value).toISOString();
    });
  },
  render: () => '<slot></slot>',
});
```

```ts
// ✅ Good — disposed on disconnect
import { component, useEffect, useSignal } from '@bquery/bquery/component';

component('live-clock', {
  connected() {
    const now = useSignal(Date.now());
    useEffect(() => {
      this.title = new Date(now.value).toISOString();
    });
  },
  render: () => '<slot></slot>',
});
```

## no-value-in-untracked

Reading `signal.value` subscribes the current observer. Some callbacks do not subscribe to what they read:

- `untrack(fn)` runs `fn` with dependency tracking off;
- the callback of `watch(source, cb)`, `watchDebounce()` and `watchThrottle()` only re-runs when `source` changes. Other signals read inside it never trigger the callback (with `watch()` they only cause redundant re-evaluations of the internal effect).

A `.value` read there looks reactive but is not. The rule reports `.value` reads on identifiers directly inside such callbacks and suggests `.peek()`, which states the intent and never subscribes. Writes (`x.value = …`, `x.value++`), the callback's own parameters and locals, and reads in nested functions are ignored.

```ts
// ❌ Bad — changing `page` does not re-run the callback
import { signal, watch } from '@bquery/bquery/reactive';

const query = signal('');
const page = signal(1);

watch(query, (next) => {
  search(next, page.value);
});
```

```ts
// ✅ Good — the untracked read is explicit
watch(query, (next) => {
  search(next, page.peek());
});

const snapshot = untrack(() => count.peek());
```

## prefer-subpath-imports

The root `@bquery/bquery` entry re-exports every module. Importing from the module subpath (`@bquery/bquery/reactive`, `@bquery/bquery/core`, …) keeps the module graph small for bundlers, dev servers and tests, and documents which module a name comes from.

The rule autofixes named imports from the root entry:

- when every name comes from one module, the source is rewritten;
- when the names come from several modules, the import is split into one import per subpath, keeping `import type` and inline `type` specifiers;
- when a name has no known subpath (or splitting would drop a comment), the import is reported without a fix.

Side-effect (`import '@bquery/bquery'`) and namespace (`import * as bq`) imports are not reported, nor are imports from `@bquery/bquery/full`.

```ts
// ❌ Bad
import { $, component, signal, type Signal } from '@bquery/bquery';
```

```ts
// ✅ Good — what the autofix produces
import { $ } from '@bquery/bquery/core';
import { component } from '@bquery/bquery/component';
import { signal, type Signal } from '@bquery/bquery/reactive';
```

The export → subpath map ships with the plugin and is generated from bQuery's module barrels. In the bQuery repository, regenerate it after changing a public export:

```sh
bun packages/eslint-plugin/scripts/generate-export-map.mjs
```
