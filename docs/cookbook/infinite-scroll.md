# Infinite scroll

**Problem.** Append new items as the user reaches the bottom of a list.

**Solution.** [`useInfiniteFetch`](/guide/reactive#infinite-fetch) combined with [`useElementVisibility`](/guide/media) from Media.

```ts
import { useInfiniteFetch } from '@bquery/bquery/reactive';
import { useElementVisibility } from '@bquery/bquery/media';
import { effect } from '@bquery/bquery/reactive';

const feed = useInfiniteFetch<Post[], Post[]>((cursor) => `/api/posts?cursor=${cursor ?? ''}`, {
  getNextCursor: (page) => (page.length > 0 ? page[page.length - 1].id : undefined),
  transform: (pages) => pages.flat(),
});

const sentinel = document.querySelector('#sentinel') as HTMLElement;
const visible = useElementVisibility(sentinel);

effect(() => {
  if (visible.value && !feed.pending.value && feed.hasMore.value) {
    void feed.fetchNextPage();
  }

  const items = feed.data.value;
  if (items) renderFeed(items);
});
```

**Why it works.** The IntersectionObserver-backed `useElementVisibility` keeps observation cheap; `hasMore` short-circuits requests when the API reports the last page.

## Related

- [Reactive — `useInfiniteFetch`](/guide/reactive#infinite-fetch)
- [Media — `useElementVisibility`](/guide/media)
- [Cookbook — Pagination](./pagination)
