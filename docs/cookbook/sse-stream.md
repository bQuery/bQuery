# Server-Sent Events stream

**Problem.** Consume an SSE endpoint and render incoming events without manual `EventSource` plumbing.

**Solution.** [`useEventSource`](/guide/reactive#server-sent-events-sse) exposes `data`, `eventName`, `error`, and lifecycle controls as signals.

```ts
import { effect, useEventSource } from '@bquery/bquery/reactive';

const sse = useEventSource('/events', {
  events: ['progress', 'done'],
  autoReconnect: { delay: 1_000, maxAttempts: 5 },
});

effect(() => {
  if (sse.eventName.value === 'progress') updateBar(sse.data.value);
  if (sse.eventName.value === 'done') finish(sse.data.value);
});
```

**Why it works.** `useEventSource` parses JSON by default and surfaces both named events and the catch-all stream, so a single composable powers progress indicators and final-state handling.

## Related

- [Reactive — SSE helpers](/guide/reactive#server-sent-events-sse)
- [Server — `ctx.sse`](/guide/server)
- Longer worked example: [Examples & Recipes — Real-time communication](/guide/examples#real-time-communication)
