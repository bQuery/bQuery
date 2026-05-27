# Infinite scroll

**Problem.** Append new items as the user reaches the bottom of a list.

**Solution.** [`useInfiniteFetch`](/guide/reactive#useinfinitefetch) combined with [`useElementVisibility`](/guide/media) from Media.

```ts
import { useInfiniteFetch } from '@bquery/bquery/reactive';
import { useElementVisibility } from '@bquery/bquery/media';
import { effect } from '@bquery/bquery/reactive';

const feed = useInfiniteFetch<Post>('/api/posts', { pageSize: 20 });

const sentinel = document.querySelector('#sentinel') as HTMLElement;
const visible = useElementVisibility(sentinel);

effect(() => {
  if (visible.value && !feed.isFetching.value && feed.hasMore.value) {
    feed.loadMore();
  }
});

feed.items.subscribe((items) => renderFeed(items));
```

**Why it works.** The IntersectionObserver-backed `useElementVisibility` keeps observation cheap; `hasMore` short-circuits requests when the API reports the last page.

## Related

- [Reactive — `useInfiniteFetch`](/guide/reactive#useinfinitefetch)
- [Media — `useElementVisibility`](/guide/media)
- [Cookbook — Pagination](./pagination)
