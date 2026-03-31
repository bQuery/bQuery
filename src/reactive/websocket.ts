/**
 * Reactive WebSocket composable with auto-reconnect, heartbeat,
 * message history, and signal-based connection state.
 *
 * @module bquery/reactive
 */

import { computed } from './computed';
import { Signal, signal } from './core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Connection status for a WebSocket. */
export type WebSocketStatus = 'CONNECTING' | 'OPEN' | 'CLOSING' | 'CLOSED';

/** Configuration for automatic reconnection. */
export interface WebSocketReconnectConfig {
  /** Maximum number of reconnection attempts. 0 = no limit (default: Infinity). */
  maxAttempts?: number;
  /** Base delay in ms between reconnects (default: 1000). */
  delay?: number;
  /** Maximum delay in ms between reconnects (default: 30000). */
  maxDelay?: number;
  /** Multiply factor for exponential backoff (default: 2). */
  factor?: number;
  /** Custom predicate — return `false` to prevent a reconnect attempt. */
  shouldReconnect?: (event: CloseEvent, attempts: number) => boolean;
}

/** Configuration for keep-alive heartbeats. */
export interface WebSocketHeartbeatConfig {
  /** Outgoing ping message (default: `'ping'`). */
  message?: string | ArrayBufferLike | Blob | ArrayBufferView;
  /** Interval in ms between heartbeat pings (default: 30 000). */
  interval?: number;
  /** Time in ms to wait for a pong before assuming the connection is dead (default: 10 000). */
  pongTimeout?: number;
  /** Expected response message. If set, only messages matching this value reset the pong timer. */
  responseMessage?: string;
}

/** Serializer/deserializer for typed messaging. */
export interface WebSocketSerializer<TSend = unknown, TReceive = unknown> {
  /** Serialize a value before sending over the wire. Default: `JSON.stringify`. */
  serialize?: (data: TSend) => string | ArrayBufferLike | Blob | ArrayBufferView;
  /** Deserialize an incoming message. Default: `JSON.parse`. */
  deserialize?: (event: MessageEvent) => TReceive;
}

/** Full configuration accepted by `useWebSocket()`. */
export interface UseWebSocketOptions<TSend = unknown, TReceive = unknown>
  extends WebSocketSerializer<TSend, TReceive> {
  /** Sub-protocols to request during the WebSocket handshake. */
  protocols?: string | string[];
  /** Open the connection immediately (default: true). */
  immediate?: boolean;
  /** Automatically reconnect on unexpected close (default: true). Pass `false` or config. */
  autoReconnect?: boolean | WebSocketReconnectConfig;
  /** Keep-alive heartbeat configuration. Pass `true` for defaults or a config object. */
  heartbeat?: boolean | WebSocketHeartbeatConfig;
  /** Maximum number of messages to keep in `history` (default: 0 = disabled). */
  historySize?: number;
  /** Called when the connection opens. */
  onOpen?: (event: Event) => void;
  /** Called when a message is received (after deserialization). */
  onMessage?: (data: TReceive, event: MessageEvent) => void;
  /** Called when the connection closes. */
  onClose?: (event: CloseEvent) => void;
  /** Called when a connection error occurs. */
  onError?: (event: Event) => void;
}

/** Return value of `useWebSocket()`. */
export interface UseWebSocketReturn<TSend = unknown, TReceive = unknown> {
  /** Reactive connection status. */
  status: { readonly value: WebSocketStatus; peek(): WebSocketStatus };
  /** Reactive last received message (deserialized). */
  data: Signal<TReceive | undefined>;
  /** Last error event. */
  error: Signal<Event | null>;
  /** Rolling message history (newest last). */
  history: Signal<TReceive[]>;
  /** Computed boolean — `true` when the socket is `OPEN`. */
  isConnected: { readonly value: boolean; peek(): boolean };
  /** Number of reconnection attempts since last successful open. */
  reconnectAttempts: Signal<number>;
  /** Send a message. Queues while the connection is not yet open when `immediate` is true. */
  send: (data: TSend) => void;
  /** Send raw data without serialization. */
  sendRaw: (data: string | ArrayBufferLike | Blob | ArrayBufferView) => void;
  /** Manually open / reconnect the WebSocket. */
  open: () => void;
  /** Gracefully close the connection. */
  close: (code?: number, reason?: string) => void;
  /** Tear down all resources (close + remove listeners + stop reconnect/heartbeat). */
  dispose: () => void;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** @internal */
const resolveReconnect = (
  opt: UseWebSocketOptions['autoReconnect']
): WebSocketReconnectConfig | false => {
  if (opt === false) return false;
  if (opt === true || opt === undefined) return {};
  return opt;
};

/** @internal */
const resolveHeartbeat = (
  opt: UseWebSocketOptions['heartbeat']
): WebSocketHeartbeatConfig | false => {
  if (!opt) return false;
  if (opt === true) return {};
  return opt;
};

/** @internal */
const computeDelay = (attempt: number, config: WebSocketReconnectConfig): number => {
  const base = config.delay ?? 1000;
  const factor = config.factor ?? 2;
  const max = config.maxDelay ?? 30_000;
  return Math.min(base * factor ** attempt, max);
};

// ---------------------------------------------------------------------------
// useWebSocket
// ---------------------------------------------------------------------------

/**
 * Reactive WebSocket composable with auto-reconnect, heartbeat,
 * typed messaging, and signal-based connection state.
 *
 * @template TSend - Type of outgoing messages (serialized via `serialize`)
 * @template TReceive - Type of incoming messages (deserialized via `deserialize`)
 * @param url - WebSocket URL (`ws://` or `wss://`) or a getter returning one
 * @param options - Connection, reconnect, heartbeat, and serialization options
 * @returns Reactive WebSocket state with `send()`, `open()`, `close()`, and `dispose()`
 *
 * @example
 * ```ts
 * import { useWebSocket } from '@bquery/bquery/reactive';
 *
 * const ws = useWebSocket<{ type: string; payload: unknown }>('wss://api.example.com/ws', {
 *   autoReconnect: { maxAttempts: 5, delay: 2000 },
 *   heartbeat: true,
 *   historySize: 50,
 *   onMessage: (data) => console.log('Received:', data),
 * });
 *
 * ws.send({ type: 'subscribe', payload: { channel: 'updates' } });
 *
 * // Reactive state
 * effect(() => {
 *   console.log('Connected:', ws.isConnected.value);
 *   console.log('Last message:', ws.data.value);
 * });
 *
 * // Cleanup
 * ws.dispose();
 * ```
 */
export const useWebSocket = <TSend = string, TReceive = string>(
  url: string | URL | (() => string | URL),
  options: UseWebSocketOptions<TSend, TReceive> = {}
): UseWebSocketReturn<TSend, TReceive> => {
  const {
    protocols,
    immediate = true,
    historySize = 0,
    onOpen,
    onMessage,
    onClose,
    onError,
  } = options;

  const serialize = options.serialize ?? ((d: TSend) => JSON.stringify(d));
  const deserialize =
    options.deserialize ?? ((event: MessageEvent) => {
      const raw = event.data;
      if (typeof raw === 'string') {
        try {
          return JSON.parse(raw) as TReceive;
        } catch {
          return raw as unknown as TReceive;
        }
      }
      return raw as TReceive;
    });

  // --- Reactive state ---
  const status = signal<WebSocketStatus>('CLOSED');
  const data = signal<TReceive | undefined>(undefined);
  const error = signal<Event | null>(null);
  const history = signal<TReceive[]>([]);
  const reconnectAttempts = signal(0);
  const isConnected = computed(() => status.value === 'OPEN');

  // --- Internal state ---
  let ws: WebSocket | null = null;
  let disposed = false;
  let explicitClose = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  let pongTimer: ReturnType<typeof setTimeout> | undefined;
  let internalReconnectCount = 0;
  let isAutoReconnecting = false;
  const sendQueue: Array<string | ArrayBufferLike | Blob | ArrayBufferView> = [];

  const reconnectConfig = resolveReconnect(options.autoReconnect);
  const heartbeatConfig = resolveHeartbeat(options.heartbeat);

  // --- Heartbeat ---
  const startHeartbeat = (): void => {
    if (!heartbeatConfig) return;
    stopHeartbeat();
    const interval = heartbeatConfig.interval ?? 30_000;
    const timeout = heartbeatConfig.pongTimeout ?? 10_000;
    const pingMsg = heartbeatConfig.message ?? 'ping';

    heartbeatTimer = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(pingMsg as string | ArrayBufferLike);
        pongTimer = setTimeout(() => {
          // No pong received — force close to trigger reconnect
          ws?.close(4000, 'Heartbeat timeout');
        }, timeout);
      }
    }, interval);
  };

  const stopHeartbeat = (): void => {
    if (heartbeatTimer !== undefined) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = undefined;
    }
    if (pongTimer !== undefined) {
      clearTimeout(pongTimer);
      pongTimer = undefined;
    }
  };

  const resetPongTimer = (): void => {
    if (pongTimer !== undefined) {
      clearTimeout(pongTimer);
      pongTimer = undefined;
    }
  };

  // --- Reconnect ---
  const scheduleReconnect = (event: CloseEvent): void => {
    if (disposed || explicitClose || !reconnectConfig) return;

    const maxAttempts = reconnectConfig.maxAttempts ?? Infinity;

    if (internalReconnectCount >= maxAttempts) return;

    if (
      reconnectConfig.shouldReconnect &&
      !reconnectConfig.shouldReconnect(event, internalReconnectCount)
    ) {
      return;
    }

    const delay = computeDelay(internalReconnectCount, reconnectConfig);
    reconnectTimer = setTimeout(() => {
      internalReconnectCount++;
      reconnectAttempts.value = internalReconnectCount;
      isAutoReconnecting = true;
      open();
    }, delay);
  };

  const cancelReconnect = (): void => {
    if (reconnectTimer !== undefined) {
      clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
    }
  };

  // --- Queue ---
  const flushQueue = (): void => {
    while (sendQueue.length > 0 && ws?.readyState === WebSocket.OPEN) {
      ws.send(sendQueue.shift()!);
    }
  };

  // --- Core ---
  const resolveUrl = (): string => {
    const resolved = typeof url === 'function' ? url() : url;
    return resolved instanceof URL ? resolved.toString() : resolved;
  };

  const open = (): void => {
    if (disposed) return;

    // Clean up any existing connection
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      ws = null;
    }

    explicitClose = false;
    status.value = 'CONNECTING';
    error.value = null;

    try {
      ws = new WebSocket(resolveUrl(), protocols);
    } catch (err) {
      status.value = 'CLOSED';
      return;
    }

    ws.onopen = (event: Event): void => {
      status.value = 'OPEN';
      if (!isAutoReconnecting) {
        internalReconnectCount = 0;
        reconnectAttempts.value = 0;
      }
      isAutoReconnecting = false;
      flushQueue();
      startHeartbeat();
      onOpen?.(event);
    };

    ws.onmessage = (event: MessageEvent): void => {
      // Heartbeat pong detection
      if (heartbeatConfig) {
        const responseMsg = heartbeatConfig.responseMessage;
        if (responseMsg === undefined || event.data === responseMsg) {
          resetPongTimer();
        }
      }

      const deserialized = deserialize(event);
      data.value = deserialized;

      if (historySize > 0) {
        const current = history.peek();
        const updated = [...current, deserialized];
        history.value = updated.length > historySize ? updated.slice(-historySize) : updated;
      }

      onMessage?.(deserialized, event);
    };

    ws.onclose = (event: CloseEvent): void => {
      status.value = 'CLOSED';
      stopHeartbeat();

      onClose?.(event);

      if (!explicitClose && !disposed) {
        scheduleReconnect(event);
      }
    };

    ws.onerror = (event: Event): void => {
      error.value = event;
      onError?.(event);
    };
  };

  const close = (code?: number, reason?: string): void => {
    explicitClose = true;
    cancelReconnect();
    stopHeartbeat();

    if (ws) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        status.value = 'CLOSING';
        ws.close(code, reason);
      }
    }
  };

  const send = (msg: TSend): void => {
    const serialized = serialize(msg);
    sendRaw(serialized);
  };

  const sendRaw = (raw: string | ArrayBufferLike | Blob | ArrayBufferView): void => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(raw);
    } else {
      sendQueue.push(raw);
    }
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    close();
    sendQueue.length = 0;
    ws = null;
  };

  // --- Start ---
  if (immediate) {
    open();
  }

  return {
    status,
    data,
    error,
    history,
    isConnected,
    reconnectAttempts,
    send,
    sendRaw,
    open,
    close,
    dispose,
  };
};

// ---------------------------------------------------------------------------
// useEventSource
// ---------------------------------------------------------------------------

/** Configuration for `useEventSource()`. */
export interface UseEventSourceOptions<TData = unknown> {
  /** Whether to open the connection immediately (default: true). */
  immediate?: boolean;
  /** Automatically reconnect on error (default: true). Pass a `WebSocketReconnectConfig` for full control. */
  autoReconnect?: boolean | WebSocketReconnectConfig;
  /** Event names to listen for besides the default `message` event. */
  events?: string[];
  /** Deserializer for incoming event data. Default: `JSON.parse` with string fallback. */
  deserialize?: (data: string) => TData;
  /** EventSource init options (e.g. `withCredentials`). */
  eventSourceInit?: EventSourceInit;
  /** Called when the connection opens. */
  onOpen?: (event: Event) => void;
  /** Called when a message is received. */
  onMessage?: (data: TData, event: MessageEvent) => void;
  /** Called when an error occurs. */
  onError?: (event: Event) => void;
}

/** Return value of `useEventSource()`. */
export interface UseEventSourceReturn<TData = unknown> {
  /** Current connection status (`CONNECTING`, `OPEN`, `CLOSED`). */
  status: { readonly value: WebSocketStatus; peek(): WebSocketStatus };
  /** Last received data (deserialized). */
  data: Signal<TData | undefined>;
  /** Last event name that delivered data. */
  eventName: Signal<string | undefined>;
  /** Last error event. */
  error: Signal<Event | null>;
  /** Computed boolean — `true` when the EventSource is open. */
  isConnected: { readonly value: boolean; peek(): boolean };
  /** Manually open / reconnect the EventSource. */
  open: () => void;
  /** Close the connection. */
  close: () => void;
  /** Tear down all resources. */
  dispose: () => void;
}

/**
 * Reactive Server-Sent Events (SSE) composable.
 *
 * Wraps the native `EventSource` API with reactive signals, auto-reconnect,
 * and typed deserialization.
 *
 * @template TData - Type of deserialized event data
 * @param url - SSE endpoint URL or a getter returning one
 * @param options - EventSource options
 * @returns Reactive EventSource state with `open()`, `close()`, and `dispose()`
 *
 * @example
 * ```ts
 * import { useEventSource } from '@bquery/bquery/reactive';
 *
 * const sse = useEventSource<{ type: string; message: string }>('/api/events', {
 *   events: ['notification', 'update'],
 *   onMessage: (data) => console.log('Event:', data),
 * });
 *
 * effect(() => {
 *   if (sse.data.value) {
 *     console.log(`[${sse.eventName.value}]`, sse.data.value);
 *   }
 * });
 *
 * sse.dispose();
 * ```
 */
export const useEventSource = <TData = unknown>(
  url: string | URL | (() => string | URL),
  options: UseEventSourceOptions<TData> = {}
): UseEventSourceReturn<TData> => {
  const {
    immediate = true,
    events = [],
    eventSourceInit,
    onOpen,
    onMessage,
    onError,
  } = options;

  const deserialize =
    options.deserialize ??
    ((raw: string) => {
      try {
        return JSON.parse(raw) as TData;
      } catch {
        return raw as unknown as TData;
      }
    });

  const status = signal<WebSocketStatus>('CLOSED');
  const data = signal<TData | undefined>(undefined);
  const eventName = signal<string | undefined>(undefined);
  const error = signal<Event | null>(null);
  const isConnected = computed(() => status.value === 'OPEN');

  const reconnectConfig = resolveReconnect(options.autoReconnect);

  let es: EventSource | null = null;
  let disposed = false;
  let explicitClose = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let reconnectAttemptCount = 0;

  const resolveUrl = (): string => {
    const resolved = typeof url === 'function' ? url() : url;
    return resolved instanceof URL ? resolved.toString() : resolved;
  };

  const handleMessage = (name: string) => (event: MessageEvent): void => {
    const deserialized = deserialize(event.data);
    data.value = deserialized;
    eventName.value = name;
    onMessage?.(deserialized, event);
  };

  const cancelReconnect = (): void => {
    if (reconnectTimer !== undefined) {
      clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
    }
  };

  const scheduleReconnect = (): void => {
    if (disposed || explicitClose || !reconnectConfig) return;

    const maxAttempts = reconnectConfig.maxAttempts ?? Infinity;
    if (reconnectAttemptCount >= maxAttempts) return;

    const delay = computeDelay(reconnectAttemptCount, reconnectConfig);
    reconnectTimer = setTimeout(() => {
      reconnectAttemptCount++;
      open();
    }, delay);
  };

  const open = (): void => {
    if (disposed) return;

    if (es) {
      es.close();
      es = null;
    }

    explicitClose = false;
    status.value = 'CONNECTING';
    error.value = null;

    try {
      es = new EventSource(resolveUrl(), eventSourceInit);
    } catch {
      status.value = 'CLOSED';
      return;
    }

    es.onopen = (event: Event): void => {
      status.value = 'OPEN';
      reconnectAttemptCount = 0;
      onOpen?.(event);
    };

    es.onerror = (event: Event): void => {
      error.value = event;
      onError?.(event);

      // EventSource closes on error when readyState is CLOSED
      if (es?.readyState === EventSource.CLOSED) {
        status.value = 'CLOSED';
        if (!explicitClose && !disposed) {
          scheduleReconnect();
        }
      }
    };

    // Default "message" event
    es.addEventListener('message', handleMessage('message'));

    // Named events
    for (const name of events) {
      es.addEventListener(name, handleMessage(name) as EventListener);
    }
  };

  const close = (): void => {
    explicitClose = true;
    cancelReconnect();
    if (es) {
      es.close();
      es = null;
    }
    status.value = 'CLOSED';
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    close();
  };

  if (immediate) {
    open();
  }

  return {
    status,
    data,
    eventName,
    error,
    isConnected,
    open,
    close,
    dispose,
  };
};
