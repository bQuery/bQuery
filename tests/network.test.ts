import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import {
  createRestClient,
  useResource,
  useSubmit,
  useWebSocket,
  useEventSource,
  signal,
} from '../src/reactive/signal';
import type {
  UseWebSocketReturn,
  UseEventSourceReturn,
} from '../src/reactive/websocket';

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

const installWebSocketMock = (): void => {
  originalWebSocket = (globalThis as unknown as { WebSocket?: typeof WebSocket }).WebSocket;
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = class extends MockWebSocket {
    constructor(url: string, protocols?: string | string[]) {
      super(url, protocols);
      lastMockWS = this;
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
      lastMockES = this;
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
    const ws = useWebSocket<{ type: string }>('ws://localhost:8080');

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
        lastMockWS = this;
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
        lastMockWS = this;
      }

      // Override: open normally then close immediately on next tick
      _simulateOpen(): void {
        if (this.readyState === MockWebSocket.CONNECTING) {
          this.readyState = MockWebSocket.OPEN;
          const event = new Event('open');
          this.onopen?.(event);
          // Immediately close unexpectedly
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
