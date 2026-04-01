import { describe, expect, it } from 'bun:test';
import {
  createHttp,
  http,
  HttpError,
  useFetch,
  usePolling,
  usePaginatedFetch,
  useInfiniteFetch,
} from '../src/reactive/signal';

const asMockFetch = (
  handler: (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>
): typeof fetch =>
  Object.assign(handler, {
    preconnect: (_url: string | URL, _options?: { dns?: boolean; tcp?: boolean; tls?: boolean }) =>
      undefined,
  }) as typeof fetch;

// ---------------------------------------------------------------------------
// Imperative HTTP client: createHttp / http
// ---------------------------------------------------------------------------

describe('createHttp', () => {
  it('makes a basic GET request', async () => {
    const api = createHttp({
      fetcher: asMockFetch(async () =>
        new Response(JSON.stringify({ id: 1, name: 'Ada' }), { status: 200 })
      ),
    });

    const res = await api.get<{ id: number; name: string }>('/users/1');
    expect(res.data).toEqual({ id: 1, name: 'Ada' });
    expect(res.status).toBe(200);
    expect(res.headers).toBeInstanceOf(Headers);
  });

  it('makes a POST request with JSON body', async () => {
    let capturedBody = '';
    let capturedContentType = '';
    let capturedMethod = '';

    const api = createHttp({
      fetcher: asMockFetch(async (_input, init) => {
        capturedBody = String(init?.body);
        capturedContentType = new Headers(init?.headers).get('content-type') ?? '';
        capturedMethod = init?.method ?? '';
        return new Response(JSON.stringify({ saved: true }), { status: 201 });
      }),
    });

    const res = await api.post<{ saved: boolean }>('/users', { name: 'Ada' });
    expect(res.data).toEqual({ saved: true });
    expect(res.status).toBe(201);
    expect(capturedMethod).toBe('POST');
    expect(capturedBody).toBe(JSON.stringify({ name: 'Ada' }));
    expect(capturedContentType).toBe('application/json');
  });

  it('supports PUT, PATCH, DELETE, HEAD, OPTIONS methods', async () => {
    const methods: string[] = [];

    const api = createHttp({
      fetcher: asMockFetch(async (_input, init) => {
        methods.push(init?.method ?? '');
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    });

    await api.put('/resource', { data: 1 });
    await api.patch('/resource', { data: 2 });
    await api.delete('/resource');
    await api.head('/resource');
    await api.options('/resource');

    expect(methods).toEqual(['PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
  });

  it('merges base URL from defaults', async () => {
    let capturedUrl = '';

    const api = createHttp({
      baseUrl: 'https://api.example.com',
      fetcher: asMockFetch(async (input) => {
        capturedUrl = String(input);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    });

    await api.get('/users');
    expect(capturedUrl).toBe('https://api.example.com/users');
  });

  it('appends query parameters', async () => {
    let capturedUrl = '';

    const api = createHttp({
      baseUrl: 'https://api.example.com',
      fetcher: asMockFetch(async (input) => {
        capturedUrl = String(input);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    });

    await api.get('/users', { query: { page: 2, role: 'admin' } });
    expect(capturedUrl).toContain('page=2');
    expect(capturedUrl).toContain('role=admin');
  });

  it('merges default and per-request headers', async () => {
    let capturedDefault = '';
    let capturedCustom = '';

    const api = createHttp({
      headers: { 'x-default': '1' },
      fetcher: asMockFetch(async (_input, init) => {
        const headers = new Headers(init?.headers);
        capturedDefault = headers.get('x-default') ?? '';
        capturedCustom = headers.get('x-custom') ?? '';
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    });

    await api.get('/test', { headers: { 'x-custom': '2' } });
    expect(capturedDefault).toBe('1');
    expect(capturedCustom).toBe('2');
  });

  it('merges default and per-request query parameters', async () => {
    let capturedUrl = '';

    const api = createHttp({
      query: { token: 'abc' },
      fetcher: asMockFetch(async (input) => {
        capturedUrl = String(input);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    });

    await api.get('/data', { query: { page: 1 } });
    expect(capturedUrl).toContain('token=abc');
    expect(capturedUrl).toContain('page=1');
  });

  it('parses response as text when parseAs is text', async () => {
    const api = createHttp({
      parseAs: 'text',
      fetcher: asMockFetch(async () => new Response('plain text', { status: 200 })),
    });

    const res = await api.get<string>('/text');
    expect(res.data).toBe('plain text');
  });

  it('returns a full HttpResponse object', async () => {
    const api = createHttp({
      fetcher: asMockFetch(async () =>
        new Response(JSON.stringify({ id: 1 }), {
          status: 200,
          statusText: 'OK',
          headers: { 'x-custom': 'value' },
        })
      ),
    });

    const res = await api.get<{ id: number }>('/resource');
    expect(res.data).toEqual({ id: 1 });
    expect(res.status).toBe(200);
    expect(res.statusText).toBe('OK');
    expect(res.headers.get('x-custom')).toBe('value');
    expect(res.config).toBeDefined();
  });

  it('throws PARSE errors for invalid JSON without retrying as a network failure', async () => {
    let callCount = 0;

    const api = createHttp({
      retry: 2,
      fetcher: asMockFetch(async () => {
        callCount++;
        return new Response('not json', { status: 200, statusText: 'OK' });
      }),
    });

    await expect(api.get('/broken-json')).rejects.toMatchObject({
      name: 'HttpError',
      code: 'PARSE',
    });
    expect(callCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Interceptors
// ---------------------------------------------------------------------------

describe('interceptors', () => {
  it('runs request interceptors before each request', async () => {
    const api = createHttp({
      fetcher: asMockFetch(async (_input, init) => {
        const headers = new Headers(init?.headers);
        return new Response(JSON.stringify({ token: headers.get('x-injected') }), { status: 200 });
      }),
    });

    api.interceptors.request.use((config) => {
      return {
        ...config,
        headers: { ...Object.fromEntries(new Headers(config.headers)), 'x-injected': 'intercepted' },
      };
    });

    const res = await api.get<{ token: string }>('/test');
    expect(res.data.token).toBe('intercepted');
  });

  it('runs response interceptors after each request', async () => {
    const api = createHttp({
      fetcher: asMockFetch(async () =>
        new Response(JSON.stringify({ raw: true }), { status: 200 })
      ),
    });

    api.interceptors.response.use((response) => {
      const data = response.data as { raw: boolean };
      return { ...response, data: { ...data, modified: true } };
    });

    const res = await api.get<{ raw: boolean; modified: boolean }>('/test');
    expect(res.data.raw).toBe(true);
    expect(res.data.modified).toBe(true);
  });

  it('ejects interceptors by id', async () => {
    const calls: string[] = [];

    const api = createHttp({
      fetcher: asMockFetch(async () =>
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      ),
    });

    const id = api.interceptors.request.use((config) => {
      calls.push('interceptor');
      return config;
    });

    await api.get('/test');
    expect(calls).toEqual(['interceptor']);

    api.interceptors.request.eject(id);
    await api.get('/test');
    expect(calls).toEqual(['interceptor']);
  });

  it('clears all interceptors', async () => {
    const calls: string[] = [];

    const api = createHttp({
      fetcher: asMockFetch(async () =>
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      ),
    });

    api.interceptors.request.use((config) => {
      calls.push('a');
      return config;
    });
    api.interceptors.request.use((config) => {
      calls.push('b');
      return config;
    });

    await api.get('/test');
    expect(calls).toEqual(['a', 'b']);

    api.interceptors.request.clear();
    await api.get('/test');
    expect(calls).toEqual(['a', 'b']);
  });

  it('runs multiple interceptors in order', async () => {
    const order: number[] = [];

    const api = createHttp({
      fetcher: asMockFetch(async () =>
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      ),
    });

    api.interceptors.request.use((config) => {
      order.push(1);
      return config;
    });
    api.interceptors.request.use((config) => {
      order.push(2);
      return config;
    });
    api.interceptors.request.use((config) => {
      order.push(3);
      return config;
    });

    await api.get('/test');
    expect(order).toEqual([1, 2, 3]);
  });

  it('handles response error interceptors for failed requests', async () => {
    let interceptedError: unknown = null;

    const api = createHttp({
      fetcher: asMockFetch(async () =>
        new Response(JSON.stringify({ error: 'not found' }), { status: 404 })
      ),
    });

    api.interceptors.response.use(undefined, (error) => {
      interceptedError = error;
      throw error;
    });

    await expect(api.get('/missing')).rejects.toThrow();
    expect(interceptedError).toBeTruthy();
  });

  it('falls back to the original HttpError when an error interceptor returns undefined', async () => {
    const api = createHttp({
      fetcher: asMockFetch(async () => new Response('missing', { status: 404, statusText: 'Not Found' })),
    });

    api.interceptors.response.use(undefined, () => undefined);

    await expect(api.get('/missing')).rejects.toBeInstanceOf(HttpError);
  });
});

// ---------------------------------------------------------------------------
// HttpError
// ---------------------------------------------------------------------------

describe('HttpError', () => {
  it('is thrown for non-2xx responses by default', async () => {
    const api = createHttp({
      fetcher: asMockFetch(async () =>
        new Response(JSON.stringify({ error: 'not found' }), { status: 404, statusText: 'Not Found' })
      ),
    });

    try {
      await api.get('/missing');
      expect(true).toBe(false); // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      const httpErr = err as HttpError;
      expect(httpErr.code).toBe('ERR_BAD_RESPONSE');
      expect(httpErr.response?.status).toBe(404);
      expect(httpErr.config).toBeDefined();
    }
  });

  it('respects custom validateStatus', async () => {
    const api = createHttp({
      validateStatus: (status) => status < 500,
      fetcher: asMockFetch(async () =>
        new Response(JSON.stringify({ error: 'not found' }), { status: 404 })
      ),
    });

    const res = await api.get('/missing');
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Timeout
// ---------------------------------------------------------------------------

describe('http timeout', () => {
  it('throws a TIMEOUT error when request exceeds timeout', async () => {
    const api = createHttp({
      timeout: 50,
      fetcher: asMockFetch(async (_input, init) => {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, 500);
          init?.signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(init.signal!.reason ?? new DOMException('aborted', 'AbortError'));
          }, { once: true });
        });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    });

    try {
      await api.get('/slow');
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).code).toBe('TIMEOUT');
    }
  });

  it('succeeds when request completes within timeout', async () => {
    const api = createHttp({
      timeout: 500,
      fetcher: asMockFetch(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    });

    const res = await api.get<{ ok: boolean }>('/fast');
    expect(res.data.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Abort / Cancellation
// ---------------------------------------------------------------------------

describe('http abort', () => {
  it('throws an ABORT error when signal is aborted', async () => {
    const controller = new AbortController();

    const api = createHttp({
      fetcher: asMockFetch(async (_input, init) => {
        // Simulate checking signal
        if (init?.signal?.aborted) {
          throw new DOMException('The operation was aborted.', 'AbortError');
        }
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => resolve(undefined), 200);
          init?.signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    });

    setTimeout(() => controller.abort(), 20);

    try {
      await api.get('/slow', { signal: controller.signal });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).code).toBe('ABORT');
    }
  });
});

// ---------------------------------------------------------------------------
// Retry
// ---------------------------------------------------------------------------

describe('http retry', () => {
  it('retries on failure and eventually succeeds', async () => {
    let attempts = 0;

    const api = createHttp({
      retry: { count: 3, delay: 10 },
      fetcher: asMockFetch(async () => {
        attempts++;
        if (attempts < 3) {
          return new Response('error', { status: 500 });
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    });

    const res = await api.get<{ ok: boolean }>('/flaky');
    expect(res.data.ok).toBe(true);
    expect(attempts).toBe(3);
  });

  it('retries with a simple count', async () => {
    let attempts = 0;

    const api = createHttp({
      retry: 2,
      fetcher: asMockFetch(async () => {
        attempts++;
        if (attempts < 3) {
          return new Response('error', { status: 500 });
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    });

    const res = await api.get<{ ok: boolean }>('/flaky');
    expect(res.data.ok).toBe(true);
    expect(attempts).toBe(3);
  });

  it('throws after exhausting all retry attempts', async () => {
    let attempts = 0;

    const api = createHttp({
      retry: { count: 2, delay: 10 },
      fetcher: asMockFetch(async () => {
        attempts++;
        return new Response('error', { status: 500 });
      }),
    });

    try {
      await api.get('/always-fails');
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
    }
    expect(attempts).toBe(3); // 1 initial + 2 retries
  });

  it('uses custom retryOn predicate', async () => {
    let attempts = 0;

    const api = createHttp({
      retry: {
        count: 5,
        delay: 10,
        retryOn: (error) => {
          return error.response?.status === 429;
        },
      },
      fetcher: asMockFetch(async () => {
        attempts++;
        if (attempts === 1) return new Response('', { status: 429 });
        if (attempts === 2) return new Response('', { status: 404 });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    });

    try {
      await api.get('/rate-limited');
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).response?.status).toBe(404);
    }
    expect(attempts).toBe(2);
  });

  it('uses custom delay function', async () => {
    const delays: number[] = [];
    let attempts = 0;

    const api = createHttp({
      retry: {
        count: 2,
        delay: (attempt) => {
          delays.push(attempt);
          return 5;
        },
      },
      fetcher: asMockFetch(async () => {
        attempts++;
        if (attempts < 3) {
          return new Response('error', { status: 500 });
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    });

    await api.get('/flaky');
    expect(delays).toEqual([0, 1]);
    expect(attempts).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Default http instance
// ---------------------------------------------------------------------------

describe('http default instance', () => {
  it('is a pre-created HttpClient', () => {
    expect(http).toBeDefined();
    expect(http.get).toBeInstanceOf(Function);
    expect(http.post).toBeInstanceOf(Function);
    expect(http.interceptors).toBeDefined();
    expect(http.interceptors.request.use).toBeInstanceOf(Function);
  });
});

// ---------------------------------------------------------------------------
// useFetch enhancements: timeout, retry, abort, validateStatus
// ---------------------------------------------------------------------------

describe('useFetch timeout', () => {
  it('times out and sets an error', async () => {
    const state = useFetch<{ ok: boolean }>('/api/slow', {
      immediate: false,
      timeout: 50,
      fetcher: asMockFetch(async (_input, init) => {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 500);
          init?.signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(init.signal!.reason ?? new DOMException('aborted', 'AbortError'));
          });
        });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    });

    await state.execute();

    expect(state.status.value).toBe('error');
    expect(state.error.value?.message).toContain('timeout');
  });

  it('does not retry timeout aborts and reports TIMEOUT consistently', async () => {
    let attempts = 0;

    const state = useFetch<{ ok: boolean }>('/api/slow', {
      immediate: false,
      timeout: 30,
      retry: { count: 2, delay: 10 },
      fetcher: asMockFetch(async (_input, init) => {
        attempts++;
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 500);
          init?.signal?.addEventListener(
            'abort',
            () => {
              clearTimeout(timer);
              reject(init.signal!.reason ?? new DOMException('aborted', 'AbortError'));
            },
            { once: true }
          );
        });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    });

    await state.execute();

    expect(attempts).toBe(1);
    expect(state.status.value).toBe('error');
    expect(state.error.value?.message).toContain('timeout');
    expect((state.error.value as (Error & { code?: string }) | null)?.code).toBe('TIMEOUT');
  });
});

describe('useFetch retry', () => {
  it('retries and succeeds on subsequent attempts', async () => {
    let attempts = 0;

    const state = useFetch<{ ok: boolean }>('/api/flaky', {
      immediate: false,
      retry: { count: 2, delay: 10 },
      fetcher: asMockFetch(async () => {
        attempts++;
        if (attempts < 3) {
          return new Response('error', { status: 500 });
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    });

    const result = await state.execute();
    expect(result?.ok).toBe(true);
    expect(state.status.value).toBe('success');
    expect(attempts).toBe(3);
  });

  it('stores error after exhausting retries', async () => {
    let attempts = 0;

    const state = useFetch<{ ok: boolean }>('/api/always-fails', {
      immediate: false,
      retry: { count: 1, delay: 10 },
      fetcher: asMockFetch(async () => {
        attempts++;
        return new Response('error', { status: 500 });
      }),
    });

    await state.execute();
    expect(state.status.value).toBe('error');
    expect(attempts).toBe(2);
  });

  it('does not retry ReadableStream request bodies', async () => {
    let attempts = 0;
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('payload'));
        controller.close();
      },
    });

    const state = useFetch('/api/stream', {
      immediate: false,
      method: 'POST',
      body,
      retry: { count: 1, delay: 10 },
      fetcher: asMockFetch(async () => {
        attempts++;
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    });

    await state.execute();

    expect(attempts).toBe(0);
    expect(state.status.value).toBe('error');
    expect(state.error.value?.message).toContain('ReadableStream');
  });
});

describe('useFetch abort', () => {
  it('aborts an in-flight request', async () => {
    const state = useFetch<{ ok: boolean }>('/api/slow', {
      immediate: false,
      fetcher: asMockFetch(async (_input, init) => {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 2000);
          init?.signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('aborted', 'AbortError'));
          });
        });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    });

    const promise = state.execute();
    // Allow the execute to start
    await new Promise((resolve) => setTimeout(resolve, 10));
    state.abort();
    await promise;

    expect(state.status.value).toBe('error');
    expect(state.error.value?.message).toContain('aborted');
  });

  it('aborts via external signal', async () => {
    const controller = new AbortController();

    const state = useFetch<{ ok: boolean }>('/api/slow', {
      immediate: false,
      signal: controller.signal,
      fetcher: asMockFetch(async (_input, init) => {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 2000);
          init?.signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('aborted', 'AbortError'));
          });
        });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    });

    const promise = state.execute();
    await new Promise((resolve) => setTimeout(resolve, 10));
    controller.abort();
    await promise;

    expect(state.status.value).toBe('error');
  });
});

describe('useFetch validateStatus', () => {
  it('accepts 404 when validateStatus allows it', async () => {
    const state = useFetch<{ error: string }>('/api/missing', {
      immediate: false,
      validateStatus: (status) => status < 500,
      fetcher: asMockFetch(async () =>
        new Response(JSON.stringify({ error: 'not found' }), { status: 404 })
      ),
    });

    const result = await state.execute();
    expect(result?.error).toBe('not found');
    expect(state.status.value).toBe('success');
  });

  it('rejects 500 when validateStatus is strict', async () => {
    const state = useFetch<unknown>('/api/error', {
      immediate: false,
      validateStatus: (status) => status === 200,
      fetcher: asMockFetch(async () =>
        new Response(JSON.stringify({ error: 'server error' }), { status: 500 })
      ),
    });

    await state.execute();
    expect(state.status.value).toBe('error');
  });
});

// ---------------------------------------------------------------------------
// usePolling
// ---------------------------------------------------------------------------

describe('usePolling', () => {
  it('fetches data immediately and then on interval', async () => {
    let fetchCount = 0;

    const state = usePolling<{ count: number }>('/api/data', {
      interval: 50,
      immediate: true,
      pauseOnHidden: false,
      pauseOnOffline: false,
      fetcher: asMockFetch(async () => {
        fetchCount++;
        return new Response(JSON.stringify({ count: fetchCount }), { status: 200 });
      }),
    });

    // Wait for initial + at least 2 polls
    await new Promise((resolve) => setTimeout(resolve, 180));

    expect(fetchCount).toBeGreaterThanOrEqual(3);
    expect(state.data.value?.count).toBeGreaterThanOrEqual(1);

    state.dispose();
  });

  it('pauses and resumes polling', async () => {
    let fetchCount = 0;

    const state = usePolling<{ ok: boolean }>('/api/data', {
      interval: 30,
      immediate: false,
      pauseOnHidden: false,
      pauseOnOffline: false,
      fetcher: asMockFetch(async () => {
        fetchCount++;
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    });

    // Let polling run
    await new Promise((resolve) => setTimeout(resolve, 100));
    const countBeforePause = fetchCount;

    state.pause();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(fetchCount).toBe(countBeforePause);

    state.resume();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(fetchCount).toBeGreaterThan(countBeforePause);
    state.dispose();
  });

  it('exposes isActive computed', async () => {
    const state = usePolling<{ ok: boolean }>('/api/data', {
      interval: 50,
      immediate: false,
      pauseOnHidden: false,
      pauseOnOffline: false,
      fetcher: asMockFetch(async () =>
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      ),
    });

    expect(state.isActive.value).toBe(true);

    state.pause();
    expect(state.isActive.value).toBe(false);

    state.resume();
    expect(state.isActive.value).toBe(true);

    state.dispose();
  });

  it('supports enabled option as false to not start', async () => {
    let fetchCount = 0;

    const state = usePolling<{ ok: boolean }>('/api/data', {
      interval: 30,
      enabled: false,
      immediate: false,
      pauseOnHidden: false,
      pauseOnOffline: false,
      fetcher: asMockFetch(async () => {
        fetchCount++;
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(fetchCount).toBe(0);
    expect(state.isActive.value).toBe(false);

    state.dispose();
  });

  it('does not perform the initial fetch when immediate is true but enabled is false', async () => {
    let fetchCount = 0;

    const state = usePolling<{ ok: boolean }>('/api/data', {
      interval: 30,
      enabled: false,
      immediate: true,
      pauseOnHidden: false,
      pauseOnOffline: false,
      fetcher: asMockFetch(async () => {
        fetchCount++;
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(fetchCount).toBe(0);
    expect(state.status.value).toBe('idle');
    state.dispose();
  });

  it('cleans up on dispose', async () => {
    let fetchCount = 0;

    const state = usePolling<{ ok: boolean }>('/api/data', {
      interval: 30,
      immediate: false,
      pauseOnHidden: false,
      pauseOnOffline: false,
      fetcher: asMockFetch(async () => {
        fetchCount++;
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    const count = fetchCount;

    state.dispose();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(fetchCount).toBe(count);
  });

  it('does not start polling while the document is initially hidden', async () => {
    const originalHiddenDescriptor = Object.getOwnPropertyDescriptor(document, 'hidden');
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });

    let fetchCount = 0;

    try {
      const state = usePolling<{ ok: boolean }>('/api/data', {
        interval: 30,
        immediate: false,
        pauseOnHidden: true,
        pauseOnOffline: false,
        fetcher: asMockFetch(async () => {
          fetchCount++;
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }),
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(fetchCount).toBe(0);

      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(fetchCount).toBeGreaterThan(0);
      state.dispose();
    } finally {
      if (originalHiddenDescriptor) {
        Object.defineProperty(document, 'hidden', originalHiddenDescriptor);
      } else {
        Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      }
    }
  });

  it('throws for non-positive or non-finite polling intervals', () => {
    expect(() =>
      usePolling('/api/data', {
        interval: 0,
        fetcher: asMockFetch(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
      })
    ).toThrow('Polling interval must be a finite number of at least 1');

    expect(() =>
      usePolling('/api/data', {
        interval: Number.POSITIVE_INFINITY,
        fetcher: asMockFetch(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
      })
    ).toThrow('Polling interval must be a finite number of at least 1');
  });
});

// ---------------------------------------------------------------------------
// usePaginatedFetch
// ---------------------------------------------------------------------------

describe('usePaginatedFetch', () => {
  it('fetches the initial page', async () => {
    const state = usePaginatedFetch<{ items: string[]; page: number }>(
      (page) => `/api/items?page=${page}`,
      {
        immediate: false,
        fetcher: asMockFetch(async (input) => {
          const url = new URL(String(input), 'http://localhost');
          const page = Number(url.searchParams.get('page'));
          return new Response(
            JSON.stringify({ items: [`item-${page}-1`, `item-${page}-2`], page }),
            { status: 200 }
          );
        }),
      }
    );

    await state.execute();
    expect(state.page.value).toBe(1);
    expect(state.data.value?.page).toBe(1);
    expect(state.data.value?.items).toEqual(['item-1-1', 'item-1-2']);
  });

  it('navigates to the next page', async () => {
    const state = usePaginatedFetch<{ page: number }>(
      (page) => `/api/items?page=${page}`,
      {
        immediate: false,
        fetcher: asMockFetch(async (input) => {
          const url = new URL(String(input), 'http://localhost');
          const page = Number(url.searchParams.get('page'));
          return new Response(JSON.stringify({ page }), { status: 200 });
        }),
      }
    );

    await state.execute();
    expect(state.page.value).toBe(1);

    await state.next();
    expect(state.page.value).toBe(2);
    expect(state.data.value?.page).toBe(2);
  });

  it('navigates to the previous page (minimum 1)', async () => {
    const state = usePaginatedFetch<{ page: number }>(
      (page) => `/api/items?page=${page}`,
      {
        immediate: false,
        fetcher: asMockFetch(async (input) => {
          const url = new URL(String(input), 'http://localhost');
          const page = Number(url.searchParams.get('page'));
          return new Response(JSON.stringify({ page }), { status: 200 });
        }),
      }
    );

    await state.execute();
    await state.next();
    await state.next();
    expect(state.page.value).toBe(3);

    await state.prev();
    expect(state.page.value).toBe(2);

    // Ensure it doesn't go below 1
    state.page.value = 1;
    await state.prev();
    expect(state.page.value).toBe(1);
  });

  it('jumps to a specific page with goTo()', async () => {
    const state = usePaginatedFetch<{ page: number }>(
      (page) => `/api/items?page=${page}`,
      {
        immediate: false,
        fetcher: asMockFetch(async (input) => {
          const url = new URL(String(input), 'http://localhost');
          const page = Number(url.searchParams.get('page'));
          return new Response(JSON.stringify({ page }), { status: 200 });
        }),
      }
    );

    await state.goTo(10);
    expect(state.page.value).toBe(10);
    expect(state.data.value?.page).toBe(10);
  });

  it('exposes writable page signal', async () => {
    const state = usePaginatedFetch<{ page: number }>(
      (page) => `/api/items?page=${page}`,
      {
        immediate: false,
        fetcher: asMockFetch(async (input) => {
          const url = new URL(String(input), 'http://localhost');
          const page = Number(url.searchParams.get('page'));
          return new Response(JSON.stringify({ page }), { status: 200 });
        }),
      }
    );

    expect(state.page.value).toBe(1);
    state.page.value = 5;
    expect(state.page.value).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// useInfiniteFetch
// ---------------------------------------------------------------------------

describe('useInfiniteFetch', () => {
  const createMockApi = (totalPages: number = 3) => {
    return asMockFetch(async (input) => {
      const url = new URL(String(input), 'http://localhost');
      const cursorParam = url.searchParams.get('cursor');
      const cursor = cursorParam ? Number(cursorParam) : 0;
      const pageNumber = cursor + 1;

      const items = [`item-${pageNumber}-a`, `item-${pageNumber}-b`];
      const nextCursor = pageNumber < totalPages ? pageNumber : null;

      return new Response(
        JSON.stringify({ items, nextCursor, pageNumber }),
        { status: 200 }
      );
    });
  };

  it('fetches the first page immediately', async () => {
    const state = useInfiniteFetch<{ items: string[]; nextCursor: number | null }, string[]>(
      (cursor) => `/api/feed?cursor=${cursor ?? ''}`,
      {
        getNextCursor: (page) => (page.nextCursor != null ? page.nextCursor : undefined) as number | undefined,
        transform: (pages) => pages.flatMap((p) => p.items),
        fetcher: createMockApi(),
      }
    );

    // Wait for immediate fetch
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(state.data.value).toEqual(['item-1-a', 'item-1-b']);
    expect(state.pages.value).toHaveLength(1);
    expect(state.hasMore.value).toBe(true);

    state.dispose();
  });

  it('fetches subsequent pages with fetchNextPage()', async () => {
    const state = useInfiniteFetch<{ items: string[]; nextCursor: number | null }, string[]>(
      (cursor) => `/api/feed?cursor=${cursor ?? ''}`,
      {
        immediate: false,
        getNextCursor: (page) => (page.nextCursor != null ? page.nextCursor : undefined) as number | undefined,
        transform: (pages) => pages.flatMap((p) => p.items),
        fetcher: createMockApi(),
      }
    );

    await state.fetchNextPage();
    expect(state.pages.value).toHaveLength(1);
    expect(state.data.value).toEqual(['item-1-a', 'item-1-b']);
    expect(state.hasMore.value).toBe(true);

    await state.fetchNextPage();
    expect(state.pages.value).toHaveLength(2);
    expect(state.data.value).toEqual(['item-1-a', 'item-1-b', 'item-2-a', 'item-2-b']);
    expect(state.hasMore.value).toBe(true);

    await state.fetchNextPage();
    expect(state.pages.value).toHaveLength(3);
    expect(state.data.value).toHaveLength(6);
    expect(state.hasMore.value).toBe(false);

    state.dispose();
  });

  it('reports hasMore before the first page is loaded', () => {
    const state = useInfiniteFetch<{ items: string[]; nextCursor: number | null }, string[]>(
      (cursor) => `/api/feed?cursor=${cursor ?? ''}`,
      {
        immediate: false,
        getNextCursor: (page) =>
          (page.nextCursor != null ? page.nextCursor : undefined) as number | undefined,
        transform: (pages) => pages.flatMap((p) => p.items),
        fetcher: createMockApi(),
      }
    );

    expect(state.pages.value).toEqual([]);
    expect(state.hasMore.value).toBe(true);

    state.dispose();
  });

  it('sets hasMore to false after loading a single final page', async () => {
    const state = useInfiniteFetch<{ items: string[]; nextCursor: number | null }, string[]>(
      (cursor) => `/api/feed?cursor=${cursor ?? ''}`,
      {
        immediate: false,
        getNextCursor: (page) =>
          (page.nextCursor != null ? page.nextCursor : undefined) as number | undefined,
        transform: (pages) => pages.flatMap((p) => p.items),
        fetcher: createMockApi(1),
      }
    );

    expect(state.hasMore.value).toBe(true);

    await state.fetchNextPage();

    expect(state.pages.value).toHaveLength(1);
    expect(state.hasMore.value).toBe(false);

    state.dispose();
  });

  it('resets all pages on refresh()', async () => {
    const state = useInfiniteFetch<{ items: string[]; nextCursor: number | null }, string[]>(
      (cursor) => `/api/feed?cursor=${cursor ?? ''}`,
      {
        immediate: false,
        getNextCursor: (page) => (page.nextCursor != null ? page.nextCursor : undefined) as number | undefined,
        transform: (pages) => pages.flatMap((p) => p.items),
        fetcher: createMockApi(),
      }
    );

    await state.fetchNextPage();
    await state.fetchNextPage();
    expect(state.pages.value).toHaveLength(2);

    await state.refresh();
    expect(state.pages.value).toHaveLength(1);
    expect(state.data.value).toEqual(['item-1-a', 'item-1-b']);

    state.dispose();
  });

  it('clears all data with clear()', async () => {
    const state = useInfiniteFetch<{ items: string[]; nextCursor: number | null }, string[]>(
      (cursor) => `/api/feed?cursor=${cursor ?? ''}`,
      {
        immediate: false,
        getNextCursor: (page) => (page.nextCursor != null ? page.nextCursor : undefined) as number | undefined,
        transform: (pages) => pages.flatMap((p) => p.items),
        fetcher: createMockApi(),
      }
    );

    await state.fetchNextPage();
    expect(state.pages.value).toHaveLength(1);

    state.clear();
    expect(state.pages.value).toEqual([]);
    expect(state.data.value).toBeUndefined();
    expect(state.status.value).toBe('idle');

    state.dispose();
  });

  it('handles errors', async () => {
    const state = useInfiniteFetch<{ items: string[] }, string[]>(
      () => '/api/fail',
      {
        immediate: false,
        getNextCursor: () => undefined,
        transform: (pages) => pages.flatMap((p) => p.items),
        fetcher: asMockFetch(async () =>
          new Response('error', { status: 500, statusText: 'Internal Server Error' })
        ),
      }
    );

    await state.fetchNextPage();
    expect(state.status.value).toBe('error');
    expect(state.error.value).toBeTruthy();

    state.dispose();
  });

  it('calls onSuccess after successfully loading a page', async () => {
    const successes: string[][] = [];
    const state = useInfiniteFetch<{ items: string[]; nextCursor: number | null }, string[]>(
      (cursor) => `/api/feed?cursor=${cursor ?? ''}`,
      {
        immediate: false,
        getNextCursor: (page) => (page.nextCursor != null ? page.nextCursor : undefined) as number | undefined,
        transform: (pages) => pages.flatMap((p) => p.items),
        onSuccess: (value) => successes.push(value),
        fetcher: createMockApi(),
      }
    );

    const result = await state.fetchNextPage();

    expect(result).toEqual(['item-1-a', 'item-1-b']);
    expect(successes).toEqual([['item-1-a', 'item-1-b']]);

    state.dispose();
  });

  it('prevents fetching after dispose', async () => {
    let fetchCount = 0;

    const state = useInfiniteFetch<{ items: string[]; nextCursor: number | null }, string[]>(
      (cursor) => `/api/feed?cursor=${cursor ?? ''}`,
      {
        immediate: false,
        getNextCursor: (page) => (page.nextCursor != null ? page.nextCursor : undefined) as number | undefined,
        transform: (pages) => pages.flatMap((p) => p.items),
        fetcher: asMockFetch(async () => {
          fetchCount++;
          return new Response(
            JSON.stringify({ items: ['a'], nextCursor: 1 }),
            { status: 200 }
          );
        }),
      }
    );

    await state.fetchNextPage();
    expect(fetchCount).toBe(1);

    state.dispose();
    await state.fetchNextPage();
    expect(fetchCount).toBe(1);
  });
});
