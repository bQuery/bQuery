# Reactive

The reactive module provides fine‑grained reactivity with minimal primitives.

```ts
import { signal, computed, effect, batch } from '@bquery/bquery/reactive';

const count = signal(0);
const doubled = computed(() => count.value * 2);

effect(() => {
  console.log('Count changed', count.value);
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
theme.value = 'dark';
```
