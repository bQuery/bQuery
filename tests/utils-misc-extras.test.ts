import { describe, expect, it } from 'bun:test';
import { nextFrame, nextTick, pollUntil, times, tryCatch, uuid } from '../src/core/utils/misc';

describe('utils/misc extras', () => {
  it('uuid produces RFC 4122 v4 format', () => {
    const id = uuid();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(uuid()).not.toBe(uuid());
  });

  it('tryCatch returns sync tuples', () => {
    const [ok, value] = tryCatch(() => 42);
    expect(ok).toBeNull();
    expect(value).toBe(42);
    const [err, undef] = tryCatch<number>(() => {
      throw new Error('nope');
    });
    expect(err).toBeInstanceOf(Error);
    expect(undef).toBeUndefined();
  });

  it('tryCatch returns async tuples', async () => {
    const [ok, value] = await tryCatch(async () => 'ok');
    expect(ok).toBeNull();
    expect(value).toBe('ok');
    const [err, undef] = await tryCatch<string>(async () => {
      throw new Error('async boom');
    });
    expect((err as Error).message).toBe('async boom');
    expect(undef).toBeUndefined();
  });

  it('times invokes the iteratee N times', () => {
    expect(times(3, (i) => i * 2)).toEqual([0, 2, 4]);
    expect(times(0, (i) => i)).toEqual([]);
    expect(times(-5, (i) => i)).toEqual([]);
  });

  it('pollUntil resolves when predicate yields a truthy value', async () => {
    let n = 0;
    const result = await pollUntil(() => (n++ >= 2 ? 'ready' : false), {
      interval: 5,
      timeout: 200,
    });
    expect(result).toBe('ready');
  });

  it('pollUntil rejects on timeout', async () => {
    await expect(pollUntil(() => false, { interval: 5, timeout: 20 })).rejects.toThrow(/timed out/);
  });

  it('pollUntil rejects on abort', async () => {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 10);
    await expect(
      pollUntil(() => false, { interval: 5, timeout: 1000, signal: ctrl.signal })
    ).rejects.toThrow();
  });

  it('nextFrame and nextTick resolve', async () => {
    const t = await nextFrame();
    expect(typeof t).toBe('number');
    await nextTick();
    expect(true).toBe(true);
  });
});
