# Reactive

The reactive module provides signals, computed values, and effects. The API is small and composable.

```ts
import { signal, computed, effect } from 'bquery/reactive';

const count = signal(0);
const doubled = computed(() => count.value * 2);

effect(() => {
  console.log('Count changed', count.value);
});
```
