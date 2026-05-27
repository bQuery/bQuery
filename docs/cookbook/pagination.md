# Paginated data loading

**Problem.** Page through a long REST list with next/prev controls.

**Solution.** [`usePaginatedFetch`](/guide/reactive#usepaginatedfetch) tracks `page`, `totalPages`, and exposes `next` / `prev` actions.

```ts
import { usePaginatedFetch } from '@bquery/bquery/reactive';

const users = usePaginatedFetch<User>('/api/users', {
  pageSize: 25,
  parsePage: (res) => ({ items: res.data, total: res.total }),
});

document.querySelector('#next')!.addEventListener('click', () => users.next());
document.querySelector('#prev')!.addEventListener('click', () => users.prev());

users.items.subscribe(render);
```

**Why it works.** `usePaginatedFetch` debounces concurrent page requests, retains the previous page during transitions, and signals `isFetching` so you can show a spinner without flicker.

## Related

- [Reactive — `usePaginatedFetch`](/guide/reactive#usepaginatedfetch)
- [Reactive — `useInfiniteFetch`](/guide/reactive#useinfinitefetch)
- Longer worked example: [Examples & Recipes — Paginated data loading](/guide/examples#paginated-data-loading)
