# Reactive counter

**Problem.** Increment, decrement, and reset a value with reactive updates wired to the DOM.

**Solution.** Use a [`signal`](/guide/reactive#signal) for the value, [`computed`](/guide/reactive#computed) for derived display state, and bind it via [Core](/guide/api-core) selectors.

```ts
import { $ } from '@bquery/bquery';
import { signal, computed, effect } from '@bquery/bquery/reactive';

const count = signal(0);
const label = computed(() => `Count: ${count.value}`);

const display = $('#display');
const incBtn = $('#inc');
const decBtn = $('#dec');
const resetBtn = $('#reset');

effect(() => {
  display.text(label.value);
});

incBtn.on('click', () => count.value++);
decBtn.on('click', () => count.value--);
resetBtn.on('click', () => (count.value = 0));
```

**Why it works.** `effect` re-runs whenever `label.value` changes, which itself re-derives only when `count.value` changes. Multiple writes inside a click handler coalesce automatically.

## Related

- [Reactive — Signal](/guide/reactive#signal)
- [Reactive — Computed](/guide/reactive#computed)
- [Core API basics](/guide/api-core)
- Longer worked example: [Examples & Recipes — Reactive counter](/guide/examples#reactive-counter)
