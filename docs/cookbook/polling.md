# Polling for live data

**Problem.** Refresh a dashboard widget every few seconds without manual setInterval bookkeeping.

**Solution.** Use [`usePolling`](/guide/reactive#polling) — it pauses on tab hidden, resumes on focus, and exposes a `dispose()` for teardown.

```ts
import { effect, usePolling } from '@bquery/bquery/reactive';

const stats = usePolling(
  async () => {
    const r = await fetch('/api/stats');
    if (!r.ok) throw new Error('failed');
    return r.json();
  },
  { interval: 5_000, immediate: true, pauseOnHidden: true }
);

effect(() => {
  const nextStats = stats.data.value;
  if (nextStats) render(nextStats);
});
// later: stats.dispose();
```

**Why it works.** `usePolling` listens to `document.visibilitychange` to avoid wasting requests, and the returned `data` / `error` / `isActive` are signals you can bind directly to your view.

## Related

- [Reactive — Polling helpers](/guide/reactive#polling)
- [Reactive — `useResource`](/guide/reactive#rest-resource-composable)
- Longer worked example: [Examples & Recipes — Polling for live data](/guide/examples#polling-for-live-data)
