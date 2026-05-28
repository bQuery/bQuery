# WebSocket channel with reconnect

**Problem.** Keep a WebSocket connection alive across network blips with exponential backoff.

**Solution.** [`useWebSocket`](/guide/reactive#websocket-helpers) handles reconnect and heartbeats; combine it with [`useWebSocketChannel`](/guide/reactive#websocket-helpers) for typed framing.

```ts
import { useWebSocketChannel } from '@bquery/bquery/reactive';

type OrdersFrame = {
  channel: string;
  data: { type: string; topic?: string; payload?: unknown };
};

const channel = useWebSocketChannel<{ type: 'subscribe'; topic: string }, OrdersFrame>(
  '/realtime',
  {
    protocols: ['app.v1'],
    autoReconnect: { delay: 500, maxDelay: 10_000, maxAttempts: Infinity, factor: 2 },
    heartbeat: { interval: 25_000, message: 'ping' },
  }
);

const orders = channel.subscribe('orders');
orders.data.subscribe((frame) => frame && render(frame.data));

// Send typed frames
channel.publish('orders', { type: 'subscribe', topic: 'orders' });
```

**Why it works.** Exponential backoff prevents reconnect storms; heartbeats keep proxies from idling out the connection. `channel.ws.dispose()` tears everything down deterministically.

## Related

- [Reactive — WebSocket helpers](/guide/reactive#websocket-helpers)
- [Workflow — Backend API + WebSocket](/workflows/backend-api)
- Longer worked example: [Examples & Recipes — Real-time communication](/guide/examples#real-time-communication)
