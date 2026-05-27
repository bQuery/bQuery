# Polling for live data

**Problem.** Refresh a dashboard widget every few seconds without manual setInterval bookkeeping.

**Solution.** Use [`usePolling`](/guide/reactive#polling-helpers) — it pauses on tab hidden, resumes on focus, and exposes a `dispose()` for teardown.

```ts
import { usePolling } from '@bquery/bquery/reactive';

const stats = usePolling(
  async () => {
    const r = await fetch('/api/stats');
    if (!r.ok) throw new Error('failed');
    return r.json();
  },
  { interval: 5_000, immediate: true, pauseOnHidden: true }
);

stats.data.subscribe((d) => render(d));
// later: stats.dispose();
```

**Why it works.** `usePolling` listens to `document.visibilitychange` to avoid wasting requests, and the returned `data` / `error` / `isPolling` are signals you can bind directly to your view.

## Related

- [Reactive — Polling helpers](/guide/reactive#polling-helpers)
- [Reactive — `useResource`](/guide/reactive#rest-resource-composable)
- Longer worked example: [Examples & Recipes — Polling for live data](/guide/examples#polling-for-live-data)
