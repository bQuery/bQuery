# Reactive

The reactive module provides fine‑grained reactivity with minimal primitives.

```ts
import {
  signal,
  computed,
  effect,
  batch,
  watch,
  readonly,
  effectScope,
  getCurrentScope,
  onScopeDispose,
  useAsyncData,
  useFetch,
  createUseFetch,
  untrack,
  isSignal,
  isComputed,
} from '@bquery/bquery/reactive';

const count = signal(0);
const doubled = computed(() => count.value * 2);

effect(() => {
  console.log('Count changed', count.value);
});

// Watch with value comparison
watch(count, (newVal, oldVal) => {
  console.log(`Changed from ${oldVal} to ${newVal}`);
});

batch(() => {
  count.value++;
  count.value++;
});
```

## Signal

```ts
const name = signal('World');
name.value = 'bQuery';
```

### Signal API

- `value` (getter/setter) – tracked reads, reactive writes
- `peek()` – read without tracking
- `update(updater)` – update based on current value
- `dispose()` – remove all subscribers, preventing memory leaks

### Disposing a Signal

When a signal is no longer needed, call `dispose()` to clean up all subscribers and prevent memory leaks:

```ts
const count = signal(0);

const stop = effect(() => {
  console.log(count.value);
});

count.dispose(); // All subscribers removed, effect no longer tracks this signal
```

## Computed

Computed values are lazy and cached until dependencies change.

```ts
const total = computed(() => price.value * quantity.value);
```

### Computed API

- `value` (getter) – recomputes when dependencies change

## Effect

Effects run immediately and re-run when any accessed signal/computed changes. They can return a cleanup function.

Errors thrown inside effects are caught and logged via `console.error` — the reactive system remains functional, and subsequent signal updates continue to trigger the effect.

```ts
const stop = effect(() => {
  document.title = `Count: ${count.value}`;
  return () => console.log('cleanup');
});

stop();
```

## Batch

Batch groups multiple updates into one notification pass.

```ts
batch(() => {
  count.value = 1;
  count.value = 2;
});
```

## Persisted signals

`persistedSignal` syncs a signal to `localStorage`.

```ts
import { persistedSignal } from '@bquery/bquery/reactive';

const theme = persistedSignal('theme', 'light');
theme.value = 'dark'; // Automatically saved to localStorage
```

::: tip Environment Compatibility
`persistedSignal` gracefully handles environments without `localStorage`:

- **SSR/Node.js**: Falls back to in-memory signal
- **Safari Private Mode**: Catches `SecurityError` and falls back to in-memory signal
- **JSON parse errors**: Falls back to the provided initial value

:::

## Async data composables

Use `useAsyncData()` when you want a signal-based lifecycle around any async function.

```ts
import { signal, useAsyncData } from '@bquery/bquery/reactive';

const userId = signal(1);
const user = useAsyncData(
  () => fetch(`/api/users/${userId.value}`).then((response) => response.json()),
  {
    watch: [userId],
    defaultValue: null,
    onError: (error) => console.error('Failed to load user', error),
  }
);

await user.refresh();
console.log(user.status.value, user.pending.value, user.data.value);
```

### AsyncDataState API

- `data` – signal containing the last resolved value
- `error` – signal containing the last `Error` or `null`
- `status` – `'idle' | 'pending' | 'success' | 'error'`
- `pending` – computed boolean for loading state
- `execute()` / `refresh()` – trigger the async handler manually
- `clear()` – reset data, error, and status
- `dispose()` – stop watchers and future executions

## Fetch composables

`useFetch()` builds on `useAsyncData()` and adds request helpers such as `baseUrl`, `query`, `headers`, automatic JSON serialization for plain-object bodies, and response parsing strategies.

```ts
const users = useFetch<Array<{ id: number; name: string }>>('/users', {
  baseUrl: 'https://api.example.com',
  query: { page: 1, include: 'profile' },
  headers: { authorization: 'Bearer token' },
});
```

### `parseAs` options

- `json` (default)
- `text`
- `blob`
- `arrayBuffer`
- `formData`
- `response`

## Preconfigured fetch factories

`createUseFetch()` is handy when several requests share the same defaults.

```ts
const useApiFetch = createUseFetch({
  baseUrl: 'https://api.example.com',
  headers: { 'x-client': 'bquery-docs' },
});

const profile = useApiFetch<{ id: number; name: string }>('/profile');
```

Factory defaults merge with per-call options, including request headers and query params.

## Linked signals

`linkedSignal` creates a writable computed value by providing a getter and a setter.

```ts
import { linkedSignal, signal } from '@bquery/bquery/reactive';

const first = signal('Ada');
const last = signal('Lovelace');

const fullName = linkedSignal(
  () => `${first.value} ${last.value}`,
  (next) => {
    const [nextFirst, nextLast] = next.split(' ');
    first.value = nextFirst ?? '';
    last.value = nextLast ?? '';
  }
);

console.log(fullName.value); // "Ada Lovelace"
fullName.value = 'Grace Hopper';
```

## Watch

Watch observes a signal and calls a callback with old and new values:

```ts
import { watch } from '@bquery/bquery/reactive';

const count = signal(0);
const stop = watch(count, (newVal, oldVal) => {
  console.log(`Changed: ${oldVal} → ${newVal}`);
});

count.value = 5; // logs: "Changed: 0 → 5"
stop(); // Stop watching
```

## Readonly

Create a read-only view of a signal:

```ts
import { readonly } from '@bquery/bquery/reactive';

const count = signal(0);
const readOnlyCount = readonly(count);

console.log(readOnlyCount.value); // 0
// readOnlyCount.value = 1; // TypeScript error!
```

## Untrack

Read signals without creating dependencies:

```ts
import { untrack } from '@bquery/bquery/reactive';

effect(() => {
  // This will NOT re-run when `other` changes
  const val = untrack(() => other.value);
  console.log(count.value, val);
});
```

## Type Guards

Check if a value is a signal or computed:

```ts
import { isSignal, isComputed } from '@bquery/bquery/reactive';

const count = signal(0);
const doubled = computed(() => count.value * 2);

isSignal(count); // true
isSignal(doubled); // false
isComputed(doubled); // true
isComputed(count); // false
```

## Effect Scope

`effectScope()` creates a scope that collects all effects, computed values, and watches created inside it. When the scope is stopped, all collected resources are disposed at once.

This is essential for managing cleanup in non-component code such as store plugins, router guards, feature modules, and test setup.

`scope.run()` is synchronous-only. Do not pass an async callback — resources
created after an `await` cannot be collected reliably.

```ts
import { effectScope, signal, effect, computed, onScopeDispose } from '@bquery/bquery/reactive';

const scope = effectScope();

scope.run(() => {
  const count = signal(0);
  const doubled = computed(() => count.value * 2);

  effect(() => {
    console.log('Count:', count.value, 'Doubled:', doubled.value);
  });

  onScopeDispose(() => {
    console.log('Custom cleanup');
  });
});

scope.stop(); // All effects, computed values, and custom cleanup run
```

### Nested scopes

Scopes nest automatically — a child scope created inside a parent's `run()` is collected by the parent:

```ts
const parent = effectScope();

parent.run(() => {
  const child = effectScope();
  child.run(() => {
    effect(() => console.log('inner effect'));
  });
});

parent.stop(); // Stops the child scope and its effects too
```

### getCurrentScope

Check whether code is running inside a scope:

```ts
import { effectScope, getCurrentScope } from '@bquery/bquery/reactive';

const scope = effectScope();
scope.run(() => {
  console.log(getCurrentScope() !== undefined); // true
});

console.log(getCurrentScope()); // undefined
```

### onScopeDispose

Register arbitrary cleanup callbacks on the current scope:

```ts
import { effectScope, onScopeDispose } from '@bquery/bquery/reactive';

const scope = effectScope();

scope.run(() => {
  const controller = new AbortController();
  fetch('/api/data', { signal: controller.signal });

  onScopeDispose(() => controller.abort());
});

scope.stop(); // abort() is called
```

### EffectScope API

- `active` (readonly) — `true` until `stop()` is called
- `run(fn)` — Execute `fn` inside the scope, collecting reactive resources
- `stop()` — Dispose all collected resources; safe to call multiple times

## toValue

`toValue()` extracts the underlying value from a `Signal`, a `readonly()` wrapper, a `Computed`, or returns a plain value as-is. This eliminates repetitive `isSignal(x) ? x.value : x` patterns.

`MaybeSignal<T>` includes readonly wrappers returned by `readonly()`. This matches runtime behavior: `toValue()` intentionally unwraps only bQuery readonly wrappers created by `readonly()`, not arbitrary structural `{ value, peek }` objects.

```ts
import { signal, readonly, computed, toValue } from '@bquery/bquery/reactive';

const count = signal(5);
const publicCount = readonly(count);
const doubled = computed(() => count.value * 2);

toValue(42);      // 42 (plain value returned as-is)
toValue(count);   // 5  (reads signal.value)
toValue(publicCount); // 5  (reads readonly signal.value)
toValue(doubled); // 10 (reads computed.value)
```

### MaybeSignal Type

The `MaybeSignal<T>` type represents a value that may be plain, a `Signal<T>`, a readonly wrapper returned by `readonly()`, or a `Computed<T>`. Use it for APIs that accept both reactive and non-reactive inputs:

```ts
import { computed, signal, type MaybeSignal, toValue } from '@bquery/bquery/reactive';

function useTitle(title: MaybeSignal<string>) {
  document.title = toValue(title);
}

useTitle('Hello');               // plain string
useTitle(signal('Hello'));       // reactive signal
useTitle(computed(() => 'Hi')); // computed value
```
