import { describe, expect, it } from 'bun:test';
import { createFileRoutes } from '../src/router/index';
import { createServer, mountFileRoutes, type ServerContext } from '../src/server/index';
import { DEFAULT_SERVER_LIMITS } from '../src/server/create-server';
import { createNodeHandler, type NodeIncomingMessage } from '../src/ssr/index';

const MiB = 1024 * 1024;

const postJson = (size: number): Request =>
  new Request('http://localhost/json', {
    body: JSON.stringify({ pad: 'x'.repeat(size) }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });

/** A chunked body without `content-length`, so only the streaming check applies. */
const chunkedRequest = (url: string, contentType: string, bytes: number): Request => {
  const chunk = new Uint8Array(64 * 1024).fill(0x61);
  let sent = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= bytes) {
        controller.close();
        return;
      }
      const size = Math.min(chunk.byteLength, bytes - sent);
      controller.enqueue(chunk.subarray(0, size));
      sent += size;
    },
  });
  return new Request(url, {
    body,
    headers: { 'content-type': contentType },
    method: 'POST',
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
};

describe('createServer() default body limits (#255)', () => {
  it('ships conservative defaults', () => {
    expect(DEFAULT_SERVER_LIMITS).toEqual({
      form: MiB,
      json: MiB,
      multipart: 10 * MiB,
      raw: MiB,
      text: MiB,
    });
    expect(Object.isFrozen(DEFAULT_SERVER_LIMITS)).toBe(true);
  });

  it('rejects a JSON body over 1 MiB with 413 by default', async () => {
    const app = createServer();
    app.post('/json', async (ctx) => ctx.json(await ctx.body()));

    const small = await app.handle(postJson(1024));
    expect(small.status).toBe(200);

    const large = await app.handle(postJson(MiB + 1));
    expect(large.status).toBe(413);
    expect(await large.text()).toBe('Request JSON body exceeds the configured limit.');
  });

  it('enforces the default while streaming a body without content-length', async () => {
    const app = createServer();
    app.post('/text', async (ctx) => ctx.text(String(((await ctx.body()) as string).length)));

    const response = await app.handle(
      chunkedRequest('http://localhost/text', 'text/plain', 2 * MiB)
    );
    expect(response.status).toBe(413);
  });

  it('applies the default raw limit to unrecognised content types', async () => {
    const app = createServer();
    app.post('/raw', async (ctx) => {
      await ctx.body();
      return ctx.text('ok');
    });

    const response = await app.handle(
      chunkedRequest('http://localhost/raw', 'application/octet-stream', MiB + 1)
    );
    expect(response.status).toBe(413);
  });

  it('merges overrides with the defaults and lifts a limit with Infinity', async () => {
    const app = createServer({ limits: { json: Infinity, text: 4 } });
    app.post('/json', async (ctx) => ctx.json({ ok: Boolean(await ctx.body()) }));
    app.post('/text', async (ctx) => ctx.text(String(await ctx.body())));
    app.post('/raw', async (ctx) => {
      await ctx.body();
      return ctx.text('ok');
    });

    expect((await app.handle(postJson(2 * MiB))).status).toBe(200);
    expect(
      (
        await app.handle({
          body: 'too long',
          headers: { 'content-type': 'text/plain' },
          method: 'POST',
          url: '/text',
        })
      ).status
    ).toBe(413);
    // Untouched content types keep their default.
    expect(
      (
        await app.handle(
          chunkedRequest('http://localhost/raw', 'application/octet-stream', 2 * MiB)
        )
      ).status
    ).toBe(413);
  });
});

describe('createServer() body reading (#255)', () => {
  it('reads the body once without cloning the request', async () => {
    const app = createServer();
    app.post('/json', async (ctx) => ctx.json(await ctx.body()));

    const request = postJson(16);
    let clones = 0;
    const originalClone = request.clone.bind(request);
    request.clone = () => {
      clones++;
      return originalClone();
    };

    const response = await app.handle(request);
    expect(response.status).toBe(200);
    expect(clones).toBe(0);
  });

  it('keeps ctx.request readable after ctx.body() consumed the body', async () => {
    const app = createServer();
    app.post('/echo', async (ctx) => {
      const parsed = (await ctx.body()) as { a: number };
      const again = await ctx.request.json();
      return ctx.json({ parsed, again, method: ctx.request.method });
    });

    const response = await app.handle({
      body: JSON.stringify({ a: 1 }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
      url: '/echo',
    });
    expect(await response.json()).toEqual({ parsed: { a: 1 }, again: { a: 1 }, method: 'POST' });
  });

  it('returns the same ctx.body() result on repeated calls', async () => {
    const app = createServer();
    app.post('/twice', async (ctx) => {
      const first = await ctx.body();
      const second = await ctx.body();
      return ctx.json({ same: first === second });
    });

    const response = await app.handle({
      body: JSON.stringify({ a: 1 }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
      url: '/twice',
    });
    expect(await response.json()).toEqual({ same: true });
  });

  it('still parses multipart bodies', async () => {
    const app = createServer();
    app.post('/upload', async (ctx) => {
      const form = (await ctx.body()) as Map<string, FormDataEntryValue>;
      return ctx.text(String(form.get('name')));
    });

    const form = new FormData();
    form.set('name', 'bQuery');
    const response = await app.handle(
      new Request('http://localhost/upload', { body: form, method: 'POST' })
    );
    expect(await response.text()).toBe('bQuery');
  });

  it('allows a middleware to replace ctx.request', async () => {
    const app = createServer();
    app.use(async (ctx, next) => {
      ctx.request = new Request(ctx.request.url, { headers: { 'x-replaced': '1' } });
      return next();
    });
    app.get('/', (ctx) => ctx.text(ctx.request.headers.get('x-replaced') ?? 'no'));

    expect(await (await app.handle('/')).text()).toBe('1');
  });
});

describe('Node adapter body streaming (#255)', () => {
  const createRes = () => {
    const res = {
      body: '',
      statusCode: 0,
      headers: {} as Record<string, unknown>,
      setHeader(name: string, value: string | number | readonly string[]) {
        res.headers[name.toLowerCase()] = value;
      },
      write(chunk: string | Uint8Array) {
        res.body += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
        return true;
      },
      end(chunk?: string | Uint8Array) {
        if (chunk) res.body += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
      },
    };
    return res;
  };

  const createReq = (headers: Record<string, string> = {}) => {
    const listeners: Record<string, Array<(arg?: unknown) => void>> = {};
    const req: NodeIncomingMessage & {
      emit(event: string, arg?: unknown): void;
      paused: number;
      resumed: number;
      destroyed: boolean;
    } = {
      url: '/upload',
      method: 'POST',
      headers: { host: 'example.com', ...headers },
      paused: 0,
      resumed: 0,
      destroyed: false,
      destroy() {
        req.destroyed = true;
      },
      on(event: string, listener: (arg?: never) => void) {
        (listeners[event] ??= []).push(listener as (arg?: unknown) => void);
      },
      pause() {
        req.paused++;
      },
      resume() {
        req.resumed++;
      },
      emit(event: string, arg?: unknown) {
        for (const listener of listeners[event] ?? []) listener(arg);
      },
    } as never;
    return { req, listeners };
  };

  it('does not read the body for a handler that never touches it', async () => {
    const { req, listeners } = createReq();
    const res = createRes();
    await createNodeHandler(() => new Response('ok'), { maxBodyBytes: 10 })(req, res);

    expect(res.statusCode).toBe(200);
    expect(listeners.data).toBeUndefined();
  });

  it('streams the body on demand and applies backpressure', async () => {
    const { req, listeners } = createReq();
    const res = createRes();
    const pending = createNodeHandler(async (request) => new Response(await request.text()))(
      req,
      res
    );

    for (let i = 0; i < 50 && !listeners.data; i++) await Promise.resolve();
    req.emit('data', 'hello ');
    req.emit('data', new TextEncoder().encode('world'));
    req.emit('end');
    await pending;

    expect(res.body).toBe('hello world');
    expect(req.paused).toBeGreaterThan(0);
  });

  it('answers 413 when a streamed body outgrows maxBodyBytes', async () => {
    const { req, listeners } = createReq();
    const res = createRes();
    const pending = createNodeHandler(async (request) => new Response(await request.text()), {
      maxBodyBytes: 4,
    })(req, res);

    for (let i = 0; i < 50 && !listeners.data; i++) await Promise.resolve();
    req.emit('data', 'too long');
    await pending;

    expect(res.statusCode).toBe(413);
    expect(res.body).toBe('Request body exceeds 4 bytes.');
    // Delivered without destroying the socket; the connection closes after it.
    expect(req.destroyed).toBe(false);
    expect(res.headers.connection).toBe('close');
  });

  it('answers 413 for a declared Content-Length over the limit without destroying the socket', async () => {
    const { req } = createReq({ 'content-length': '100' });
    const res = createRes();
    let handled = false;
    await createNodeHandler(
      () => {
        handled = true;
        return new Response('ok');
      },
      { maxBodyBytes: 10 }
    )(req, res);

    expect(handled).toBe(false);
    expect(res.statusCode).toBe(413);
    expect(req.destroyed).toBe(false);
    expect(res.headers.connection).toBe('close');
  });

  it('rejects the body read when the client aborted before the handler read it', async () => {
    const { req } = createReq();
    const res = createRes();
    let readError: unknown;
    const pending = createNodeHandler(async (request) => {
      // e.g. an auth middleware awaiting the database while the client leaves
      (req as { complete?: boolean }).complete = false;
      req.emit('close');
      try {
        await request.text();
      } catch (error) {
        readError = error;
      }
      return new Response('done');
    })(req, res);

    await Promise.race([
      pending,
      new Promise((_, reject) => setTimeout(() => reject(new Error('body read hung')), 1000)),
    ]);
    expect((readError as Error)?.name).toBe('AbortError');
  });

  it('rejects the body read when the request errored before the handler read it', async () => {
    const { req } = createReq();
    const res = createRes();
    let readError: unknown;
    await createNodeHandler(async (request) => {
      req.emit('error', new Error('socket hang up'));
      try {
        await request.text();
      } catch (error) {
        readError = error;
      }
      return new Response('done');
    })(req, res);

    expect(String(readError)).toContain('socket hang up');
  });

  it('stops reading after a route-level 413 instead of draining the rest', async () => {
    const app = createServer({ limits: { text: 4 } });
    app.post('/upload', async (ctx) => ctx.text(String(await ctx.body())));
    const { req, listeners } = createReq({ 'content-type': 'text/plain' });
    const res = createRes();
    const pending = createNodeHandler((request) => app.handle(request), { maxBodyBytes: 1024 })(
      req,
      res
    );

    for (let i = 0; i < 50 && !listeners.data; i++) await Promise.resolve();
    req.emit('data', 'way too long');
    await pending;

    expect(res.statusCode).toBe(413);
    expect(req.resumed).toBe(0);
    expect(res.headers.connection).toBe('close');
  });
});

describe('listen({ runtime: "node" }) body limits (#255)', () => {
  it('rejects oversized bodies and serves small ones', async () => {
    const app = createServer({ limits: { json: 64 } });
    app.post('/json', async (ctx) => ctx.json(await ctx.body()));
    app.post('/ignore', (ctx) => ctx.text('ignored'));

    const handle = await app.listen({ hostname: '127.0.0.1', port: 0, runtime: 'node' });
    try {
      const ok = await fetch(`${handle.url}/json`, {
        body: JSON.stringify({ a: 1 }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      expect(ok.status).toBe(200);
      expect(await ok.json()).toEqual({ a: 1 });

      const tooLarge = await fetch(`${handle.url}/json`, {
        body: JSON.stringify({ pad: 'x'.repeat(256) }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      expect(tooLarge.status).toBe(413);

      // A route that never reads its body answers normally.
      const ignored = await fetch(`${handle.url}/ignore`, {
        body: 'x'.repeat(1024),
        method: 'POST',
      });
      expect(await ignored.text()).toBe('ignored');
    } finally {
      await handle.close();
    }
  });

  it('answers 413, not a reset, when a chunked body outgrows the largest limit', async () => {
    // multipart (10 MiB by default) is the largest limit, so the transport cap
    // and the route limit coincide.
    const app = createServer();
    app.post('/upload', async (ctx) => {
      await ctx.body();
      return ctx.text('stored');
    });

    const handle = await app.listen({ hostname: '127.0.0.1', port: 0, runtime: 'node' });
    try {
      const response = await fetch(
        chunkedRequest(
          `${handle.url}/upload`,
          'multipart/form-data; boundary=x',
          DEFAULT_SERVER_LIMITS.multipart + MiB
        )
      );
      expect(response.status).toBe(413);
    } finally {
      await handle.close();
    }
  });

  const tiny = { form: 64, json: 64, multipart: 64, raw: 64, text: 64 };

  it('answers 413, not 500, when a route reads ctx.request past the transport cap', async () => {
    const app = createServer({ limits: tiny });
    app.post('/direct', async (ctx) =>
      ctx.text(String((await ctx.request.arrayBuffer()).byteLength))
    );

    const handle = await app.listen({ hostname: '127.0.0.1', port: 0, runtime: 'node' });
    try {
      // Chunked, so the declared-length check cannot reject it up front.
      const response = await fetch(
        chunkedRequest(`${handle.url}/direct`, 'application/octet-stream', 1024)
      );
      expect(response.status).toBe(413);
      expect(response.headers.get('connection')).toBe('close');
    } finally {
      await handle.close();
    }
  });

  it('treats negative limits as unbounded at the transport level too', async () => {
    const unbounded = { form: -1, json: -1, multipart: -1, raw: -1, text: -1 };
    const app = createServer({ limits: unbounded });
    app.post('/text', async (ctx) => ctx.text(String(((await ctx.body()) as string).length)));

    const handle = await app.listen({ hostname: '127.0.0.1', port: 0, runtime: 'node' });
    try {
      const response = await fetch(`${handle.url}/text`, {
        body: 'x'.repeat(4096),
        headers: { 'content-type': 'text/plain' },
        method: 'POST',
      });
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('4096');
    } finally {
      await handle.close();
    }
  });
});

describe('file-route handlers and the consumed body (#255)', () => {
  it('give load/action a request that is still readable after ctx.body()', async () => {
    const app = createServer();
    const { entries } = createFileRoutes({
      './routes/echo/+page.ts': {
        action: async ({ request, ctx }) => {
          const parsed = await (ctx as ServerContext).body();
          return { parsed, raw: await request.text() };
        },
      },
    });
    mountFileRoutes(app, entries);

    const response = await app.handle(
      new Request('http://localhost/echo', {
        body: JSON.stringify({ a: 1 }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
    );
    expect(await response.json()).toEqual({ parsed: { a: 1 }, raw: '{"a":1}' });
  });
});
