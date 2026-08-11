/**
 * Stable bridge protocol between a bQuery app and the DevTools browser
 * extension (1.15+).
 *
 * The protocol is a small, versioned message contract carried over any
 * request/response transport. In the browser it rides on `window.postMessage`
 * (page ⇄ content-script ⇄ extension panel); the core
 * {@link createBridgeServer} is transport-agnostic so it can be unit-tested
 * without a DOM.
 *
 * Message envelopes always carry `source: 'bquery-devtools'` and the protocol
 * version `v`. The panel sends `hello` / `request`; the page replies with
 * `init` / `response` and streams `event` messages as the timeline grows.
 *
 * @module bquery/devtools
 */

import { getTimeline, inspectComponents, subscribeTimeline } from './devtools';
import { exportDevtoolsSnapshot, type DevtoolsSnapshot } from './extensions';
import type { TimelineEntry } from './types';

/** Current bridge protocol version. Bumped only on breaking protocol changes. */
export const BRIDGE_PROTOCOL_VERSION = 1;

/** Shared `source` discriminator on every bridge message. */
export const BRIDGE_SOURCE = 'bquery-devtools';

/** Capabilities advertised by the page in its `init` handshake. */
export const BRIDGE_CAPABILITIES = [
  'signals',
  'stores',
  'components',
  'timeline',
  'time-travel',
] as const;

/** A serialized node in the component tree. */
export interface ComponentTreeNode {
  /** Custom-element tag name (always contains a hyphen). */
  tag: string;
  /** A stable-ish id derived from tree position. */
  id: string;
  /** Selected attributes, for display in the panel. */
  attrs: Record<string, string>;
  /** Nested custom-element descendants. */
  children: ComponentTreeNode[];
}

/** Panel → page messages. */
export type BridgeInboundMessage =
  | { source: typeof BRIDGE_SOURCE; channel: 'panel'; v: number; kind: 'hello' }
  | {
      source: typeof BRIDGE_SOURCE;
      channel: 'panel';
      v: number;
      kind: 'request';
      id: number;
      method: string;
      params?: unknown;
    };

/** Page → panel messages. */
export type BridgeOutboundMessage =
  | {
      source: typeof BRIDGE_SOURCE;
      channel: 'page';
      v: number;
      kind: 'init';
      capabilities: readonly string[];
    }
  | {
      source: typeof BRIDGE_SOURCE;
      channel: 'page';
      v: number;
      kind: 'response';
      id: number;
      result?: unknown;
      error?: string;
    }
  | {
      source: typeof BRIDGE_SOURCE;
      channel: 'page';
      v: number;
      kind: 'event';
      entry: TimelineEntry;
    };

/** A request handler registered on the bridge server. */
export type BridgeMethod = (params: unknown) => unknown;

/** Options for {@link createBridgeServer}. */
export interface BridgeServerOptions {
  /** Transport sink — called with each outbound (page → panel) message. */
  post: (message: BridgeOutboundMessage) => void;
  /** Extra/override methods merged over the built-in read methods. */
  methods?: Record<string, BridgeMethod>;
}

/** Handle returned by {@link createBridgeServer}. */
export interface BridgeServer {
  /** Feed one inbound (panel → page) message in. Ignores foreign messages. */
  handleMessage: (data: unknown) => void;
  /** Stream a timeline entry to the panel as an `event` message. */
  pushEvent: (entry: TimelineEntry) => void;
  /** Send the `init` handshake (also sent automatically on `hello`). */
  announce: () => void;
  /** Registered method names (built-ins + overrides). */
  methods: readonly string[];
}

/**
 * Walks the DOM from `root` and serializes the tree of custom elements
 * (tag names containing a hyphen) for the panel's component tree.
 */
export const serializeComponentTree = (root?: ParentNode): ComponentTreeNode[] => {
  const start = root ?? (typeof document !== 'undefined' ? document.body : undefined);
  if (!start) return [];

  const walk = (el: Element, path: string): ComponentTreeNode | ComponentTreeNode[] => {
    const isComponent = el.tagName.includes('-');
    const children: ComponentTreeNode[] = [];
    let index = 0;
    for (const child of Array.from(el.children)) {
      const childPath = isComponent ? `${path}/${index}` : path;
      const result = walk(child, childPath);
      if (Array.isArray(result)) children.push(...result);
      else children.push(result);
      index += 1;
    }
    if (!isComponent) return children;

    const attrs: Record<string, string> = {};
    for (const attr of Array.from(el.attributes)) attrs[attr.name] = attr.value;
    return { tag: el.tagName.toLowerCase(), id: path || '0', attrs, children };
  };

  const out: ComponentTreeNode[] = [];
  let index = 0;
  for (const child of Array.from(start.children)) {
    const result = walk(child, String(index));
    if (Array.isArray(result)) out.push(...result);
    else out.push(result);
    index += 1;
  }
  return out;
};

/** The built-in, read-only methods every bridge server answers. */
const builtinMethods = (): Record<string, BridgeMethod> => ({
  ping: () => ({ v: BRIDGE_PROTOCOL_VERSION, ok: true }),
  getSnapshot: (): DevtoolsSnapshot => exportDevtoolsSnapshot(),
  getTimeline: (params) => {
    const limit =
      typeof params === 'object' && params && 'limit' in params
        ? Number((params as { limit?: number }).limit)
        : undefined;
    const timeline = getTimeline();
    return limit && limit > 0 ? timeline.slice(-limit) : timeline;
  },
  getComponentTree: () => ({
    tree: serializeComponentTree(),
    flat: inspectComponents(),
  }),
});

const isInbound = (data: unknown): data is BridgeInboundMessage => {
  if (typeof data !== 'object' || data === null) return false;
  const msg = data as {
    source?: unknown;
    channel?: unknown;
    kind?: unknown;
    id?: unknown;
    method?: unknown;
  };
  if (msg.source !== BRIDGE_SOURCE || msg.channel !== 'panel') return false;
  if (msg.kind === 'hello') return true;
  // Only dispatch fully-formed requests; a malformed message must not reach
  // `methods[undefined]` and emit a response with an undefined id.
  return msg.kind === 'request' && typeof msg.id === 'number' && typeof msg.method === 'string';
};

/**
 * Creates a transport-agnostic bridge server. Feed inbound panel messages to
 * {@link BridgeServer.handleMessage} and call {@link BridgeServer.pushEvent}
 * for timeline updates; outbound messages go to `options.post`.
 *
 * @example
 * ```ts
 * const sent: unknown[] = [];
 * const server = createBridgeServer({ post: (m) => sent.push(m) });
 * server.handleMessage({ source: 'bquery-devtools', channel: 'panel', v: 1, kind: 'hello' });
 * // sent[0] is the `init` handshake
 * ```
 */
export const createBridgeServer = (options: BridgeServerOptions): BridgeServer => {
  const methods: Record<string, BridgeMethod> = { ...builtinMethods(), ...options.methods };

  const announce = (): void => {
    options.post({
      source: BRIDGE_SOURCE,
      channel: 'page',
      v: BRIDGE_PROTOCOL_VERSION,
      kind: 'init',
      capabilities: BRIDGE_CAPABILITIES,
    });
  };

  const handleMessage = (data: unknown): void => {
    if (!isInbound(data)) return;

    if (data.kind === 'hello') {
      announce();
      return;
    }

    // request
    const method = methods[data.method];
    if (!method) {
      options.post({
        source: BRIDGE_SOURCE,
        channel: 'page',
        v: BRIDGE_PROTOCOL_VERSION,
        kind: 'response',
        id: data.id,
        error: `Unknown method: ${data.method}`,
      });
      return;
    }
    try {
      const result = method(data.params);
      options.post({
        source: BRIDGE_SOURCE,
        channel: 'page',
        v: BRIDGE_PROTOCOL_VERSION,
        kind: 'response',
        id: data.id,
        result,
      });
    } catch (error) {
      options.post({
        source: BRIDGE_SOURCE,
        channel: 'page',
        v: BRIDGE_PROTOCOL_VERSION,
        kind: 'response',
        id: data.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const pushEvent = (entry: TimelineEntry): void => {
    options.post({
      source: BRIDGE_SOURCE,
      channel: 'page',
      v: BRIDGE_PROTOCOL_VERSION,
      kind: 'event',
      entry,
    });
  };

  return { handleMessage, pushEvent, announce, methods: Object.keys(methods) };
};

/** Options for {@link connectDevtoolsBridge}. */
export interface ConnectBridgeOptions {
  /** Extra/override request methods. */
  methods?: Record<string, BridgeMethod>;
  /** Window to attach to. Defaults to the global `window`. */
  target?: Window;
}

/** Handle returned by {@link connectDevtoolsBridge}. */
export interface BridgeConnection {
  /** Tears down the message listener and timeline subscription. */
  disconnect: () => void;
  /** The underlying transport-agnostic server. */
  server: BridgeServer;
}

/**
 * Connects the bridge protocol to `window.postMessage`, announces the `init`
 * handshake, answers panel `request`s, and forwards timeline events to the
 * extension. No-op (returns an inert handle) outside a DOM environment.
 *
 * This is the stabilized contract the DevTools extension connects to.
 *
 * @returns A {@link BridgeConnection} with `disconnect()`.
 */
export const connectDevtoolsBridge = (options: ConnectBridgeOptions = {}): BridgeConnection => {
  const target = options.target ?? (typeof window !== 'undefined' ? window : undefined);
  if (!target) {
    const noop = createBridgeServer({ post: () => {}, methods: options.methods });
    return { disconnect: () => {}, server: noop };
  }

  const server = createBridgeServer({
    post: (message) => target.postMessage(message, '*'),
    methods: options.methods,
  });

  const onMessage = (event: MessageEvent): void => server.handleMessage(event.data);
  target.addEventListener('message', onMessage as EventListener);
  const unsubscribe = subscribeTimeline((entry) => server.pushEvent(entry));

  // Announce immediately so a panel that loaded first sees us.
  server.announce();

  return {
    server,
    disconnect: () => {
      target.removeEventListener('message', onMessage as EventListener);
      unsubscribe();
    },
  };
};
