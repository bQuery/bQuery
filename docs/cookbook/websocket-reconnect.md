# WebSocket channel with reconnect

**Problem.** Keep a WebSocket connection alive across network blips with exponential backoff.

**Solution.** [`useWebSocket`](/guide/reactive#websocket-helpers) handles reconnect and heartbeats; combine it with [`useWebSocketChannel`](/guide/reactive#websocket-helpers) for typed framing.

```ts
import { useWebSocketChannel } from '@bquery/bquery/reactive';

const channel = useWebSocketChannel('/realtime', {
  protocols: ['app.v1'],
  reconnect: { delay: 500, maxDelay: 10_000, maxAttempts: Infinity, backoff: 'exponential' },
  heartbeat: { interval: 25_000, message: { type: 'ping' } },
});

channel.on('event', (payload) => render(payload));

// Send typed frames
channel.send({ type: 'subscribe', topic: 'orders' });
```

**Why it works.** Exponential backoff prevents reconnect storms; heartbeats keep proxies from idling out the connection. `dispose()` tears everything down deterministically.

## Related

- [Reactive — WebSocket helpers](/guide/reactive#websocket-helpers)
- [Workflow — Backend API + WebSocket](/workflows/backend-api)
- Longer worked example: [Examples & Recipes — Real-time communication](/guide/examples#real-time-communication)
