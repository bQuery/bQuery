# Debounced search input

**Problem.** Fire an API request only after the user pauses typing for 300 ms.

**Solution.** Combine [`signal`](/guide/reactive#signal) with [`watchDebounce`](/guide/reactive#watchdebounce-watchthrottle) and [`useFetch`](/guide/reactive#fetch-with-usefetch).

```ts
import { signal, watchDebounce, useFetch } from '@bquery/bquery/reactive';

const query = signal('');
const results = signal<unknown[]>([]);

watchDebounce(
  query,
  (q) => {
    if (!q) return (results.value = []);
    void (async () => {
      const state = useFetch(`/api/search?q=${encodeURIComponent(q)}`, { immediate: false });
      try {
        await state.execute();
        results.value = (state.data.value as unknown[]) ?? [];
      } catch (error) {
        console.error('Search request failed:', error);
        results.value = [];
      } finally {
        state.dispose();
      }
    })();
  },
  300
);

document.querySelector('input#search')!.addEventListener('input', (e) => {
  query.value = (e.target as HTMLInputElement).value;
});
```

**Why it works.** `watchDebounce` preserves the `(newValue, oldValue)` shape of `watch`, so the callback only fires after the user stops typing.

## Related

- [Reactive — `watchDebounce` / `watchThrottle`](/guide/reactive#watchdebounce-watchthrottle)
- [Reactive — `useFetch`](/guide/reactive#fetch-with-usefetch)
- [Reactive — `deduplicateRequest`](/guide/reactive#deduplicaterequest)
- Longer worked example: [Examples & Recipes — Debounced search input](/guide/examples#search-with-debounced-input)
