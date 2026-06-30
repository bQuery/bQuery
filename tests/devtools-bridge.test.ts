/**
 * DevTools bridge protocol tests — issue #146.
 *
 * The bridge is the stabilized contract between a bQuery app and the browser
 * extension. These tests exercise the transport-agnostic server (handshake,
 * request/response, event streaming, error + foreign-message handling), the
 * component-tree serializer, and the `window.postMessage` transport wiring.
 */

import { afterEach, describe, expect, it } from 'bun:test';
import {
  BRIDGE_PROTOCOL_VERSION,
  BRIDGE_SOURCE,
  connectDevtoolsBridge,
  createBridgeServer,
  serializeComponentTree,
  type BridgeOutboundMessage,
} from '../src/devtools/index';
import { clearTimeline, enableDevtools } from '../src/devtools/index';

const hello = () => ({
  source: BRIDGE_SOURCE,
  channel: 'panel' as const,
  v: 1,
  kind: 'hello' as const,
});
const request = (id: number, method: string, params?: unknown) => ({
  source: BRIDGE_SOURCE,
  channel: 'panel' as const,
  v: 1,
  kind: 'request' as const,
  id,
  method,
  params,
});

afterEach(() => {
  clearTimeline();
  document.body.innerHTML = '';
});

describe('DevTools bridge — server protocol (#146)', () => {
  it('answers a hello with the init handshake', () => {
    const sent: BridgeOutboundMessage[] = [];
    const server = createBridgeServer({ post: (m) => sent.push(m) });
    server.handleMessage(hello());
    expect(sent).toHaveLength(1);
    const init = sent[0];
    expect(init.kind).toBe('init');
    expect(init.v).toBe(BRIDGE_PROTOCOL_VERSION);
    if (init.kind === 'init') {
      expect(init.capabilities).toContain('signals');
      expect(init.capabilities).toContain('time-travel');
    }
  });

  it('responds to ping and getSnapshot requests', () => {
    const sent: BridgeOutboundMessage[] = [];
    const server = createBridgeServer({ post: (m) => sent.push(m) });

    server.handleMessage(request(1, 'ping'));
    server.handleMessage(request(2, 'getSnapshot'));

    const ping = sent.find((m) => m.kind === 'response' && m.id === 1);
    const snap = sent.find((m) => m.kind === 'response' && m.id === 2);
    expect(ping && ping.kind === 'response' && (ping.result as { ok: boolean }).ok).toBe(true);
    expect(snap && snap.kind === 'response' && (snap.result as { version: number }).version).toBe(
      1
    );
  });

  it('returns an error response for an unknown method', () => {
    const sent: BridgeOutboundMessage[] = [];
    const server = createBridgeServer({ post: (m) => sent.push(m) });
    server.handleMessage(request(7, 'nope'));
    const res = sent[0];
    expect(res.kind).toBe('response');
    if (res.kind === 'response') {
      expect(res.id).toBe(7);
      expect(res.error).toContain('Unknown method');
    }
  });

  it('supports custom/override methods', () => {
    const sent: BridgeOutboundMessage[] = [];
    const server = createBridgeServer({
      post: (m) => sent.push(m),
      methods: { echo: (p) => p },
    });
    expect(server.methods).toContain('echo');
    server.handleMessage(request(3, 'echo', { hi: true }));
    const res = sent[0];
    expect(res.kind === 'response' && res.result).toEqual({ hi: true });
  });

  it('streams timeline entries as event messages', () => {
    const sent: BridgeOutboundMessage[] = [];
    const server = createBridgeServer({ post: (m) => sent.push(m) });
    server.pushEvent({ type: 'signal', label: 'x', timestamp: 0 } as never);
    expect(sent[0].kind).toBe('event');
  });

  it('ignores foreign messages (wrong source/channel)', () => {
    const sent: BridgeOutboundMessage[] = [];
    const server = createBridgeServer({ post: (m) => sent.push(m) });
    server.handleMessage({ source: 'something-else', channel: 'panel', v: 1, kind: 'hello' });
    server.handleMessage({ source: BRIDGE_SOURCE, channel: 'page', v: 1, kind: 'init' });
    expect(sent).toHaveLength(0);
  });
});

describe('DevTools bridge — component tree (#146)', () => {
  it('serializes nested custom elements and skips plain DOM', () => {
    document.body.innerHTML = `
      <div>
        <my-app data-id="root">
          <my-card title="A"></my-card>
          <span><my-card title="B"></my-card></span>
        </my-app>
      </div>`;
    const tree = serializeComponentTree();
    expect(tree).toHaveLength(1);
    expect(tree[0].tag).toBe('my-app');
    expect(tree[0].attrs['data-id']).toBe('root');
    // Both <my-card> are descendants (one nested under a plain <span>).
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children.every((c) => c.tag === 'my-card')).toBe(true);
  });
});

describe('DevTools bridge — window transport (#146)', () => {
  it('announces on connect, handles message events, and disconnects', () => {
    const listeners: Record<string, ((e: MessageEvent) => void)[]> = {};
    const posted: unknown[] = [];
    const fakeWindow = {
      postMessage: (m: unknown) => posted.push(m),
      addEventListener: (type: string, fn: (e: MessageEvent) => void) => {
        (listeners[type] ??= []).push(fn);
      },
      removeEventListener: (type: string, fn: (e: MessageEvent) => void) => {
        listeners[type] = (listeners[type] ?? []).filter((f) => f !== fn);
      },
    } as unknown as Window;

    enableDevtools(true);
    const conn = connectDevtoolsBridge({ target: fakeWindow });

    // init is announced immediately.
    expect((posted[0] as { kind: string }).kind).toBe('init');

    // Inbound request flows through the message listener.
    listeners.message[0]({ data: request(9, 'ping') } as MessageEvent);
    expect(posted.some((m) => (m as { id?: number }).id === 9)).toBe(true);

    conn.disconnect();
    expect(listeners.message).toHaveLength(0);
    enableDevtools(false);
  });
});
