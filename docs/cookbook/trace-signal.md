# Trace a signal in development

**Problem.** Understand which subscribers fire when a particular signal updates.

**Solution.** Use [`traceSignal`](/guide/devtools) to print the signal lineage to the timeline.

```ts
import { traceSignal, subscribeTimeline, filterTimeline } from '@bquery/bquery/devtools';
import { signal } from '@bquery/bquery/reactive';

const cart = signal<{ items: number }>({ items: 0 });
traceSignal(cart, { label: 'cart' });

subscribeTimeline((entry) => {
  if (entry.type === 'signal:set' && entry.payload?.label === 'cart') {
    console.debug('cart updated', entry.payload);
  }
});

// later:
console.log(filterTimeline({ types: ['signal:set'], search: 'cart' }));
```

**Why it works.** Traces are emitted as timeline entries with millisecond timestamps, so you can diff bursts and correlate them with renders.

## Related

- [Devtools — Timeline](/guide/devtools)
- [Devtools — `traceSignal` / `untraceSignal`](/guide/devtools)
- [Devtools — `installBrowserBridge`](/guide/devtools)
