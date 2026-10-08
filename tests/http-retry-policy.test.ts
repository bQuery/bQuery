import { describe, expect, it } from 'bun:test';
import { createHttp, HttpError, useFetch } from '../src/reactive/signal';
import {
  DEFAULT_RETRY_METHODS,
  DEFAULT_RETRY_STATUSES,
  isRetryableMethod,
  parseRetryAfter,
  resolveRetryAfterDelay,
} from '../src/reactive/retry-policy';

const asMockFetch = (
  handler: (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>
): typeof fetch =>
  Object.assign(handler, {
    preconnect: (_url: string | URL, _options?: { dns?: boolean; tcp?: boolean; tls?: boolean }) =>
      undefined,
  }) as typeof fetch;

/** Fetcher that replies with `failures` error responses, then 200 `{ ok: true }`. */
const flaky = (failures: Response[] | (() => Response), counter: { calls: number }) =>
  asMockFetch(async () => {
    counter.calls++;
    if (typeof failures === 'function') {
      return counter.calls === 1 ? failures() : Response.json({ ok: true });
    }
    const failure = failures[counter.calls - 1];
    return failure ?? Response.json({ ok: true });
  });

describe('retry policy helpers', () => {
  it('exposes idempotent methods and transient statuses as defaults', () => {
    expect([...DEFAULT_RETRY_METHODS]).toEqual(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']);
    expect([...DEFAULT_RETRY_STATUSES]).toEqual([408, 429, 502, 503, 504]);
  });

  it('matches methods case-insensitively and supports a wildcard', () => {
    expect(isRetryableMethod('get')).toBe(true);
    expect(isRetryableMethod(undefined)).toBe(true);
    expect(isRetryableMethod('POST')).toBe(false);
    expect(isRetryableMethod('patch', ['PATCH'])).toBe(true);
    expect(isRetryableMethod('POST', ['*'])).toBe(true);
  });

  it('parses delta-seconds and HTTP dates', () => {
    const now = Date.parse('Wed, 21 Oct 2026 07:28:00 GMT');
    expect(parseRetryAfter('3', now)).toBe(3000);
    expect(parseRetryAfter(' 0 ', now)).toBe(0);
    expect(parseRetryAfter('Wed, 21 Oct 2026 07:28:05 GMT', now)).toBe(5000);
    expect(parseRetryAfter('Wed, 21 Oct 2026 07:27:00 GMT', now)).toBe(0);
  });

  it('rejects malformed Retry-After values', () => {
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter('')).toBeUndefined();
    expect(parseRetryAfter('-1')).toBeUndefined();
    expect(parseRetryAfter('1.5')).toBeUndefined();
    expect(parseRetryAfter('soon')).toBeUndefined();
  });

  it('caps the requested delay at maxRetryAfter', () => {
    const headers = new Headers({ 'retry-after': '3600' });
    expect(resolveRetryAfterDelay(headers, 2000)).toBe(2000);
    expect(resolveRetryAfterDelay(new Headers(), 2000)).toBeUndefined();
  });
});

describe('http retry defaults', () => {
  it('does not retry POST by default', async () => {
    const counter = { calls: 0 };
    const api = createHttp({
      retry: { count: 3, delay: 0 },
      fetcher: flaky([new Response('', { status: 503 })], counter),
    });

    await expect(api.post('/orders', { id: 1 })).rejects.toBeInstanceOf(HttpError);
    expect(counter.calls).toBe(1);
  });

  it('does not retry PATCH network failures by default', async () => {
    let calls = 0;
    const api = createHttp({
      retry: { count: 3, delay: 0 },
      fetcher: asMockFetch(async () => {
        calls++;
        throw new TypeError('network down');
      }),
    });

    await expect(api.patch('/orders/1', { id: 1 })).rejects.toBeInstanceOf(HttpError);
    expect(calls).toBe(1);
  });

  it('retries POST when the method is opted in', async () => {
    const counter = { calls: 0 };
    const api = createHttp({
      retry: { count: 3, delay: 0, methods: ['POST'] },
      fetcher: flaky([new Response('', { status: 503 })], counter),
    });

    const res = await api.post<{ ok: boolean }>('/orders', { id: 1 });
    expect(res.data.ok).toBe(true);
    expect(counter.calls).toBe(2);
  });

  it('lets a custom retryOn opt POST in', async () => {
    const counter = { calls: 0 };
    const api = createHttp({
      retry: { count: 3, delay: 0, retryOn: (error) => error.response?.status === 503 },
      fetcher: flaky([new Response('', { status: 503 })], counter),
    });

    await api.post('/orders', { id: 1 });
    expect(counter.calls).toBe(2);
  });

  it('retries PUT, DELETE, HEAD and OPTIONS', async () => {
    for (const method of ['put', 'delete', 'head', 'options'] as const) {
      const counter = { calls: 0 };
      const api = createHttp({
        retry: { count: 1, delay: 0 },
        fetcher: flaky([new Response('', { status: 502 })], counter),
      });
      if (method === 'put') await api.put('/x', {});
      else await api[method]('/x', { parseAs: 'text' });
      expect(counter.calls).toBe(2);
    }
  });

  it.each([408, 429, 502, 503, 504])('retries status %d', async (status) => {
    const counter = { calls: 0 };
    const api = createHttp({
      retry: { count: 1, delay: 0 },
      fetcher: flaky([new Response('', { status })], counter),
    });
    await api.get('/x');
    expect(counter.calls).toBe(2);
  });

  it.each([400, 404, 500, 501])('does not retry status %d', async (status) => {
    const counter = { calls: 0 };
    const api = createHttp({
      retry: { count: 3, delay: 0 },
      fetcher: flaky([new Response('', { status })], counter),
    });
    await expect(api.get('/x')).rejects.toBeInstanceOf(HttpError);
    expect(counter.calls).toBe(1);
  });

  it('accepts a custom status list', async () => {
    const counter = { calls: 0 };
    const api = createHttp({
      retry: { count: 1, delay: 0, statuses: [500] },
      fetcher: flaky([new Response('', { status: 500 })], counter),
    });
    await api.get('/x');
    expect(counter.calls).toBe(2);
  });

  it('waits for Retry-After instead of the configured delay', async () => {
    const counter = { calls: 0 };
    const api = createHttp({
      retry: { count: 1, delay: () => 5000 },
      fetcher: flaky([new Response('', { status: 429, headers: { 'retry-after': '0' } })], counter),
    });

    const started = Date.now();
    await api.get('/x');
    expect(counter.calls).toBe(2);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('caps Retry-After with maxRetryAfter', async () => {
    const counter = { calls: 0 };
    const api = createHttp({
      retry: { count: 1, delay: 0, maxRetryAfter: 20 },
      fetcher: flaky(
        [new Response('', { status: 503, headers: { 'retry-after': '3600' } })],
        counter
      ),
    });

    const started = Date.now();
    await api.get('/x');
    expect(counter.calls).toBe(2);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('ignores Retry-After when respectRetryAfter is false', async () => {
    const counter = { calls: 0 };
    const api = createHttp({
      retry: { count: 1, delay: 0, respectRetryAfter: false },
      fetcher: flaky(
        [new Response('', { status: 503, headers: { 'retry-after': '3600' } })],
        counter
      ),
    });

    const started = Date.now();
    await api.get('/x');
    expect(Date.now() - started).toBeLessThan(1000);
  });
});

describe('useFetch retry defaults', () => {
  it('does not retry POST by default', async () => {
    const counter = { calls: 0 };
    const state = useFetch('/orders', {
      immediate: false,
      method: 'POST',
      body: { id: 1 },
      retry: { count: 2, delay: 0 },
      fetcher: flaky([new Response('', { status: 503 })], counter),
    });

    await state.execute();
    expect(state.status.value).toBe('error');
    expect(counter.calls).toBe(1);
  });

  it('does not retry a 500 by default', async () => {
    const counter = { calls: 0 };
    const state = useFetch('/x', {
      immediate: false,
      retry: { count: 2, delay: 0 },
      fetcher: flaky([new Response('', { status: 500 })], counter),
    });

    await state.execute();
    expect(counter.calls).toBe(1);
  });

  it('retries 429 and honours Retry-After', async () => {
    const counter = { calls: 0 };
    const state = useFetch<{ ok: boolean }>('/x', {
      immediate: false,
      retry: { count: 1, delay: 60_000 },
      fetcher: flaky(
        () => new Response('', { status: 429, headers: { 'retry-after': '0' } }),
        counter
      ),
    });

    const started = Date.now();
    const result = await state.execute();
    expect(result?.ok).toBe(true);
    expect(counter.calls).toBe(2);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('retries POST when the method is opted in', async () => {
    const counter = { calls: 0 };
    const state = useFetch('/orders', {
      immediate: false,
      method: 'POST',
      body: { id: 1 },
      retry: { count: 1, delay: 0, methods: ['POST'] },
      fetcher: flaky([new Response('', { status: 503 })], counter),
    });

    await state.execute();
    expect(state.status.value).toBe('success');
    expect(counter.calls).toBe(2);
  });
});
