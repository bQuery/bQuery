import { describe, expect, it } from 'bun:test';
import {
  compose,
  curry,
  debounce,
  memoize,
  partial,
  pipe,
  retry,
  throttle,
} from '../src/core/utils/function';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe('utils/function extras', () => {
  it('memoize caches by JSON of args by default and supports clear/delete', () => {
    let calls = 0;
    const fn = memoize((n: number) => {
      calls += 1;
      return n * 2;
    });
    expect(fn(2)).toBe(4);
    expect(fn(2)).toBe(4);
    expect(calls).toBe(1);
    fn.clear();
    fn(2);
    expect(calls).toBe(2);
    expect(fn.delete('[2]')).toBe(true);
  });

  it('memoize throws a clear error when default key serialization fails', () => {
    let calls = 0;
    const fn = memoize((value: unknown) => {
      calls += 1;
      return value;
    });
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => fn(circular)).toThrow(
      'memoize: failed to compute cache key from arguments; provide keyFn for non-serializable values'
    );
    expect(calls).toBe(0);
  });

  it('compose and pipe compose in opposite orders', () => {
    const inc = (n: number) => n + 1;
    const double = (n: number) => n * 2;
    expect(compose(inc, double)(3)).toBe(7); // double then inc
    expect(pipe(inc, double)(3)).toBe(8); // inc then double
    expect(compose<number>()(3)).toBe(3);
    expect(pipe<number>()(3)).toBe(3);
  });

  it('curry collects arguments to satisfy arity', () => {
    const add = (a: number, b: number, c: number) => a + b + c;
    const c = curry(add) as (a: number) => (b: number) => (c: number) => number;
    expect(c(1)(2)(3)).toBe(6);
    const c2 = curry(add) as (...a: number[]) => unknown;
    expect((c2(1, 2) as (c: number) => number)(3)).toBe(6);
    expect(c2(1, 2, 3)).toBe(6);
  });

  it('partial pre-applies leading arguments', () => {
    const greet = (g: string, name: string) => `${g}, ${name}!`;
    expect(partial(greet, 'Hello')('world')).toBe('Hello, world!');
  });

  it('retry retries until success and applies exponential backoff', async () => {
    let attempts = 0;
    const value = await retry(
      async () => {
        attempts += 1;
        if (attempts < 3) throw new Error('boom');
        return 'ok';
      },
      { attempts: 5, baseDelay: 5, factor: 2 }
    );
    expect(value).toBe('ok');
    expect(attempts).toBe(3);
  });

  it('retry honors shouldRetry to abort early', async () => {
    let attempts = 0;
    const promise = retry(
      () => {
        attempts += 1;
        throw new Error('fatal');
      },
      { attempts: 5, baseDelay: 1, shouldRetry: () => false }
    );
    await expect(promise).rejects.toThrow('fatal');
    expect(attempts).toBe(1);
  });

  it('retry can be aborted via AbortSignal', async () => {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 20);
    const promise = retry(
      async () => {
        throw new Error('again');
      },
      { attempts: 10, baseDelay: 50, signal: ctrl.signal }
    );
    await expect(promise).rejects.toThrow();
  });

  it('retry rejects invalid attempt counts predictably', async () => {
    await expect(retry(async () => 'ok', { attempts: 0 })).rejects.toThrow(
      'retry: attempts must be greater than 0'
    );
  });

  it('debounce(leading: true) fires immediately, trailing on quiet', async () => {
    let calls: number[] = [];
    const fn = debounce((n: number) => calls.push(n), 30, { leading: true, trailing: true });
    fn(1);
    fn(2);
    fn(3);
    expect(calls).toEqual([1]);
    await wait(60);
    expect(calls).toEqual([1, 3]);
  });

  it('debounce(leading: true, trailing: true) does not double-invoke a single call (#178)', async () => {
    const calls: number[] = [];
    const fn = debounce((n: number) => calls.push(n), 30, { leading: true, trailing: true });

    fn(1);

    // Leading fires immediately; the trailing edge must NOT fire for a single
    // call (lodash semantics: trailing only when called more than once).
    expect(calls).toEqual([1]);
    await wait(60);
    expect(calls).toEqual([1]);
  });

  it('debounce maxWait forces invocation', async () => {
    let calls: number[] = [];
    const fn = debounce((n: number) => calls.push(n), 30, { maxWait: 50 });
    fn(1);
    await wait(20);
    fn(2);
    await wait(20);
    fn(3);
    await wait(20);
    // By now ~60ms have elapsed; maxWait should have fired.
    expect(calls.length).toBeGreaterThan(0);
  });

  it('debounce.cancel resets the maxWait window', async () => {
    const calls: number[] = [];
    const fn = debounce((n: number) => calls.push(n), 50, { maxWait: 60 });

    fn(1);
    await wait(40);
    fn.cancel();
    fn(2);
    await wait(30);
    expect(calls).toEqual([]);
    await wait(35);
    expect(calls).toEqual([2]);
  });

  it('debounce maxWait stays disabled when trailing is false', async () => {
    const calls: number[] = [];
    const fn = debounce((n: number) => calls.push(n), 30, {
      leading: true,
      trailing: false,
      maxWait: 50,
    });

    fn(1);
    await wait(20);
    fn(2);
    await wait(60);

    expect(calls).toEqual([1]);
  });

  it('debounce maxWait still caps delays when leading is true', async () => {
    const calls: number[] = [];
    const fn = debounce((n: number) => calls.push(n), 50, {
      leading: true,
      trailing: true,
      maxWait: 40,
    });

    fn(1);
    await wait(20);
    fn(2);
    await wait(30);

    expect(calls).toEqual([1, 2]);
  });

  it('debounce.flush invokes pending immediately', () => {
    let calls: number[] = [];
    const fn = debounce((n: number) => calls.push(n), 100);
    fn(7);
    fn.flush();
    expect(calls).toEqual([7]);
  });

  it('throttle trailing: true delivers the last-seen call', async () => {
    const calls: number[] = [];
    const fn = throttle((n: number) => calls.push(n), 40, { leading: true, trailing: true });
    fn(1);
    fn(2);
    fn(3);
    await wait(80);
    expect(calls[0]).toBe(1);
    expect(calls[calls.length - 1]).toBe(3);
  });

  it('throttle.flush invokes pending trailing immediately', async () => {
    const calls: number[] = [];
    const fn = throttle((n: number) => calls.push(n), 100, { leading: false, trailing: true });
    fn(1);
    fn(2);
    fn.flush();
    expect(calls.length).toBeGreaterThanOrEqual(1);
  });

  it('throttle.flush is a no-op when no trailing call is scheduled', () => {
    const calls: number[] = [];
    const fn = throttle((n: number) => calls.push(n), 100, { leading: false, trailing: false });
    fn(1);
    fn.flush();
    expect(calls).toEqual([]);
  });

  it('backwards-compatible debounce/throttle signatures still work', async () => {
    let dCalls = 0;
    const d = debounce(() => (dCalls += 1), 20);
    d();
    d();
    await wait(40);
    expect(dCalls).toBe(1);

    let tCalls = 0;
    const t = throttle(() => (tCalls += 1), 30);
    t();
    t();
    t();
    expect(tCalls).toBe(1);
  });
});
