# Trace a signal in development

**Problem.** Understand which subscribers fire when a particular signal updates.

**Solution.** Use [`traceSignal`](/guide/devtools) to print the signal lineage to the timeline.

```ts
import {
  enableDevtools,
  filterTimeline,
  subscribeTimeline,
  traceSignal,
  trackSignal,
} from '@bquery/bquery/devtools';
import { signal } from '@bquery/bquery/reactive';

const cart = signal<{ items: number }>({ items: 0 });
enableDevtools(true);
trackSignal(
  'cart',
  () => cart.peek(),
  () => 0
);
traceSignal('cart');

subscribeTimeline((entry) => {
  if (entry.type === 'signal:update' && entry.source === 'cart') {
    console.debug('cart updated', entry.payload);
  }
});

// later:
console.log(filterTimeline({ types: ['signal:update'], search: 'cart' }));
```

**Why it works.** Traces are emitted as timeline entries with millisecond timestamps, so you can diff bursts and correlate them with renders.

## Related

- [Devtools — Timeline](/guide/devtools)
- [Devtools — `traceSignal` / `untraceSignal`](/guide/devtools)
- [Devtools — `installBrowserBridge`](/guide/devtools)
