# Backend API + WebSocket session

Build a small HTTP + WebSocket back-end with [Server](/guide/server) and consume it on the client with [Reactive realtime helpers](/guide/reactive#realtime-helpers).

## 1. Server: routes + a chat room

```ts
// server/main.ts
import {
  badRequest,
  createServer,
  isServerWebSocketSession,
  isWebSocketRequest,
} from '@bquery/bquery/server';

const app = createServer();

// REST: list / post messages
const log: { user: string; text: string; at: number }[] = [];

app.get('/messages', (ctx) => ctx.json(log.slice(-50)));

app.post('/messages', async (ctx) => {
  const body = (await ctx.body()) as { user?: string; text?: string };
  if (!body?.user || !body?.text) throw badRequest('user and text are required');
  const entry = { ...body, at: Date.now() } as (typeof log)[number];
  log.push(entry);
  broadcast(entry);
  return ctx.json(entry, { status: 201 });
});

// WebSocket: live updates per room
const peers = new Set<WebSocket>();
function broadcast(entry: unknown) {
  const frame = JSON.stringify({ type: 'message', entry });
  for (const peer of peers) peer.send(frame);
}

app.ws('/rooms/:id', (ctx) => ({
  protocols: ['chat.v1'],
  onOpen(socket) {
    peers.add(socket as unknown as WebSocket);
    socket.sendJson({ type: 'hello', room: ctx.params.id });
  },
  onMessage(message, socket) {
    socket.sendJson({ type: 'echo', message });
  },
  onClose(socket) {
    peers.delete(socket as unknown as WebSocket);
  },
}));

// Bun adapter
Bun.serve({
  port: 3000,
  async fetch(request, server) {
    if (isWebSocketRequest(request)) {
      const result = await app.handleWebSocket(request);
      if (result instanceof Response || result === null) return result ?? new Response(null, { status: 404 });
      if (isServerWebSocketSession(result)) {
        if (server.upgrade(request, { data: { session: result } })) return;
        return new Response(null, { status: 426 });
      }
    }
    return app.handle(request);
  },
  websocket: {
    open(ws) { void (ws.data as any).session.open(ws); },
    message(ws, message) { void (ws.data as any).session.message(ws, { data: message }); },
    close(ws, code, reason) { void (ws.data as any).session.close(ws, { code, reason }); },
  },
});
```

The same `app.handle` / `app.handleWebSocket` pair works on Node 24+ and Deno via their respective socket upgrade APIs (see the [SSR workflow](./ssr-hydration#cross-runtime-ci)).

## 2. Client: REST + WebSocket channel

```ts
// src/chat.ts
import { signal } from '@bquery/bquery/reactive';
import { useFetch, useWebSocketChannel } from '@bquery/bquery/reactive';

export const messages = signal<{ user: string; text: string; at: number }[]>([]);

// Initial load
const { data, refresh } = useFetch('/messages', { immediate: true });
data.subscribe((rows) => rows && (messages.value = rows));

// Live updates via WebSocket channel
const channel = useWebSocketChannel('/rooms/lobby', {
  protocols: ['chat.v1'],
  parse: (raw) => JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw)),
});

channel.on('message', (frame: any) => {
  if (frame?.type === 'message') messages.value = [...messages.value, frame.entry];
});

export async function send(user: string, text: string) {
  await fetch('/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ user, text }),
  });
  // No manual refresh — the WS frame patches `messages`.
}

export const dispose = () => channel.dispose();
```

## 3. Render the chat

```html
<section bq-on:submit.prevent="send(user, text); text = ''">
  <ul>
    <li bq-for="m in messages" :key="m.at">
      <strong bq-text="m.user"></strong>: <span bq-text="m.text"></span>
    </li>
  </ul>
  <form>
    <input bq-model="user" placeholder="Name" />
    <input bq-model="text" placeholder="Message" />
    <button>Send</button>
  </form>
</section>
```

## What you exercised

- **Dependency-free routing** — `createServer()` covers HTTP and WebSocket with the same context.
- **Runtime adaptation** — `handleWebSocket()` returns a session you bridge to Bun / Node / Deno sockets.
- **Reactive channels** — `useWebSocketChannel()` keeps the connection signal-managed; UI updates without manual subscriptions.

## Next steps

- Add authentication with route-scoped middleware and `ServerHttpError`.
- Persist `log` to a database and protect `POST /messages` with [Forms validation](/guide/forms).
- Offload message rendering to a worker with the [Off-main-thread workflow](./off-main-thread).
- Pair with the [Streaming SSR workflow](./streaming-ssr) to ship initial chat history server-rendered.
