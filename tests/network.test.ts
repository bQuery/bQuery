import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import {
  createHttp,
  createRequestQueue,
  createRestClient,
  deduplicateRequest,
  useResource,
  useResourceList,
  useSubmit,
  useWebSocket,
  useWebSocketChannel,
  useEventSource,
  signal,
} from '../src/reactive/signal';
import type { HttpResponse } from '../src/reactive/http';
import type { UseEventSourceOptions } from '../src/reactive/websocket';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

const asMockFetch = (
  handler: (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>
): typeof fetch =>
  Object.assign(handler, {
    preconnect: (_url: string | URL, _options?: { dns?: boolean; tcp?: boolean; tls?: boolean }) =>
      undefined,
  }) as typeof fetch;

// ---------------------------------------------------------------------------
// WebSocket mock
// ---------------------------------------------------------------------------

type MockWSListener = (event: unknown) => void;
type GlobalWithWebSocket = { WebSocket: typeof MockWebSocket };
const getGlobalWebSocket = (): typeof MockWebSocket =>
  (globalThis as unknown as GlobalWithWebSocket).WebSocket;
const setGlobalWebSocket = (WebSocketCtor: typeof MockWebSocket): void => {
  (globalThis as unknown as GlobalWithWebSocket).WebSocket = WebSocketCtor;
};

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  protocol = '';
  bufferedAmount = 0;
  extensions = '';
  binaryType: BinaryType = 'blob';
  sentMessages: unknown[] = [];

  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  private _listeners: Record<string, MockWSListener[]> = {};

  constructor(url: string, _protocols?: string | string[]) {
    this.url = url;
    setLastMockWS(this);
    // Auto-connect asynchronously
    setTimeout(() => this._simulateOpen(), 0);
  }

  addEventListener(type: string, listener: MockWSListener): void {
    if (!this._listeners[type]) this._listeners[type] = [];
    this._listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: MockWSListener): void {
    const arr = this._listeners[type];
    if (arr) {
      const idx = arr.indexOf(listener);
      if (idx !== -1) arr.splice(idx, 1);
    }
  }

  dispatchEvent(event: unknown): boolean {
    const type = (event as Event).type;
    const listeners = this._listeners[type];
    if (listeners) {
      for (const listener of listeners) listener(event);
    }
    return true;
  }

  send(data: unknown): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    this.sentMessages.push(data);
  }

  close(code = 1000, reason = ''): void {
    if (
      this.readyState === MockWebSocket.CLOSED ||
      this.readyState === MockWebSocket.CLOSING
    ) {
      return;
    }
    this.readyState = MockWebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      const event = new Event('close') as CloseEvent;
      Object.defineProperty(event, 'code', { value: code });
      Object.defineProperty(event, 'reason', { value: reason });
      Object.defineProperty(event, 'wasClean', { value: code === 1000 });
      this.onclose?.(event);
    }, 0);
  }

  // --- Simulation helpers ---

  _simulateOpen(): void {
    if (this.readyState === MockWebSocket.CONNECTING) {
      this.readyState = MockWebSocket.OPEN;
      const event = new Event('open');
      this.onopen?.(event);
    }
  }

  _simulateMessage(data: string | ArrayBuffer | Blob): void {
    if (this.readyState !== MockWebSocket.OPEN) return;
    const event = new MessageEvent('message', { data });
    this.onmessage?.(event);
  }

  _simulateError(): void {
    const event = new Event('error');
    this.onerror?.(event);
  }

  _simulateClose(code = 1006, reason = ''): void {
    this.readyState = MockWebSocket.CLOSED;
    const event = new Event('close') as CloseEvent;
    Object.defineProperty(event, 'code', { value: code });
    Object.defineProperty(event, 'reason', { value: reason });
    Object.defineProperty(event, 'wasClean', { value: false });
    this.onclose?.(event);
  }
}

// ---------------------------------------------------------------------------
// EventSource mock
// ---------------------------------------------------------------------------

class MockEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSED = 2;

  readyState = MockEventSource.CONNECTING;
  url: string;
  withCredentials = false;

  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  private _listeners: Record<string, MockWSListener[]> = {};

  constructor(url: string, _init?: EventSourceInit) {
    this.url = url;
    this.withCredentials = _init?.withCredentials ?? false;
    setLastMockES(this);
    setTimeout(() => this._simulateOpen(), 0);
  }

  addEventListener(type: string, listener: MockWSListener): void {
    if (!this._listeners[type]) this._listeners[type] = [];
    this._listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: MockWSListener): void {
    const arr = this._listeners[type];
    if (arr) {
      const idx = arr.indexOf(listener);
      if (idx !== -1) arr.splice(idx, 1);
    }
  }

  close(): void {
    this.readyState = MockEventSource.CLOSED;
  }

  // --- Simulation helpers ---

  _simulateOpen(): void {
    if (this.readyState === MockEventSource.CONNECTING) {
      this.readyState = MockEventSource.OPEN;
      const event = new Event('open');
      this.onopen?.(event);
    }
  }

  _simulateMessage(data: string, eventType = 'message'): void {
    const event = new MessageEvent(eventType, { data });
    // Dispatch to listeners registered for this event type
    const listeners = this._listeners[eventType];
    if (listeners) {
      for (const listener of listeners) listener(event);
    }
  }

  _simulateError(): void {
    this.readyState = MockEventSource.CLOSED;
    const event = new Event('error');
    this.onerror?.(event);
  }
}

// Store original globals
let originalWebSocket: typeof WebSocket | undefined;
let originalEventSource: typeof EventSource | undefined;
let lastMockWS: MockWebSocket | undefined;
let lastMockES: MockEventSource | undefined;

const setLastMockWS = (ws: MockWebSocket | undefined): void => {
  lastMockWS = ws;
};

const setLastMockES = (es: MockEventSource | undefined): void => {
  lastMockES = es;
};

const installWebSocketMock = (): void => {
  originalWebSocket = (globalThis as unknown as { WebSocket?: typeof WebSocket }).WebSocket;
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = class extends MockWebSocket {
    constructor(url: string, protocols?: string | string[]) {
      super(url, protocols);
    }
  };
};

const uninstallWebSocketMock = (): void => {
  if (originalWebSocket !== undefined) {
    (globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket = originalWebSocket;
  } else {
    delete (globalThis as unknown as { WebSocket?: unknown }).WebSocket;
  }
  lastMockWS = undefined;
};

const installEventSourceMock = (): void => {
  originalEventSource = (globalThis as unknown as { EventSource?: typeof EventSource }).EventSource;
  (globalThis as unknown as { EventSource: unknown }).EventSource = class extends MockEventSource {
    constructor(url: string, init?: EventSourceInit) {
      super(url, init);
    }
  };
};

const uninstallEventSourceMock = (): void => {
  if (originalEventSource !== undefined) {
    (globalThis as unknown as { EventSource: typeof EventSource }).EventSource = originalEventSource;
  } else {
    delete (globalThis as unknown as { EventSource?: unknown }).EventSource;
  }
  lastMockES = undefined;
};

// ---------------------------------------------------------------------------
// WebSocket tests
// ---------------------------------------------------------------------------

describe('useWebSocket', () => {
  beforeEach(() => installWebSocketMock());
  afterEach(() => uninstallWebSocketMock());

  it('connects immediately and exposes reactive status', async () => {
    const ws = useWebSocket('ws://localhost:8080');

    expect(ws.status.value).toBe('CONNECTING');

    // Let the mock open
    await new Promise((r) => setTimeout(r, 10));

    expect(ws.status.value).toBe('OPEN');
    expect(ws.isConnected.value).toBe(true);

    ws.dispose();
  });

  it('receives and deserializes messages', async () => {
    const ws = useWebSocket<unknown, { type: string }>('ws://localhost:8080');

    await new Promise((r) => setTimeout(r, 10));

    lastMockWS!._simulateMessage(JSON.stringify({ type: 'hello' }));

    expect(ws.data.value).toEqual({ type: 'hello' });

    ws.dispose();
  });

  it('sends serialized messages', async () => {
    const ws = useWebSocket<{ type: string }>('ws://localhost:8080');

    await new Promise((r) => setTimeout(r, 10));

    ws.send({ type: 'subscribe' });

    expect(lastMockWS!.sentMessages).toHaveLength(1);
    expect(lastMockWS!.sentMessages[0]).toBe(JSON.stringify({ type: 'subscribe' }));

    ws.dispose();
  });

  it('sends raw data without serialization', async () => {
    const ws = useWebSocket('ws://localhost:8080');

    await new Promise((r) => setTimeout(r, 10));

    ws.sendRaw('raw message');

    expect(lastMockWS!.sentMessages[0]).toBe('raw message');

    ws.dispose();
  });

  it('queues messages while connecting', async () => {
    const ws = useWebSocket<{ cmd: string }>('ws://localhost:8080');

    // Send before connection opens
    ws.send({ cmd: 'early' });

    expect(lastMockWS!.sentMessages).toHaveLength(0);

    // Open connection
    await new Promise((r) => setTimeout(r, 10));

    // Queue should have been flushed
    expect(lastMockWS!.sentMessages).toHaveLength(1);
    expect(lastMockWS!.sentMessages[0]).toBe(JSON.stringify({ cmd: 'early' }));

    ws.dispose();
  });

  it('does not enqueue or send messages after dispose', async () => {
    const ws = useWebSocket<{ cmd: string }>('ws://localhost:8080');

    await new Promise((r) => setTimeout(r, 10));
    expect(lastMockWS!.sentMessages).toHaveLength(0);

    ws.dispose();
    ws.send({ cmd: 'late' });
    ws.sendRaw('late raw');

    expect(lastMockWS!.sentMessages).toHaveLength(0);
  });

  it('maintains a message history when historySize > 0', async () => {
    const ws = useWebSocket<string>('ws://localhost:8080', {
      historySize: 3,
      deserialize: (event) => event.data as string,
    });

    await new Promise((r) => setTimeout(r, 10));

    lastMockWS!._simulateMessage('a');
    lastMockWS!._simulateMessage('b');
    lastMockWS!._simulateMessage('c');
    lastMockWS!._simulateMessage('d');

    expect(ws.history.value).toEqual(['b', 'c', 'd']);

    ws.dispose();
  });

  it('calls onOpen, onMessage, onClose, onError callbacks', async () => {
    const events: string[] = [];

    const ws = useWebSocket('ws://localhost:8080', {
      onOpen: () => events.push('open'),
      onMessage: () => events.push('message'),
      onClose: () => events.push('close'),
      onError: () => events.push('error'),
      deserialize: (e) => e.data as string,
    });

    await new Promise((r) => setTimeout(r, 10));
    expect(events).toContain('open');

    lastMockWS!._simulateMessage('test');
    expect(events).toContain('message');

    lastMockWS!._simulateError();
    expect(events).toContain('error');

    ws.close();
    await new Promise((r) => setTimeout(r, 10));
    expect(events).toContain('close');

    ws.dispose();
  });

  it('does not connect when immediate is false', async () => {
    const ws = useWebSocket('ws://localhost:8080', { immediate: false });

    await new Promise((r) => setTimeout(r, 10));

    expect(ws.status.value).toBe('CLOSED');

    // Manual open
    ws.open();
    await new Promise((r) => setTimeout(r, 10));

    expect(ws.status.value).toBe('OPEN');

    ws.dispose();
  });

  it('auto-reconnects on unexpected close', async () => {
    let connectCount = 0;
    const OrigWS = (globalThis as unknown as { WebSocket: typeof MockWebSocket }).WebSocket;
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = class extends MockWebSocket {
      constructor(url: string, protocols?: string | string[]) {
        super(url, protocols);
        connectCount++;
      }
    };

    const ws = useWebSocket('ws://localhost:8080', {
      autoReconnect: { delay: 20, maxAttempts: 3 },
    });

    await new Promise((r) => setTimeout(r, 10));
    expect(ws.status.value).toBe('OPEN');
    expect(connectCount).toBe(1);

    // Simulate unexpected close
    lastMockWS!._simulateClose(1006, 'unexpected');

    expect(ws.status.value).toBe('CLOSED');

    // Wait for reconnect (delay=20 + open=0)
    await new Promise((r) => setTimeout(r, 50));

    // Should have reconnected — new WebSocket created
    expect(connectCount).toBe(2);

    // The new connection should open
    await new Promise((r) => setTimeout(r, 20));
    expect(ws.status.value).toBe('OPEN');

    ws.dispose();
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = OrigWS;
  });

  it('does not reconnect on explicit close', async () => {
    const ws = useWebSocket('ws://localhost:8080', {
      autoReconnect: { delay: 10 },
    });

    await new Promise((r) => setTimeout(r, 10));

    ws.close();
    await new Promise((r) => setTimeout(r, 50));

    expect(ws.reconnectAttempts.value).toBe(0);
    expect(ws.status.value).toBe('CLOSED');

    ws.dispose();
  });

  it('respects maxAttempts limit for reconnection', async () => {
    let connectCount = 0;

    // Override the mock to track connections and immediately fail
    const OrigWS = (globalThis as unknown as { WebSocket: typeof MockWebSocket }).WebSocket;
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = class extends MockWebSocket {
      constructor(url: string, protocols?: string | string[]) {
        super(url, protocols);
        connectCount++;
      }

      // Override: fail during connect without ever reaching OPEN
      _simulateOpen(): void {
        if (this.readyState === MockWebSocket.CONNECTING) {
          setTimeout(() => {
            this.readyState = MockWebSocket.CLOSED;
            const closeEvent = new Event('close') as CloseEvent;
            Object.defineProperty(closeEvent, 'code', { value: 1006 });
            Object.defineProperty(closeEvent, 'reason', { value: '' });
            Object.defineProperty(closeEvent, 'wasClean', { value: false });
            this.onclose?.(closeEvent);
          }, 5);
        }
      }
    };

    const ws = useWebSocket('ws://localhost:8080', {
      autoReconnect: { maxAttempts: 2, delay: 20 },
    });

    // Wait for initial + 2 reconnects (each takes: ~5ms open + 20ms delay)
    await new Promise((r) => setTimeout(r, 300));

    // 1 initial + 2 reconnects = 3 total
    expect(connectCount).toBe(3);

    ws.dispose();

    // Restore
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = OrigWS;
  });

  it('treats maxAttempts 0 as disabling reconnection', async () => {
    let connectCount = 0;

    const OrigWS = (globalThis as unknown as { WebSocket: typeof MockWebSocket }).WebSocket;
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = class extends MockWebSocket {
      constructor(url: string, protocols?: string | string[]) {
        super(url, protocols);
        connectCount++;
      }
    };

    const ws = useWebSocket('ws://localhost:8080', {
      autoReconnect: { maxAttempts: 0, delay: 20 },
    });

    await new Promise((r) => setTimeout(r, 10));
    lastMockWS!._simulateClose(1006, 'unexpected');
    await new Promise((r) => setTimeout(r, 80));

    expect(connectCount).toBe(1);
    expect(ws.reconnectAttempts.value).toBe(0);

    ws.dispose();
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = OrigWS;
  });

  it('disposes cleanly', async () => {
    const ws = useWebSocket('ws://localhost:8080');

    await new Promise((r) => setTimeout(r, 10));
    expect(ws.isConnected.value).toBe(true);

    ws.dispose();

    // Should not throw or reconnect after dispose
    await new Promise((r) => setTimeout(r, 50));
  });

  it('handles string messages without JSON parsing', async () => {
    const ws = useWebSocket<string>('ws://localhost:8080', {
      deserialize: (event) => event.data as string,
      serialize: (data) => data,
    });

    await new Promise((r) => setTimeout(r, 10));

    lastMockWS!._simulateMessage('plain text');

    expect(ws.data.value).toBe('plain text');

    ws.send('hello');
    expect(lastMockWS!.sentMessages[0]).toBe('hello');

    ws.dispose();
  });

  it('supports URL getter for dynamic endpoints', async () => {
    const endpoint = signal('ws://localhost:8080');
    const ws = useWebSocket(() => endpoint.value, { immediate: false });

    endpoint.value = 'ws://localhost:9090';
    ws.open();

    await new Promise((r) => setTimeout(r, 10));

    expect(lastMockWS!.url).toBe('ws://localhost:9090');

    ws.dispose();
  });
});

// ---------------------------------------------------------------------------
// EventSource tests
// ---------------------------------------------------------------------------

describe('useEventSource', () => {
  beforeEach(() => installEventSourceMock());
  afterEach(() => uninstallEventSourceMock());

  it('accepts SSE reconnect config without a reconnect predicate', () => {
    const validOptions: UseEventSourceOptions<string> = {
      autoReconnect: { delay: 10, maxAttempts: 2 },
    };

    expect(validOptions.autoReconnect).toEqual({ delay: 10, maxAttempts: 2 });
  });

  it('connects immediately and sets OPEN status', async () => {
    const sse = useEventSource('/api/events');

    await new Promise((r) => setTimeout(r, 10));

    expect(sse.status.value).toBe('OPEN');
    expect(sse.isConnected.value).toBe(true);

    sse.dispose();
  });

  it('receives and deserializes default message events', async () => {
    const sse = useEventSource<{ text: string }>('/api/events');

    await new Promise((r) => setTimeout(r, 10));

    lastMockES!._simulateMessage(JSON.stringify({ text: 'hello' }));

    expect(sse.data.value).toEqual({ text: 'hello' });
    expect(sse.eventName.value).toBe('message');

    sse.dispose();
  });

  it('receives named events', async () => {
    const sse = useEventSource<{ data: string }>('/api/events', {
      events: ['notification'],
    });

    await new Promise((r) => setTimeout(r, 10));

    lastMockES!._simulateMessage(JSON.stringify({ data: 'alert' }), 'notification');

    expect(sse.data.value).toEqual({ data: 'alert' });
    expect(sse.eventName.value).toBe('notification');

    sse.dispose();
  });

  it('does not connect when immediate is false', async () => {
    const sse = useEventSource('/api/events', { immediate: false });

    await new Promise((r) => setTimeout(r, 10));

    expect(sse.status.value).toBe('CLOSED');

    sse.open();
    await new Promise((r) => setTimeout(r, 10));

    expect(sse.status.value).toBe('OPEN');

    sse.dispose();
  });

  it('calls onOpen, onMessage, onError callbacks', async () => {
    const events: string[] = [];

    const sse = useEventSource('/api/events', {
      onOpen: () => events.push('open'),
      onMessage: () => events.push('message'),
      onError: () => events.push('error'),
    });

    await new Promise((r) => setTimeout(r, 10));
    expect(events).toContain('open');

    lastMockES!._simulateMessage(JSON.stringify({ ok: true }));
    expect(events).toContain('message');

    lastMockES!._simulateError();
    expect(events).toContain('error');

    sse.dispose();
  });

  it('closes cleanly', async () => {
    const sse = useEventSource('/api/events');

    await new Promise((r) => setTimeout(r, 10));

    sse.close();

    expect(sse.status.value).toBe('CLOSED');
    expect(sse.isConnected.value).toBe(false);

    sse.dispose();
  });

  it('disposes cleanly', async () => {
    const sse = useEventSource('/api/events');

    await new Promise((r) => setTimeout(r, 10));

    sse.dispose();

    expect(sse.status.value).toBe('CLOSED');
  });

  it('handles non-JSON data gracefully', async () => {
    const sse = useEventSource<string>('/api/events', {
      deserialize: (raw) => raw,
    });

    await new Promise((r) => setTimeout(r, 10));

    lastMockES!._simulateMessage('plain text');

    expect(sse.data.value).toBe('plain text');

    sse.dispose();
  });

  it('cancels a pending reconnect when reopened manually', async () => {
    let connectCount = 0;
    const originalEventSourceCtor = (globalThis as unknown as {
      EventSource?: typeof EventSource;
    }).EventSource;

    (globalThis as unknown as { EventSource: unknown }).EventSource = class extends MockEventSource {
      constructor(url: string, init?: EventSourceInit) {
        super(url, init);
        connectCount++;
      }
    };

    try {
      const sse = useEventSource('/api/events', {
        autoReconnect: { delay: 40, maxAttempts: 3 },
      });

      await new Promise((r) => setTimeout(r, 10));
      expect(connectCount).toBe(1);

      lastMockES!._simulateError();
      await new Promise((r) => setTimeout(r, 10));

      sse.open();
      await new Promise((r) => setTimeout(r, 10));
      expect(connectCount).toBe(2);

      await new Promise((r) => setTimeout(r, 60));
      expect(connectCount).toBe(2);

      sse.dispose();
    } finally {
      if (originalEventSourceCtor !== undefined) {
        (globalThis as unknown as { EventSource: typeof EventSource }).EventSource =
          originalEventSourceCtor;
      } else {
        delete (globalThis as unknown as { EventSource?: unknown }).EventSource;
      }
    }
  });
});

// ---------------------------------------------------------------------------
// useResource tests
// ---------------------------------------------------------------------------

describe('useResource', () => {
  it('fetches data on initialization', async () => {
    const resource = useResource<{ id: number; name: string }>('/api/users/1', {
      immediate: false,
      fetcher: asMockFetch(async () =>
        new Response(JSON.stringify({ id: 1, name: 'Ada' }), { status: 200 })
      ),
    });

    const result = await resource.actions.fetch();
    expect(result).toEqual({ id: 1, name: 'Ada' });
    expect(resource.data.value).toEqual({ id: 1, name: 'Ada' });
    expect(resource.status.value).toBe('success');

    resource.dispose();
  });

  it('creates a new resource via POST', async () => {
    let capturedMethod = '';
    let capturedBody = '';

    const resource = useResource<{ id: number; name: string }>('/api/users', {
      immediate: false,
      fetcher: asMockFetch(async (_input, init) => {
        capturedMethod = init?.method ?? '';
        capturedBody = String(init?.body ?? '');
        return new Response(JSON.stringify({ id: 2, name: 'Bob' }), { status: 201 });
      }),
    });

    const result = await resource.actions.create({ name: 'Bob' });

    expect(result).toEqual({ id: 2, name: 'Bob' });
    expect(capturedMethod).toBe('POST');
    expect(capturedBody).toBe(JSON.stringify({ name: 'Bob' }));

    resource.dispose();
  });

  it('updates a resource via PUT', async () => {
    let capturedMethod = '';

    const resource = useResource<{ id: number; name: string }>('/api/users/1', {
      immediate: false,
      fetcher: asMockFetch(async (_input, init) => {
        capturedMethod = init?.method ?? '';
        return new Response(JSON.stringify({ id: 1, name: 'Updated' }), { status: 200 });
      }),
    });

    await resource.actions.update({ name: 'Updated' });

    expect(capturedMethod).toBe('PUT');
    expect(resource.data.value).toEqual({ id: 1, name: 'Updated' });

    resource.dispose();
  });

  it('patches a resource via PATCH', async () => {
    let capturedMethod = '';

    const resource = useResource<{ id: number; name: string }>('/api/users/1', {
      immediate: false,
      fetcher: asMockFetch(async (_input, init) => {
        capturedMethod = init?.method ?? '';
        return new Response(JSON.stringify({ id: 1, name: 'Patched' }), { status: 200 });
      }),
    });

    await resource.actions.patch({ name: 'Patched' });

    expect(capturedMethod).toBe('PATCH');
    expect(resource.data.value).toEqual({ id: 1, name: 'Patched' });

    resource.dispose();
  });

  it('removes a resource via DELETE', async () => {
    let capturedMethod = '';

    const resource = useResource<{ id: number }>('/api/users/1', {
      immediate: false,
      fetcher: asMockFetch(async (_input, init) => {
        capturedMethod = init?.method ?? '';
        return new Response('', { status: 204 });
      }),
    });

    resource.data.value = { id: 1 };
    await resource.actions.remove();

    expect(capturedMethod).toBe('DELETE');
    expect(resource.data.value).toBeUndefined();

    resource.dispose();
  });

  it('keeps the last known data when DELETE fails', async () => {
    const resource = useResource<{ id: number; name: string }>('/api/users/1', {
      immediate: false,
      fetcher: asMockFetch(async (_input, init) => {
        if (init?.method === 'DELETE') {
          return new Response('Server Error', { status: 500 });
        }
        return new Response(JSON.stringify({ id: 1, name: 'Ada' }), { status: 200 });
      }),
    });

    await resource.actions.fetch();
    expect(resource.status.value).toBe('success');
    await resource.actions.remove();

    expect(resource.status.value).toBe('error');
    expect(resource.data.value).toEqual({ id: 1, name: 'Ada' });

    resource.dispose();
  });

  it('tracks isMutating during mutations', async () => {
    const states: boolean[] = [];

    const resource = useResource<{ id: number }>('/api/users/1', {
      immediate: false,
      fetcher: asMockFetch(async () => {
        states.push(true); // during fetch
        await new Promise((r) => setTimeout(r, 10));
        return new Response(JSON.stringify({ id: 1 }), { status: 200 });
      }),
    });

    const promise = resource.actions.create({ id: 1 });
    expect(resource.isMutating.value).toBe(true);

    await promise;
    expect(resource.isMutating.value).toBe(false);

    resource.dispose();
  });

  it('performs optimistic updates with rollback on failure', async () => {
    const resource = useResource<{ id: number; name: string }>('/api/users/1', {
      immediate: false,
      optimistic: true,
      fetcher: asMockFetch(async (_input, init) => {
        if (init?.method === 'PATCH') {
          throw new Error('Network error');
        }
        return new Response(JSON.stringify({ id: 1, name: 'Original' }), { status: 200 });
      }),
    });

    // Set initial data
    await resource.actions.fetch();
    expect(resource.data.value?.name).toBe('Original');

    // Attempt optimistic patch that will fail
    await resource.actions.patch({ name: 'Optimistic' });

    // Should have rolled back
    expect(resource.data.value?.name).toBe('Original');
    expect(resource.status.value).toBe('error');

    resource.dispose();
  });

  it('supports optimistic update and patch before initial data is loaded', async () => {
    const methods: string[] = [];
    const resource = useResource<{ id?: number; name?: string }>('/api/users/1', {
      immediate: false,
      optimistic: true,
      fetcher: asMockFetch(async (_input, init) => {
        methods.push(init?.method ?? '');
        return new Response(JSON.stringify({ id: 1, name: init?.method }), { status: 200 });
      }),
    });

    const patchResult = await resource.actions.patch({ name: 'Patched' });
    resource.clear();
    const updateResult = await resource.actions.update({ name: 'Updated' });

    expect(methods).toEqual(['PATCH', 'PUT']);
    expect(patchResult).toEqual({ id: 1, name: 'PATCH' });
    expect(updateResult).toEqual({ id: 1, name: 'PUT' });

    resource.dispose();
  });

  it('calls mutation success/error callbacks', async () => {
    const callbacks: string[] = [];

    const resource = useResource<{ id: number }>('/api/users/1', {
      immediate: false,
      onMutationSuccess: (_data, action) => callbacks.push(`success:${action}`),
      onMutationError: (_error, action) => callbacks.push(`error:${action}`),
      fetcher: asMockFetch(async (_input, init) => {
        if (init?.method === 'DELETE') {
          return new Response('', { status: 500, statusText: 'Internal Server Error' });
        }
        return new Response(JSON.stringify({ id: 1 }), { status: 200 });
      }),
    });

    await resource.actions.create({ id: 1 });
    expect(callbacks).toContain('success:create');

    await resource.actions.remove();
    expect(callbacks).toContain('error:remove');

    resource.dispose();
  });

  it('does not apply resource fetch callbacks or transforms to mutation responses', async () => {
    let fetchSuccessCalls = 0;
    let fetchErrorCalls = 0;

    const resource = useResource<{ id: number; name: string }>('/api/users/1', {
      immediate: false,
      transform: (data) => ({ ...data, name: `${data.name} (transformed)` }),
      onSuccess: () => {
        fetchSuccessCalls++;
      },
      onError: () => {
        fetchErrorCalls++;
      },
      fetcher: asMockFetch(async (_input, init) => {
        if (init?.method === 'POST') {
          return new Response(JSON.stringify({ id: 2, name: 'Bob' }), { status: 201 });
        }
        return new Response(JSON.stringify({ id: 1, name: 'Ada' }), { status: 200 });
      }),
    });

    await resource.actions.fetch();
    expect(fetchSuccessCalls).toBe(1);
    expect(resource.data.value).toEqual({ id: 1, name: 'Ada (transformed)' });

    const created = await resource.actions.create({ name: 'Bob' });

    expect(created).toEqual({ id: 2, name: 'Bob' });
    expect(resource.data.value).toEqual({ id: 2, name: 'Bob' });
    expect(fetchSuccessCalls).toBe(1);
    expect(fetchErrorCalls).toBe(0);

    resource.dispose();
  });

  it('clears data and status', async () => {
    const resource = useResource<{ id: number }>('/api/users/1', {
      immediate: false,
      fetcher: asMockFetch(async () =>
        new Response(JSON.stringify({ id: 1 }), { status: 200 })
      ),
    });

    await resource.actions.fetch();
    expect(resource.data.value).toEqual({ id: 1 });

    resource.clear();
    expect(resource.data.value).toBeUndefined();
    expect(resource.status.value).toBe('idle');

    resource.dispose();
  });
});

// ---------------------------------------------------------------------------
// useSubmit tests
// ---------------------------------------------------------------------------

describe('useSubmit', () => {
  it('submits data and stores the response', async () => {
    let capturedMethod = '';
    let capturedBody = '';

    const form = useSubmit<{ id: number }>('/api/users', {
      fetcher: asMockFetch(async (_input, init) => {
        capturedMethod = init?.method ?? '';
        capturedBody = String(init?.body ?? '');
        return new Response(JSON.stringify({ id: 42 }), { status: 201 });
      }),
    });

    expect(form.status.value).toBe('idle');

    const result = await form.submit({ name: 'Ada', email: 'ada@example.com' });

    expect(result).toEqual({ id: 42 });
    expect(form.data.value).toEqual({ id: 42 });
    expect(form.status.value).toBe('success');
    expect(capturedMethod).toBe('POST');
    expect(capturedBody).toBe(JSON.stringify({ name: 'Ada', email: 'ada@example.com' }));
  });

  it('tracks pending status during submission', async () => {
    const form = useSubmit('/api/users', {
      fetcher: asMockFetch(async () => {
        await new Promise((r) => setTimeout(r, 20));
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    });

    const promise = form.submit({ name: 'Test' });
    expect(form.pending.value).toBe(true);

    await promise;
    expect(form.pending.value).toBe(false);
  });

  it('handles submission errors', async () => {
    const form = useSubmit('/api/users', {
      fetcher: asMockFetch(async () =>
        new Response('', { status: 500, statusText: 'Internal Server Error' })
      ),
    });

    const result = await form.submit({ name: 'Test' });

    expect(result).toBeUndefined();
    expect(form.status.value).toBe('error');
    expect(form.error.value).toBeTruthy();
  });

  it('uses custom HTTP method', async () => {
    let capturedMethod = '';

    const form = useSubmit('/api/users/1', {
      method: 'PUT',
      fetcher: asMockFetch(async (_input, init) => {
        capturedMethod = init?.method ?? '';
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    });

    await form.submit({ name: 'Updated' });
    expect(capturedMethod).toBe('PUT');
  });

  it('clears state', async () => {
    const form = useSubmit<{ id: number }>('/api/users', {
      fetcher: asMockFetch(async () =>
        new Response(JSON.stringify({ id: 1 }), { status: 200 })
      ),
    });

    await form.submit({ name: 'Test' });
    expect(form.data.value).toEqual({ id: 1 });

    form.clear();
    expect(form.data.value).toBeUndefined();
    expect(form.status.value).toBe('idle');
    expect(form.error.value).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// createRestClient tests
// ---------------------------------------------------------------------------

describe('createRestClient', () => {
  it('lists all resources via GET', async () => {
    let capturedUrl = '';
    let capturedMethod = '';

    const users = createRestClient<{ id: number; name: string }>('http://api.example.com/users', {
      fetcher: asMockFetch(async (input, init) => {
        capturedUrl = String(input);
        capturedMethod = init?.method ?? '';
        return new Response(JSON.stringify([{ id: 1, name: 'Ada' }]), { status: 200 });
      }),
    });

    const res = await users.list();
    expect(res.data).toEqual([{ id: 1, name: 'Ada' }]);
    expect(capturedMethod).toBe('GET');
    expect(capturedUrl).toBe('http://api.example.com/users');
  });

  it('gets a single resource by ID', async () => {
    let capturedUrl = '';

    const users = createRestClient<{ id: number; name: string }>('http://api.example.com/users', {
      fetcher: asMockFetch(async (input) => {
        capturedUrl = String(input);
        return new Response(JSON.stringify({ id: 1, name: 'Ada' }), { status: 200 });
      }),
    });

    const res = await users.get(1);
    expect(res.data).toEqual({ id: 1, name: 'Ada' });
    expect(capturedUrl).toBe('http://api.example.com/users/1');
  });

  it('creates a resource via POST', async () => {
    let capturedMethod = '';
    let capturedBody = '';

    const users = createRestClient<{ id: number; name: string }>('http://api.example.com/users', {
      fetcher: asMockFetch(async (_input, init) => {
        capturedMethod = init?.method ?? '';
        capturedBody = String(init?.body ?? '');
        return new Response(JSON.stringify({ id: 2, name: 'Bob' }), { status: 201 });
      }),
    });

    const res = await users.create({ name: 'Bob' });
    expect(res.data).toEqual({ id: 2, name: 'Bob' });
    expect(capturedMethod).toBe('POST');
    expect(capturedBody).toBe(JSON.stringify({ name: 'Bob' }));
  });

  it('updates a resource via PUT', async () => {
    let capturedUrl = '';
    let capturedMethod = '';

    const users = createRestClient<{ id: number; name: string }>('http://api.example.com/users', {
      fetcher: asMockFetch(async (input, init) => {
        capturedUrl = String(input);
        capturedMethod = init?.method ?? '';
        return new Response(JSON.stringify({ id: 1, name: 'Updated' }), { status: 200 });
      }),
    });

    const res = await users.update(1, { name: 'Updated' });
    expect(res.data).toEqual({ id: 1, name: 'Updated' });
    expect(capturedUrl).toBe('http://api.example.com/users/1');
    expect(capturedMethod).toBe('PUT');
  });

  it('patches a resource via PATCH', async () => {
    let capturedMethod = '';

    const users = createRestClient<{ id: number; name: string }>('http://api.example.com/users', {
      fetcher: asMockFetch(async (_input, init) => {
        capturedMethod = init?.method ?? '';
        return new Response(JSON.stringify({ id: 1, name: 'Patched' }), { status: 200 });
      }),
    });

    await users.patch(1, { name: 'Patched' });
    expect(capturedMethod).toBe('PATCH');
  });

  it('removes a resource via DELETE', async () => {
    let capturedUrl = '';
    let capturedMethod = '';

    const users = createRestClient<{ id: number }>('http://api.example.com/users', {
      fetcher: asMockFetch(async (input, init) => {
        capturedUrl = String(input);
        capturedMethod = init?.method ?? '';
        return new Response('', { status: 204 });
      }),
    });

    await users.remove(1);
    expect(capturedUrl).toBe('http://api.example.com/users/1');
    expect(capturedMethod).toBe('DELETE');
  });

  it('encodes special characters in IDs', async () => {
    let capturedUrl = '';

    const items = createRestClient('http://api.example.com/items', {
      fetcher: asMockFetch(async (input) => {
        capturedUrl = String(input);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    });

    await items.get('hello world');
    expect(capturedUrl).toBe('http://api.example.com/items/hello%20world');
  });

  it('exposes the underlying http client', () => {
    const users = createRestClient('http://api.example.com/users');
    expect(users.http).toBeDefined();
    expect(users.http.get).toBeInstanceOf(Function);
    expect(users.http.interceptors).toBeDefined();
  });

  it('merges default config into all requests', async () => {
    let capturedHeaders: Headers | undefined;

    const users = createRestClient<{ id: number }>('http://api.example.com/users', {
      headers: { authorization: 'Bearer token123' },
      fetcher: asMockFetch(async (_input, init) => {
        capturedHeaders = new Headers(init?.headers);
        return new Response(JSON.stringify([]), { status: 200 });
      }),
    });

    await users.list();
    expect(capturedHeaders?.get('authorization')).toBe('Bearer token123');
  });
});

// ---------------------------------------------------------------------------
// NEW: useWebSocket — latency, lastDisconnectedAt, onReconnect
// ---------------------------------------------------------------------------

describe('useWebSocket — new extensions', () => {
  beforeEach(() => installWebSocketMock());
  afterEach(() => uninstallWebSocketMock());

  it('exposes latency signal initialized to 0', async () => {
    const ws = useWebSocket('ws://localhost/test', {
      heartbeat: { interval: 50, pongTimeout: 500 },
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(ws.latency.value).toBe(0);
    ws.dispose();
  });

  it('exposes lastDisconnectedAt signal initialized to 0', async () => {
    const ws = useWebSocket('ws://localhost/test');
    await new Promise((r) => setTimeout(r, 10));
    expect(ws.lastDisconnectedAt.value).toBe(0);
    ws.dispose();
  });

  it('updates lastDisconnectedAt on unexpected close', async () => {
    const ws = useWebSocket('ws://localhost/test', { autoReconnect: false });
    await new Promise((r) => setTimeout(r, 10));
    expect(ws.isConnected.value).toBe(true);

    const before = Date.now();
    lastMockWS!._simulateClose(1006, 'unexpected');
    await new Promise((r) => setTimeout(r, 10));

    expect(ws.lastDisconnectedAt.value).toBeGreaterThanOrEqual(before);
    expect(ws.lastDisconnectedAt.value).toBeLessThanOrEqual(Date.now());
    ws.dispose();
  });

  it('does NOT update lastDisconnectedAt on explicit close', async () => {
    const ws = useWebSocket('ws://localhost/test', { autoReconnect: false });
    await new Promise((r) => setTimeout(r, 10));

    ws.close();
    await new Promise((r) => setTimeout(r, 20));

    expect(ws.lastDisconnectedAt.value).toBe(0);
    ws.dispose();
  });

  it('calls onReconnect after successful auto-reconnect', async () => {
    let reconnectCalled = false;
    let reconnectAttemptCount = -1;

    const ws = useWebSocket('ws://localhost/test', {
      autoReconnect: { delay: 20, maxAttempts: 3 },
      onReconnect: (attempts) => {
        reconnectCalled = true;
        reconnectAttemptCount = attempts;
      },
    });

    await new Promise((r) => setTimeout(r, 10));
    expect(ws.isConnected.value).toBe(true);

    // Simulate unexpected close
    lastMockWS!._simulateClose(1006, 'server restart');

    // Wait for reconnect cycle
    await new Promise((r) => setTimeout(r, 80));

    // After reconnect, open the new socket
    if (lastMockWS!.readyState !== MockWebSocket.OPEN) {
      lastMockWS!._simulateOpen();
    }
    await new Promise((r) => setTimeout(r, 10));

    expect(reconnectCalled).toBe(true);
    expect(reconnectAttemptCount).toBeGreaterThanOrEqual(0);
    ws.dispose();
  });

  it('resets reconnect attempt counters after a successful auto-reconnect', async () => {
    const originalWebSocketConstructor = getGlobalWebSocket();
    class ControlledReconnectWebSocket extends MockWebSocket {
      autoOpen = false;

      override _simulateOpen(): void {
        if (this.autoOpen) {
          super._simulateOpen();
        }
      }

      openNow(): void {
        this.autoOpen = true;
        super._simulateOpen();
      }
    }

    setGlobalWebSocket(ControlledReconnectWebSocket);

    try {
      const ws = useWebSocket('ws://localhost/test', {
        autoReconnect: { delay: 20, maxAttempts: 2 },
      });
      const currentControlledSocket = (): ControlledReconnectWebSocket | null =>
        lastMockWS as ControlledReconnectWebSocket | null;

      await new Promise((r) => setTimeout(r, 10));
      currentControlledSocket()?.openNow();
      await new Promise((r) => setTimeout(r, 10));
      lastMockWS!._simulateClose(1006, 'server restart');

      await new Promise((r) => setTimeout(r, 30));
      expect(ws.reconnectAttempts.value).toBeGreaterThan(0);

      currentControlledSocket()?.openNow();
      await new Promise((r) => setTimeout(r, 10));

      expect(ws.reconnectAttempts.value).toBe(0);

      lastMockWS!._simulateClose(1006, 'server restart again');
      await new Promise((r) => setTimeout(r, 30));
      expect(ws.reconnectAttempts.value).toBeGreaterThan(0);
      currentControlledSocket()?.openNow();
      await new Promise((r) => setTimeout(r, 10));
      expect(ws.reconnectAttempts.value).toBe(0);

      ws.dispose();
    } finally {
      setGlobalWebSocket(originalWebSocketConstructor);
    }
  });

  it('measures latency via heartbeat RTT', async () => {
    const ws = useWebSocket('ws://localhost/test', {
      heartbeat: { interval: 30, pongTimeout: 5000, responseMessage: 'pong' },
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(ws.isConnected.value).toBe(true);

    // Wait for heartbeat to fire
    await new Promise((r) => setTimeout(r, 50));

    // Simulate pong
    lastMockWS!._simulateMessage('pong');
    await new Promise((r) => setTimeout(r, 10));

    expect(ws.latency.value).toBeGreaterThan(0);
    ws.dispose();
  });

  it('clears stale pong timers before scheduling a new heartbeat timeout', async () => {
    const ws = useWebSocket('ws://localhost/test', {
      autoReconnect: false,
      heartbeat: { interval: 20, pongTimeout: 60, responseMessage: 'pong' },
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(ws.isConnected.value).toBe(true);

    await new Promise((r) => setTimeout(r, 55));
    lastMockWS!._simulateMessage('pong');
    await new Promise((r) => setTimeout(r, 35));

    expect(ws.status.value).toBe('OPEN');
    ws.dispose();
  });

  it('cancels a pending reconnect when manually reopened', async () => {
    let connectCount = 0;
    const originalWebSocket = (globalThis as unknown as { WebSocket: typeof MockWebSocket }).WebSocket;
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = class extends MockWebSocket {
      constructor(url: string, protocols?: string | string[]) {
        super(url, protocols);
        connectCount++;
      }
    };

    const ws = useWebSocket('ws://localhost/test', {
      autoReconnect: { delay: 40, maxAttempts: 3 },
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(connectCount).toBe(1);

    lastMockWS!._simulateClose(1006, 'unexpected');
    await new Promise((r) => setTimeout(r, 10));

    ws.open();
    await new Promise((r) => setTimeout(r, 10));
    expect(connectCount).toBe(2);

    await new Promise((r) => setTimeout(r, 60));
    expect(connectCount).toBe(2);

    ws.dispose();
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = originalWebSocket;
  });

  it('clears stale heartbeat timers before replacing an existing connection with open()', async () => {
    const ws = useWebSocket('ws://localhost/test', {
      autoReconnect: false,
      heartbeat: { interval: 20, pongTimeout: 60, responseMessage: 'pong' },
    });

    await new Promise((r) => setTimeout(r, 10));
    const originalSocket = lastMockWS;
    expect(originalSocket).not.toBeNull();

    await new Promise((r) => setTimeout(r, 35));
    ws.open();
    await new Promise((r) => setTimeout(r, 10));

    const reopenedSocket = lastMockWS;
    expect(reopenedSocket).not.toBe(originalSocket);

    await new Promise((r) => setTimeout(r, 80));

    expect(ws.status.value).toBe('OPEN');
    expect(reopenedSocket?.readyState).toBe(MockWebSocket.OPEN);

    ws.dispose();
  });
});

// ---------------------------------------------------------------------------
// NEW: useWebSocketChannel
// ---------------------------------------------------------------------------

describe('useWebSocketChannel', () => {
  beforeEach(() => installWebSocketMock());
  afterEach(() => uninstallWebSocketMock());

  it('routes messages to subscribed channels', async () => {
    const mux = useWebSocketChannel('ws://localhost/mux');
    await new Promise((r) => setTimeout(r, 10));

    const general = mux.subscribe('general');
    const updates = mux.subscribe('updates');

    // Simulate incoming messages for 'general' channel
    lastMockWS!._simulateMessage(JSON.stringify({ channel: 'general', data: 'hello' }));
    await new Promise((r) => setTimeout(r, 10));

    expect(general.data.value).toEqual({ channel: 'general', data: 'hello' });
    expect(updates.data.value).toBeUndefined();

    // Simulate incoming messages for 'updates' channel
    lastMockWS!._simulateMessage(JSON.stringify({ channel: 'updates', data: 42 }));
    await new Promise((r) => setTimeout(r, 10));

    expect(updates.data.value).toEqual({ channel: 'updates', data: 42 });

    mux.ws.dispose();
  });

  it('publishes messages to a channel', async () => {
    const mux = useWebSocketChannel('ws://localhost/mux');
    await new Promise((r) => setTimeout(r, 10));

    mux.publish('chat', { text: 'Hi!' });

    expect(lastMockWS!.sentMessages.length).toBe(1);
    expect(JSON.parse(lastMockWS!.sentMessages[0] as string)).toEqual({
      channel: 'chat',
      data: { text: 'Hi!' },
    });

    mux.ws.dispose();
  });

  it('allows unsubscribe from a channel', async () => {
    const mux = useWebSocketChannel('ws://localhost/mux');
    await new Promise((r) => setTimeout(r, 10));

    const sub = mux.subscribe('temp');
    sub.unsubscribe();

    // Message to unsubscribed channel should not update signal
    lastMockWS!._simulateMessage(JSON.stringify({ channel: 'temp', data: 'gone' }));
    await new Promise((r) => setTimeout(r, 10));

    expect(sub.data.value).toBeUndefined();

    mux.ws.dispose();
  });

  it('keeps shared channel subscriptions active until the last unsubscribe', async () => {
    const mux = useWebSocketChannel('ws://localhost/mux');
    await new Promise((r) => setTimeout(r, 10));

    const first = mux.subscribe('shared');
    const second = mux.subscribe('shared');
    expect(first.data).toBe(second.data);

    first.unsubscribe();

    lastMockWS!._simulateMessage(JSON.stringify({ channel: 'shared', data: 'still here' }));
    await new Promise((r) => setTimeout(r, 10));

    expect(second.data.value).toEqual({ channel: 'shared', data: 'still here' });

    second.unsubscribe();
    lastMockWS!._simulateMessage(JSON.stringify({ channel: 'shared', data: 'gone' }));
    await new Promise((r) => setTimeout(r, 10));

    expect(second.data.value).toEqual({ channel: 'shared', data: 'still here' });

    mux.ws.dispose();
  });

  it('supports custom channel extractor', async () => {
    const mux = useWebSocketChannel<string, { topic: string; payload: string }>(
      'ws://localhost/mux',
      {},
      {
        getChannel: (msg) => msg.topic,
        wrap: (ch, data) => ({ topic: ch, payload: data }),
      }
    );
    await new Promise((r) => setTimeout(r, 10));

    const news = mux.subscribe('news');

    lastMockWS!._simulateMessage(JSON.stringify({ topic: 'news', payload: 'Breaking!' }));
    await new Promise((r) => setTimeout(r, 10));

    expect(news.data.value).toEqual({ topic: 'news', payload: 'Breaking!' });

    // Test custom wrap
    mux.publish('news', 'Hello');
    const sent = JSON.parse(lastMockWS!.sentMessages[0] as string);
    expect(sent).toEqual({ topic: 'news', payload: 'Hello' });

    mux.ws.dispose();
  });

  it('exposes the underlying ws composable', async () => {
    const mux = useWebSocketChannel('ws://localhost/mux');
    await new Promise((r) => setTimeout(r, 10));

    expect(mux.ws.isConnected.value).toBe(true);
    expect(mux.ws.status.value).toBe('OPEN');

    mux.ws.dispose();
  });
});

// ---------------------------------------------------------------------------
// NEW: useResourceList
// ---------------------------------------------------------------------------

describe('useResourceList', () => {
  it('fetches list data on initialization', async () => {
    const items = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ];
    const list = useResourceList<{ id: number; name: string }>('http://api.test/items', {
      immediate: true,
      fetcher: asMockFetch(async () => new Response(JSON.stringify(items), { status: 200 })),
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(list.data.value).toEqual(items);
    expect(list.status.value).toBe('success');
    list.dispose();
  });

  it('adds an item via POST', async () => {
    const list = useResourceList<{ id: number; name: string }>('http://api.test/items', {
      immediate: false,
      fetcher: asMockFetch(async (_input, init) => {
        if (init?.method === 'POST') {
          return new Response(JSON.stringify({ id: 3, name: 'C' }), { status: 201 });
        }
        return new Response(JSON.stringify([]), { status: 200 });
      }),
    });

    // Start with an existing list
    list.data.value = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ];

    await list.actions.add({ name: 'C' });
    await new Promise((r) => setTimeout(r, 50));

    expect(list.data.value?.length).toBe(3);
    expect(list.data.value?.[2]).toEqual({ id: 3, name: 'C' });
    list.dispose();
  });

  it('removes an item via DELETE', async () => {
    const list = useResourceList<{ id: number; name: string }>('http://api.test/items', {
      immediate: false,
      fetcher: asMockFetch(async (_input, init) => {
        if (init?.method === 'DELETE') {
          return new Response('', { status: 204 });
        }
        return new Response(JSON.stringify([]), { status: 200 });
      }),
    });

    list.data.value = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ];

    await list.actions.remove(1);
    await new Promise((r) => setTimeout(r, 50));

    expect(list.data.value?.length).toBe(1);
    expect(list.data.value?.[0]).toEqual({ id: 2, name: 'B' });
    list.dispose();
  });

  it('updates an item via PUT', async () => {
    const list = useResourceList<{ id: number; name: string }>('http://api.test/items', {
      immediate: false,
      fetcher: asMockFetch(async (_input, init) => {
        if (init?.method === 'PUT') {
          return new Response(JSON.stringify({ id: 1, name: 'Updated' }), { status: 200 });
        }
        return new Response(JSON.stringify([]), { status: 200 });
      }),
    });

    list.data.value = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ];

    await list.actions.update(1, { name: 'Updated' });
    await new Promise((r) => setTimeout(r, 50));

    expect(list.data.value?.[0]).toEqual({ id: 1, name: 'Updated' });
    expect(list.data.value?.[1]).toEqual({ id: 2, name: 'B' });
    list.dispose();
  });

  it('patches an item via PATCH', async () => {
    const list = useResourceList<{ id: number; name: string }>('http://api.test/items', {
      immediate: false,
      fetcher: asMockFetch(async (_input, init) => {
        if (init?.method === 'PATCH') {
          return new Response(JSON.stringify({ id: 2, name: 'Patched' }), { status: 200 });
        }
        return new Response(JSON.stringify([]), { status: 200 });
      }),
    });

    list.data.value = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ];

    await list.actions.patch(2, { name: 'Patched' });
    await new Promise((r) => setTimeout(r, 50));

    expect(list.data.value?.[1]).toEqual({ id: 2, name: 'Patched' });
    list.dispose();
  });

  it('supports optimistic add with rollback on error', async () => {
    const list = useResourceList<{ id: number; name: string }>('http://api.test/items', {
      immediate: false,
      optimistic: true,
      fetcher: asMockFetch(async () => new Response('Server Error', { status: 500 })),
    });

    list.data.value = [{ id: 1, name: 'A' }];

    // Optimistic add — should appear then roll back
    await list.actions.add({ name: 'Optimistic' });
    await new Promise((r) => setTimeout(r, 50));

    // After error, should roll back to original
    expect(list.data.value?.length).toBe(1);
    expect(list.data.value?.[0].name).toBe('A');
    list.dispose();
  });

  it('reconciles optimistic add placeholders with the server response', async () => {
    const list = useResourceList<{ id?: number; name: string }>('http://api.test/items', {
      immediate: false,
      optimistic: true,
      fetcher: asMockFetch(async (_input, init) => {
        if (init?.method === 'POST') {
          return new Response(JSON.stringify({ id: 3, name: 'Optimistic' }), { status: 201 });
        }
        return new Response(JSON.stringify([]), { status: 200 });
      }),
    });

    list.data.value = [{ id: 1, name: 'A' }];

    await list.actions.add({ name: 'Optimistic' });
    await new Promise((r) => setTimeout(r, 50));

    expect(list.data.value).toEqual([
      { id: 1, name: 'A' },
      { id: 3, name: 'Optimistic' },
    ]);
    list.dispose();
  });

  it('supports optimistic remove with rollback on error', async () => {
    const list = useResourceList<{ id: number; name: string }>('http://api.test/items', {
      immediate: false,
      optimistic: true,
      fetcher: asMockFetch(async () => new Response('Server Error', { status: 500 })),
    });

    list.data.value = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ];

    await list.actions.remove(1);
    await new Promise((r) => setTimeout(r, 50));

    // After error, should roll back to original
    expect(list.data.value?.length).toBe(2);
    list.dispose();
  });

  it('does not remove items locally after a failed non-optimistic delete', async () => {
    const list = useResourceList<{ id: number; name: string }>('http://api.test/items', {
      immediate: false,
      fetcher: asMockFetch(async () => new Response('Server Error', { status: 500 })),
    });

    list.data.value = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ];

    await list.actions.remove(1);

    expect(list.status.value).toBe('error');
    expect(list.data.value).toEqual([
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ]);

    list.dispose();
  });

  it('tracks isMutating during mutations', async () => {
    let resolveFetch: (() => void) | undefined;
    const list = useResourceList<{ id: number; name: string }>('http://api.test/items', {
      immediate: false,
      fetcher: asMockFetch(
        () => new Promise<Response>((resolve) => {
          resolveFetch = () => resolve(new Response(JSON.stringify({ id: 3, name: 'C' }), { status: 201 }));
        })
      ),
    });

    list.data.value = [{ id: 1, name: 'A' }];

    const addPromise = list.actions.add({ name: 'C' });
    await new Promise((r) => setTimeout(r, 10));

    expect(list.isMutating.value).toBe(true);

    resolveFetch?.();
    await addPromise;
    await new Promise((r) => setTimeout(r, 10));

    expect(list.isMutating.value).toBe(false);
    list.dispose();
  });

  it('calls mutation callbacks', async () => {
    let successAction = '';
    let errorAction = '';

    const list = useResourceList<{ id: number; name: string }>('http://api.test/items', {
      immediate: false,
      onMutationSuccess: (action) => {
        successAction = action;
      },
      onMutationError: (_error, action) => {
        errorAction = action;
      },
      fetcher: asMockFetch(async (_input, init) => {
        if (init?.method === 'POST') {
          return new Response(JSON.stringify({ id: 3, name: 'C' }), { status: 201 });
        }
        return new Response('Error', { status: 500 });
      }),
    });

    list.data.value = [{ id: 1, name: 'A' }];

    await list.actions.add({ name: 'C' });
    await new Promise((r) => setTimeout(r, 50));
    expect(successAction).toBe('add');

    await list.actions.remove(1);
    await new Promise((r) => setTimeout(r, 50));
    expect(errorAction).toBe('remove');

    list.dispose();
  });

  it('does not call list-level fetch callbacks for mutation responses', async () => {
    let successCalls = 0;
    let errorCalls = 0;

    const list = useResourceList<{ id: number; name: string }>('http://api.test/items', {
      immediate: false,
      onSuccess: () => {
        successCalls++;
      },
      onError: () => {
        errorCalls++;
      },
      fetcher: asMockFetch(async (_input, init) => {
        if (init?.method === 'POST') {
          return new Response(JSON.stringify({ id: 2, name: 'B' }), { status: 201 });
        }
        return new Response(JSON.stringify([]), { status: 200 });
      }),
    });

    list.data.value = [{ id: 1, name: 'A' }];

    await list.actions.add({ name: 'B' });
    await new Promise((r) => setTimeout(r, 20));

    expect(successCalls).toBe(0);
    expect(errorCalls).toBe(0);
    list.dispose();
  });

  it('calls list-level fetch callbacks for actual list fetches', async () => {
    let successCalls = 0;

    const list = useResourceList<{ id: number; name: string }>('http://api.test/items', {
      immediate: false,
      onSuccess: () => {
        successCalls++;
      },
      fetcher: asMockFetch(async () =>
        new Response(JSON.stringify([{ id: 1, name: 'A' }]), { status: 200 })
      ),
    });

    await list.refresh();
    await new Promise((r) => setTimeout(r, 20));

    expect(successCalls).toBe(1);
    expect(list.data.value).toEqual([{ id: 1, name: 'A' }]);
    list.dispose();
  });

  it('supports custom getId', async () => {
    const list = useResourceList<{ uid: string; title: string }>('http://api.test/items', {
      immediate: false,
      getId: (item) => item.uid,
      fetcher: asMockFetch(async (_input, init) => {
        if (init?.method === 'DELETE') {
          return new Response('', { status: 204 });
        }
        return new Response(JSON.stringify([]), { status: 200 });
      }),
    });

    list.data.value = [
      { uid: 'abc', title: 'First' },
      { uid: 'def', title: 'Second' },
    ];

    await list.actions.remove('abc');
    await new Promise((r) => setTimeout(r, 50));

    expect(list.data.value?.length).toBe(1);
    expect(list.data.value?.[0].uid).toBe('def');
    list.dispose();
  });
});

// ---------------------------------------------------------------------------
// NEW: deduplicateRequest
// ---------------------------------------------------------------------------

describe('deduplicateRequest', () => {
  it('deduplicates identical in-flight requests', async () => {
    let callCount = 0;
    const execute = async () => {
      callCount++;
      await new Promise((r) => setTimeout(r, 50));
      return { result: 'data' };
    };

    const [a, b] = await Promise.all([
      deduplicateRequest('/users', execute),
      deduplicateRequest('/users', execute),
    ]);

    expect(callCount).toBe(1);
    expect(a).toEqual({ result: 'data' });
    expect(b).toEqual({ result: 'data' });
  });

  it('does NOT deduplicate different keys', async () => {
    let callCount = 0;
    const execute = async () => {
      callCount++;
      return { id: callCount };
    };

    await Promise.all([
      deduplicateRequest('/users', execute),
      deduplicateRequest('/posts', execute),
    ]);

    expect(callCount).toBe(2);
  });

  it('allows new request after previous one completes', async () => {
    let callCount = 0;
    const execute = async () => {
      callCount++;
      return { count: callCount };
    };

    const first = await deduplicateRequest('/key', execute);
    expect(first).toEqual({ count: 1 });

    const second = await deduplicateRequest('/key', execute);
    expect(second).toEqual({ count: 2 });
    expect(callCount).toBe(2);
  });

  it('cleans up cache on error', async () => {
    let callCount = 0;
    const execute = async () => {
      callCount++;
      if (callCount === 1) throw new Error('first fail');
      return { ok: true };
    };

    await expect(deduplicateRequest('/fail', execute)).rejects.toThrow('first fail');

    // Should allow retry since error cleared the cache
    const result = await deduplicateRequest('/fail', execute);
    expect(result).toEqual({ ok: true });
    expect(callCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// NEW: createRequestQueue
// ---------------------------------------------------------------------------

describe('createRequestQueue', () => {
  it('executes requests up to concurrency limit', async () => {
    const queue = createRequestQueue({ concurrency: 2 });
    const order: number[] = [];
    let inFlight = 0;
    let maxInFlight = 0;

    const makeRequest = (id: number) =>
      queue.add(async () => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        order.push(id);
        await new Promise((r) => setTimeout(r, 30));
        inFlight--;
        return {
          data: id,
          status: 200,
          statusText: 'OK',
          headers: new Headers(),
          config: {},
        } as HttpResponse<number>;
      });

    await Promise.all([makeRequest(1), makeRequest(2), makeRequest(3), makeRequest(4)]);

    expect(maxInFlight).toBeLessThanOrEqual(2);
    expect(order).toEqual([1, 2, 3, 4]);
  });

  it('reports pending and size', async () => {
    const queue = createRequestQueue({ concurrency: 1 });
    let resolve1: (() => void) | undefined;

    const p1 = queue.add(
      () =>
        new Promise<HttpResponse<number>>((resolve) => {
          resolve1 = () =>
            resolve({ data: 1, status: 200, statusText: 'OK', headers: new Headers(), config: {} });
        })
    );
    const p2 = queue.add(
      async () =>
        ({ data: 2, status: 200, statusText: 'OK', headers: new Headers(), config: {} }) as HttpResponse<number>
    );

    await new Promise((r) => setTimeout(r, 10));

    expect(queue.pending).toBe(1);
    expect(queue.size).toBe(1);

    resolve1?.();
    await p1;
    await p2;
    // Allow drain microtask to complete
    await new Promise((r) => setTimeout(r, 10));

    expect(queue.pending).toBe(0);
    expect(queue.size).toBe(0);
  });

  it('clears pending requests', async () => {
    const queue = createRequestQueue({ concurrency: 1 });
    let resolve1: (() => void) | undefined;

    const p1 = queue.add(
      () =>
        new Promise<HttpResponse<number>>((resolve) => {
          resolve1 = () =>
            resolve({ data: 1, status: 200, statusText: 'OK', headers: new Headers(), config: {} });
        })
    );

    const p2 = queue.add(
      async () =>
        ({ data: 2, status: 200, statusText: 'OK', headers: new Headers(), config: {} }) as HttpResponse<number>
    );

    await new Promise((r) => setTimeout(r, 10));

    queue.clear();

    // p2 should reject because it was cleared
    await expect(p2).rejects.toThrow('Request queue cleared');

    resolve1?.();
    await p1; // p1 was already running, should complete
  });

  it('defaults to concurrency 6', () => {
    const queue = createRequestQueue();
    expect(queue.pending).toBe(0);
    expect(queue.size).toBe(0);
  });

  it('throws for concurrency less than 1', () => {
    expect(() => createRequestQueue({ concurrency: 0 })).toThrow(
      'Request queue concurrency must be a positive integer'
    );
    expect(() => createRequestQueue({ concurrency: -1 })).toThrow(
      'Request queue concurrency must be a positive integer'
    );
    expect(() => createRequestQueue({ concurrency: 1.5 })).toThrow(
      'Request queue concurrency must be a positive integer'
    );
  });

  it('rejects queued tasks that throw synchronously', async () => {
    const queue = createRequestQueue({ concurrency: 1 });

    await expect(
      queue.add(() => {
        throw new Error('sync boom');
      })
    ).rejects.toThrow('sync boom');

    const result = await queue.add(
      async () =>
        ({ data: 1, status: 200, statusText: 'OK', headers: new Headers(), config: {} }) as HttpResponse<number>
    );

    expect(result.data).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// NEW: onRetry callback in RetryConfig
// ---------------------------------------------------------------------------

describe('http onRetry callback', () => {
  it('calls onRetry before each retry attempt', async () => {
    const retryAttempts: number[] = [];
    let callCount = 0;

    const api = createHttp({
      fetcher: asMockFetch(async () => {
        callCount++;
        if (callCount <= 2) {
          return new Response('Error', { status: 500 });
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
      retry: {
        count: 3,
        delay: 10,
        onRetry: (_error, attempt) => {
          retryAttempts.push(attempt);
        },
      },
    });

    const result = await api.get<{ ok: boolean }>('/test');
    expect(result.data).toEqual({ ok: true });
    expect(retryAttempts).toEqual([1, 2]);
    expect(callCount).toBe(3);
  });
});
