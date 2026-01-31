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

## Computed

Computed values are lazy and cached until dependencies change.

```ts
const total = computed(() => price.value * quantity.value);
```

### Computed API

- `value` (getter) – recomputes when dependencies change

## Effect

Effects run immediately and re-run when any accessed signal/computed changes. They can return a cleanup function.

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
