# Paginated data loading

**Problem.** Page through a long REST list with next/prev controls.

**Solution.** [`usePaginatedFetch`](/guide/reactive#paginated-fetch) tracks `page` and exposes `next` / `prev` / `goTo` actions.

```ts
import { effect, usePaginatedFetch } from '@bquery/bquery/reactive';

const users = usePaginatedFetch<User[]>((page) => `/api/users?page=${page}`);

document.querySelector('#next')!.addEventListener('click', () => users.next());
document.querySelector('#prev')!.addEventListener('click', () => users.prev());

effect(() => {
  const items = users.data.value;
  if (items) render(items);
});
```

**Why it works.** `usePaginatedFetch` debounces concurrent page requests, retains the previous page during transitions, and signals `pending` so you can show a spinner without flicker.

## Related

- [Reactive — `usePaginatedFetch`](/guide/reactive#paginated-fetch)
- [Reactive — `useInfiniteFetch`](/guide/reactive#infinite-fetch)
- Longer worked example: [Examples & Recipes — Paginated data loading](/guide/examples#paginated-data-loading)
