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

type BunSocketSession = {
  open(socket: unknown): Promise<void>;
  message(socket: unknown, event: MessageEvent): Promise<void>;
  close(socket: unknown, event: CloseEvent): Promise<void>;
};

const getSession = (ws: { data: unknown }) =>
  (ws.data as unknown as { session: BunSocketSession }).session;

// Bun adapter
Bun.serve({
  port: 3000,
  async fetch(request, server) {
    if (isWebSocketRequest(request)) {
      const result = await app.handleWebSocket(request);
      if (result instanceof Response || result === null)
        return result ?? new Response(null, { status: 404 });
      if (isServerWebSocketSession(result)) {
        if (server.upgrade(request, { data: { session: result } })) return;
        return new Response(null, { status: 426 });
      }
    }
    return app.handle(request);
  },
  websocket: {
    open(ws) {
      void getSession(ws).open(ws);
    },
    message(ws, message) {
      void getSession(ws).message(ws, { data: message });
    },
    close(ws, code, reason) {
      void getSession(ws).close(ws, { code, reason });
    },
  },
});
```

The same `app.handle` / `app.handleWebSocket` pair works on Node 24+ and Deno via their respective socket upgrade APIs (see the [SSR workflow](./ssr-hydration#cross-runtime-ci)).

## 2. Client: REST + WebSocket

```ts
// src/chat.ts
import { effect, signal } from '@bquery/bquery/reactive';
import { useFetch, useWebSocket } from '@bquery/bquery/reactive';

type ChatMessage = { user: string; text: string; at: number };
type ChatFrame =
  | { type: 'hello'; room: string }
  | { type: 'message'; entry: ChatMessage }
  | { type: 'echo'; message: unknown };

export const messages = signal<ChatMessage[]>([]);

// Initial load
const { data } = useFetch<ChatMessage[]>('/messages', { immediate: true });
effect(() => {
  const rows = data.value;
  if (rows) messages.value = rows;
});

// Live updates via WebSocket
const ws = useWebSocket<unknown, ChatFrame>('/rooms/lobby', {
  protocols: ['chat.v1'],
  onMessage: (frame) => {
    if (frame.type === 'message') messages.value = [...messages.value, frame.entry];
  },
});

export async function send(user: string, text: string) {
  await fetch('/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ user, text }),
  });
  // No manual refresh — the WS frame patches `messages`.
}

export const dispose = () => ws.dispose();
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
- **Reactive sockets** — `useWebSocket()` keeps the connection signal-managed; UI updates without manual polling.

## Next steps

- Add authentication with route-scoped middleware and `ServerHttpError`.
- Persist `log` to a database and protect `POST /messages` with [Forms validation](/guide/forms).
- Offload message rendering to a worker with the [Off-main-thread workflow](./off-main-thread).
- Pair with the [Streaming SSR workflow](./streaming-ssr) to ship initial chat history server-rendered.
