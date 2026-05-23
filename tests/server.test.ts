import { afterEach, describe, expect, it } from 'bun:test';
import type { ServerWebSocketPeer } from '../src/server/index';
import {
  badRequest,
  createServer,
  isServerWebSocketSession,
  isWebSocketRequest,
  ServerHttpError,
} from '../src/server/index';
import { createStore, destroyStore, listStores } from '../src/store/index';

const SSR_TEST_STORE_ID = 'server-ssr-test';

afterEach(() => {
  if (listStores().includes(SSR_TEST_STORE_ID)) {
    destroyStore(SSR_TEST_STORE_ID);
  }
});

class MockServerWebSocketPeer implements ServerWebSocketPeer {
  protocol = '';
  readyState = 1;

  constructor(
    public url = 'ws://localhost/test',
    readonly sentMessages: unknown[] = [],
    readonly closeCalls: Array<{ code?: number; reason?: string }> = []
  ) {}

  send(data: unknown): void {
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string): void {
    this.readyState = 3;
    this.closeCalls.push({ code, reason });
  }
}

const createWebSocketRequest = (url: string): Request =>
  new Request(url, {
    headers: {
      connection: 'keep-alive, Upgrade',
      upgrade: 'websocket',
      'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
      'sec-websocket-version': '13',
    },
    method: 'GET',
  });

describe('server/createServer', () => {
  it('handles static routes via method helpers', async () => {
    const app = createServer();
    app.get('/health', (ctx) => ctx.text('ok'));

    const response = await app.handle('/health');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(await response.text()).toBe('ok');
  });

  it('parses params and repeated query values', async () => {
    const app = createServer();
    app.get('/users/:id', (ctx) =>
      ctx.json({
        filter: ctx.query.filter,
        queryHasNullPrototype: Object.getPrototypeOf(ctx.query) === null,
        id: ctx.params.id,
        paramsHaveNullPrototype: Object.getPrototypeOf(ctx.params) === null,
        tags: ctx.query.tag,
      })
    );

    const response = await app.handle('/users/42?filter=active&tag=admin&tag=beta');

    expect(await response.json()).toEqual({
      filter: 'active',
      queryHasNullPrototype: true,
      id: '42',
      paramsHaveNullPrototype: true,
      tags: ['admin', 'beta'],
    });
  });

  it('ignores prototype-pollution query keys', async () => {
    const app = createServer();
    app.get('/search', (ctx) =>
      ctx.json({
        constructorType: typeof ctx.query.constructor,
        protoType: typeof ctx.query.__proto__,
        prototypeType: typeof ctx.query.prototype,
        tag: ctx.query.tag,
      })
    );

    const response = await app.handle(
      '/search?__proto__=polluted&constructor=oops&prototype=bad&tag=safe'
    );

    expect(await response.json()).toEqual({
      constructorType: 'undefined',
      protoType: 'undefined',
      prototypeType: 'undefined',
      tag: 'safe',
    });
  });

  it('runs global and route middleware in order', async () => {
    const app = createServer();

    app.use(async (ctx, next) => {
      ctx.state.steps = ['global'];
      return await next();
    });

    app.get(
      '/pipeline',
      (ctx) => {
        const steps = ctx.state.steps as string[];
        steps.push('handler');
        return ctx.json({ steps });
      },
      [
        async (ctx, next) => {
          const steps = ctx.state.steps as string[];
          steps.push('route');
          return await next();
        },
      ]
    );

    const response = await app.handle('/pipeline');

    expect(await response.json()).toEqual({
      steps: ['global', 'route', 'handler'],
    });
  });

  it('sanitizes html helper output by default', async () => {
    const app = createServer();
    app.get('/unsafe', (ctx) =>
      ctx.html('<div onclick="alert(1)"><script>alert(1)</script><strong>safe</strong></div>')
    );

    const response = await app.handle('/unsafe');
    const body = await response.text();

    expect(response.headers.get('content-type')).toContain('text/html');
    expect(body).toContain('<strong>safe</strong>');
    expect(body).not.toContain('<script');
    expect(body).not.toContain('onclick=');
  });

  it('renders SSR templates through the server context helper', async () => {
    createStore({
      id: SSR_TEST_STORE_ID,
      state: () => ({
        ready: true,
      }),
    });

    const app = createServer();
    app.get('/ssr', (ctx) =>
      ctx.render(
        '<main><h1 bq-text="title"></h1></main>',
        { title: 'Server Rendered' },
        {
          includeStoreState: [SSR_TEST_STORE_ID],
        }
      )
    );

    const response = await app.handle('/ssr');
    const body = await response.text();

    expect(response.headers.get('content-type')).toContain('text/html');
    expect(body).toContain('Server Rendered');
    expect(body).toContain('__BQUERY_INITIAL_STATE__');
    expect(body).toContain(SSR_TEST_STORE_ID);
  });

  it('parses json bodies, request cookies, and appends response cookies', async () => {
    const app = createServer();
    app.post('/body', async (ctx) => {
      const body = (await ctx.body()) as { message: string };
      ctx.setCookie('session', 'abc123', { httpOnly: true, path: '/' });
      return ctx.json({
        body,
        cookie: ctx.cookies.theme,
      });
    });

    const response = await app.handle({
      body: JSON.stringify({ message: 'hello' }),
      headers: {
        'content-type': 'application/json',
        cookie: 'theme=dark',
      },
      method: 'POST',
      url: '/body',
    });

    expect(await response.json()).toEqual({
      body: { message: 'hello' },
      cookie: 'dark',
    });
    expect(response.headers.get('set-cookie')).toContain('session=abc123');
  });

  it('enforces multipart body limits', async () => {
    const app = createServer({
      limits: {
        multipart: 32,
      },
    });
    app.post('/upload', async (ctx) => {
      await ctx.body();
      return ctx.text('ok');
    });

    const boundary = '----bquery-boundary';
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="demo.txt"',
      'Content-Type: text/plain',
      '',
      'payload that is intentionally too large',
      `--${boundary}--`,
      '',
    ].join('\r\n');

    const response = await app.handle(
      new Request('http://localhost/upload', {
        body,
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        method: 'POST',
      })
    );

    expect(response.status).toBe(413);
    expect(await response.text()).toBe('Multipart form body exceeds the configured limit.');
  });

  it('supports stream, sse, and renderStream helpers', async () => {
    const app = createServer();
    const encoder = new TextEncoder();

    app.get('/stream', (ctx) =>
      ctx.stream(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode('streamed'));
            controller.close();
          },
        }),
        { headers: { 'content-type': 'text/plain; charset=utf-8' } }
      )
    );
    app.get('/sse', (ctx) => ctx.sse([{ event: 'message', data: 'hello' }]));
    app.get('/render-stream', (ctx) =>
      ctx.renderStream('<main><h1 bq-text="title"></h1></main>', { title: 'streamed html' })
    );

    const streamResponse = await app.handle('/stream');
    expect(await streamResponse.text()).toBe('streamed');

    const sseResponse = await app.handle('/sse');
    expect(sseResponse.headers.get('content-type')).toContain('text/event-stream');
    expect(await sseResponse.text()).toContain('event: message');

    app.get('/sse-text', (ctx) => ctx.sse(['hello\nworld']));
    const sseTextResponse = await app.handle('/sse-text');
    expect(await sseTextResponse.text()).toContain('data: hello\ndata: world\n');

    const renderResponse = await app.handle('/render-stream');
    expect(renderResponse.headers.get('content-type')).toContain('text/html');
    expect(await renderResponse.text()).toContain('streamed html');
  });

  it('supports renderResponse and accepted content negotiation helpers', async () => {
    const app = createServer();
    app.get('/response', async (ctx) => {
      const accepted = ctx.accepts(['application/json', 'text/html']);
      ctx.setCookie('accepted', accepted ?? 'none');
      return await ctx.renderResponse('<div bq-text="value"></div>', { value: accepted });
    });

    const response = await app.handle(
      new Request('http://localhost/response', {
        headers: {
          accept: 'application/jsonp;q=1, text/html;q=0.8, application/json;q=0.7',
        },
      })
    );

    expect(await response.text()).toContain('text/html');
    expect(response.headers.get('set-cookie')).toContain('accepted=text%2Fhtml');
  });

  it('returns 404 for unmatched routes', async () => {
    const app = createServer();

    const response = await app.handle('/missing');

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('Not Found');
  });

  it('uses the custom error handler when middleware or handlers throw', async () => {
    const app = createServer({
      onError(error, ctx) {
        const message = error instanceof Error ? error.message : 'unknown';
        return ctx.json({ message }, { status: 418 });
      },
    });

    app.get('/boom', () => {
      throw new Error('boom');
    });

    const response = await app.handle('/boom');

    expect(response.status).toBe(418);
    expect(await response.json()).toEqual({ message: 'boom' });
  });

  it('maps structured server http errors to their configured status codes', async () => {
    const app = createServer();

    app.get('/bad-request', () => {
      throw badRequest('broken');
    });
    app.get('/hidden-error', () => {
      throw new ServerHttpError(500, 'sensitive', { expose: false });
    });

    const badResponse = await app.handle('/bad-request');
    expect(badResponse.status).toBe(400);
    expect(await badResponse.text()).toBe('broken');

    const hiddenResponse = await app.handle('/hidden-error');
    expect(hiddenResponse.status).toBe(500);
    expect(await hiddenResponse.text()).toBe('Internal Server Error');
  });

  it('returns thrown Response instances from the default error handler', async () => {
    const app = createServer();

    app.get('/teapot', () => {
      throw new Response('teapot', { status: 418 });
    });

    const response = await app.handle('/teapot');

    expect(response.status).toBe(418);
    expect(await response.text()).toBe('teapot');
  });

  it('rejects routes whose configured methods normalize to an empty set', () => {
    const app = createServer();

    expect(() =>
      app.add({ path: '/bad', method: '   ', handler: (ctx) => ctx.text('bad') })
    ).toThrow('route method must include at least one non-empty method string');
  });

  it('rejects wildcard route segments unless they are final', () => {
    const app = createServer();

    expect(() => app.get('/a/*/b', (ctx) => ctx.text('bad'))).toThrow(
      'invalid route path: "*" must be the final segment'
    );
  });

  it('rejects prototype-pollution route param names', () => {
    const app = createServer();

    expect(() => app.get('/users/:__proto__', (ctx) => ctx.text('bad'))).toThrow(
      'invalid route param name: __proto__ - reserved for object safety'
    );
  });

  it('treats malformed percent-encoded params as non-matches', async () => {
    const app = createServer();
    app.get('/users/:id', (ctx) => ctx.text(ctx.params.id));

    const response = await app.handle('/users/%E0%A4%A');

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('Not Found');
  });

  it('escapes unsafe characters in json responses', async () => {
    const app = createServer();
    app.get('/json', (ctx) => ctx.json({ html: '<script>alert(1)</script>' }));

    const response = await app.handle('/json');
    const body = await response.text();

    expect(response.headers.get('content-type')).toContain('application/json');
    expect(body).toContain('\\u003Cscript\\u003Ealert(1)\\u003C/script\\u003E');
    expect(body).not.toContain('<script>');
  });

  it('serializes non-JSON top-level values as null', async () => {
    const app = createServer();
    app.get('/json-null', (ctx) => ctx.json(Symbol('x')));

    const response = await app.handle('/json-null');

    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.text()).toBe('null');
  });

  it('serializes JSON stringify failures as null', async () => {
    const app = createServer();
    app.get('/json-circular', (ctx) => {
      const value: { self?: unknown } = {};
      value.self = value;
      return ctx.json(value);
    });

    const response = await app.handle('/json-circular');

    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.text()).toBe('null');
  });

  it('detects websocket upgrade requests', () => {
    const request = createWebSocketRequest('http://localhost/socket');

    expect(isWebSocketRequest(request)).toBe(true);
    expect(
      isWebSocketRequest(
        new Request('http://localhost/socket', {
          headers: {
            connection: 'Upgrade',
            upgrade: 'websocket',
            'sec-websocket-version': '13',
          },
          method: 'GET',
        })
      )
    ).toBe(false);
    expect(
      isWebSocketRequest(
        new Request('http://localhost/socket', {
          headers: {
            connection: 'Upgrade',
            upgrade: 'websocket',
            'sec-websocket-key': 'not-base64',
            'sec-websocket-version': '13',
          },
          method: 'GET',
        })
      )
    ).toBe(false);
    expect(
      isWebSocketRequest(
        new Request('http://localhost/socket', {
          headers: {
            connection: 'Upgrade',
            upgrade: 'websocket',
            'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
            'sec-websocket-version': '12',
          },
          method: 'GET',
        })
      )
    ).toBe(false);
    expect(isWebSocketRequest(new Request('http://localhost/socket'))).toBe(false);
  });

  it('resolves websocket sessions with middleware, params, query, and lifecycle callbacks', async () => {
    const app = createServer();
    const events: Array<{ type: string; value?: unknown }> = [];

    app.use(async (ctx, next) => {
      ctx.state.steps = ['global'];
      return await next();
    });

    app.ws(
      '/rooms/:room',
      (ctx) => ({
        headers: {
          'x-room': ctx.params.room,
        },
        protocols: [' chat ', 'json', 'chat'],
        onOpen(socket, innerCtx) {
          const steps = innerCtx.state.steps as string[];
          steps.push('open');
          events.push({ type: 'open', value: innerCtx.params.room });
          socket.sendJson({
            room: innerCtx.params.room,
            user: innerCtx.query.user,
          });
        },
        onMessage(data, socket, innerCtx) {
          const steps = innerCtx.state.steps as string[];
          steps.push('message');
          events.push({ type: 'message', value: data });
          socket.sendJson({
            echo: data,
            steps,
          });
        },
        onClose(event, _socket, innerCtx) {
          events.push({ type: 'close', value: { code: event.code, room: innerCtx.params.room } });
        },
        onError(_event, _socket, innerCtx) {
          events.push({ type: 'error', value: innerCtx.query.user });
        },
      }),
      [
        async (ctx, next) => {
          const steps = ctx.state.steps as string[];
          steps.push('route');
          return await next();
        },
      ]
    );

    const result = await app.handleWebSocket(
      createWebSocketRequest('http://localhost/rooms/general?user=alice')
    );

    expect(isServerWebSocketSession(result)).toBe(true);
    if (!isServerWebSocketSession(result)) {
      throw new Error('expected a websocket session');
    }

    expect(result.context.isWebSocketRequest).toBe(true);
    expect(result.context.params.room).toBe('general');
    expect(result.context.query.user).toBe('alice');
    expect(result.protocols).toEqual(['chat', 'json']);
    expect(new Headers(result.headers).get('x-room')).toBe('general');

    const socket = new MockServerWebSocketPeer('ws://localhost/rooms/general');
    await result.open(socket);
    await result.message(socket, new MessageEvent('message', { data: '{"text":"hi"}' }));
    const closeEvent = new Event('close') as CloseEvent;
    Object.defineProperty(closeEvent, 'code', { value: 1000 });
    await result.close(socket, closeEvent);
    await result.error(socket, new Event('error'));

    expect(socket.sentMessages).toEqual([
      '{"room":"general","user":"alice"}',
      '{"echo":{"text":"hi"},"steps":["global","route","open","message"]}',
    ]);
    expect(events).toEqual([
      { type: 'open', value: 'general' },
      { type: 'message', value: { text: 'hi' } },
      { type: 'close', value: { code: 1000, room: 'general' } },
      { type: 'error', value: 'alice' },
    ]);
  });

  it('allows middleware to short-circuit websocket requests with a response', async () => {
    const app = createServer();
    app.use((ctx) => ctx.text(`blocked:${ctx.path}`, { status: 401 }));
    app.ws('/secure', {
      onOpen() {
        throw new Error('should not open');
      },
    });

    const result = await app.handleWebSocket(createWebSocketRequest('http://localhost/secure'));

    expect(result instanceof Response).toBe(true);
    if (!(result instanceof Response)) {
      throw new Error('expected a response');
    }
    expect(result.status).toBe(401);
    expect(await result.text()).toBe('blocked:/secure');
  });

  it('returns null for non-websocket requests and unmatched websocket routes', async () => {
    const app = createServer();
    app.ws('/chat', {});

    expect(await app.handleWebSocket('/chat')).toBeNull();
    expect(
      await app.handleWebSocket(createWebSocketRequest('http://localhost/missing'))
    ).toBeNull();
  });

  it('falls back to raw string payloads when websocket messages are not valid json', async () => {
    const app = createServer();
    let received: unknown;

    app.ws('/raw', {
      onMessage(data) {
        received = data;
      },
    });

    const result = await app.handleWebSocket(createWebSocketRequest('http://localhost/raw'));

    expect(isServerWebSocketSession(result)).toBe(true);
    if (!isServerWebSocketSession(result)) {
      throw new Error('expected a websocket session');
    }

    await result.message(
      new MockServerWebSocketPeer(),
      new MessageEvent('message', { data: 'plain-text' })
    );
    expect(received).toBe('plain-text');
  });

  it('drops blank websocket protocols after trimming', async () => {
    const app = createServer();
    app.ws('/protocols', {
      protocols: ['  ', 'chat', 'chat', '\t'],
    });

    const result = await app.handleWebSocket(createWebSocketRequest('http://localhost/protocols'));

    expect(isServerWebSocketSession(result)).toBe(true);
    if (!isServerWebSocketSession(result)) {
      throw new Error('expected a websocket session');
    }

    expect(result.protocols).toEqual(['chat']);
  });

  it('returns an empty protocol list when all websocket protocols are blank', async () => {
    const app = createServer();
    app.ws('/empty-protocols', {
      protocols: ['  ', '\t', '\n'],
    });

    const result = await app.handleWebSocket(
      createWebSocketRequest('http://localhost/empty-protocols')
    );

    expect(isServerWebSocketSession(result)).toBe(true);
    if (!isServerWebSocketSession(result)) {
      throw new Error('expected a websocket session');
    }

    expect(result.protocols).toEqual([]);
  });

  it('rejects websocket session look-alikes that do not expose function handlers', () => {
    expect(isServerWebSocketSession(null)).toBe(false);
    expect(
      isServerWebSocketSession({
        close() {},
        error() {},
        message: 'not-a-function',
        open() {},
      })
    ).toBe(false);
  });
});

// ============================================================================
// Module exports
// ============================================================================

describe('server module exports', () => {
  it('exports all runtime helpers from barrel', async () => {
    const mod = await import('../src/server/index');

    expect(typeof mod.createServer).toBe('function');
    expect(typeof mod.isWebSocketRequest).toBe('function');
    expect(typeof mod.isServerWebSocketSession).toBe('function');
  });

  it('is re-exported from main index', async () => {
    const mod = await import('../src/index');

    expect(typeof mod.createServer).toBe('function');
    expect(typeof mod.isWebSocketRequest).toBe('function');
    expect(typeof mod.isServerWebSocketSession).toBe('function');
  });

  it('is exported from full bundle', async () => {
    const mod = await import('../src/full');

    expect(typeof mod.createServer).toBe('function');
    expect(typeof mod.isWebSocketRequest).toBe('function');
    expect(typeof mod.isServerWebSocketSession).toBe('function');
  });
});
