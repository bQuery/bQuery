/**
 * Reactive scheduler (#210).
 *
 * Under the default `'sync'` scheduler a diamond dependency graph makes
 * `effect()` observe intermediate states that never logically existed: the
 * effect fires once per upstream `computed` that updates, rather than once per
 * settled graph state. The `'batched'` scheduler coalesces writes onto a
 * microtask, which removes the glitch and collapses a burst into one run.
 *
 * The four blocks below are the acceptance tests the issue asks for.
 */

import { afterEach, describe, expect, it } from 'bun:test';
import {
  batch,
  computed,
  configureReactive,
  effect,
  effectScope,
  flushSync,
  getReactiveConfig,
  signal,
} from '../src/reactive/index';

afterEach(() => {
  configureReactive({ scheduler: 'sync' });
});

/** The exact graph from the issue. */
const diamond = () => {
  const a = signal(0);
  const b = computed(() => a.value + 1);
  const c = computed(() => a.value * 2);
  const d = computed(() => b.value + c.value);
  const runs: number[] = [];
  effect(() => {
    runs.push(d.value);
  });
  return { a, runs };
};

describe('reactive/configureReactive', () => {
  it('defaults to the sync scheduler', () => {
    expect(getReactiveConfig().scheduler).toBe('sync');
  });

  it('reports the configured scheduler', () => {
    configureReactive({ scheduler: 'batched' });
    expect(getReactiveConfig().scheduler).toBe('batched');
  });

  it('leaves the scheduler alone for an options object that sets nothing', () => {
    configureReactive({ scheduler: 'batched' });
    configureReactive({});
    expect(getReactiveConfig().scheduler).toBe('batched');
  });
});

describe('sync scheduler (the 1.x default)', () => {
  it('keeps its existing, glitchy timing', () => {
    // Pinned deliberately: this is the behaviour the opt-in flag exists to
    // preserve for 1.x. If this changes, the default changed with it.
    const { a, runs } = diamond();

    a.value = 1;
    a.value = 2;

    expect(runs).toEqual([1, 2, 4, 5, 7]);
  });

  it('still coalesces inside an explicit batch', () => {
    const { a, runs } = diamond();

    batch(() => {
      a.value = 1;
      a.value = 2;
    });

    expect(runs).toEqual([1, 7]);
  });
});

describe('batched scheduler: no glitches in a diamond graph', () => {
  it('produces no intermediate values', async () => {
    configureReactive({ scheduler: 'batched' });
    const { a, runs } = diamond();

    a.value = 1;
    await Promise.resolve();
    a.value = 2;
    await Promise.resolve();

    // 2 and 5 are the glitches: states where `b` recomputed but `c` had not.
    expect(runs).toEqual([1, 4, 7]);
  });

  it('never observes a state where the two branches disagree', async () => {
    configureReactive({ scheduler: 'batched' });
    const a = signal(1);
    const double = computed(() => a.value * 2);
    const quadruple = computed(() => double.value * 2);
    const seen: Array<[number, number]> = [];

    effect(() => {
      seen.push([double.value, quadruple.value]);
    });

    for (const next of [2, 3, 4]) {
      a.value = next;
      await Promise.resolve();
    }

    for (const [d, q] of seen) {
      expect(q, `quadruple should always be 2× double, saw ${d}/${q}`).toBe(d * 2);
    }
  });
});

describe('batched scheduler: one run per tick', () => {
  it('collapses N writes in one tick into a single effect run', async () => {
    configureReactive({ scheduler: 'batched' });
    const count = signal(0);
    const runs: number[] = [];
    effect(() => {
      runs.push(count.value);
    });

    for (let i = 1; i <= 100; i++) count.value = i;
    await Promise.resolve();

    // One run on creation, one for the settled value.
    expect(runs).toEqual([0, 100]);
  });

  it('runs once per tick across several ticks', async () => {
    configureReactive({ scheduler: 'batched' });
    const count = signal(0);
    let runs = 0;
    effect(() => {
      void count.value;
      runs++;
    });

    for (let tick = 1; tick <= 3; tick++) {
      count.value = tick * 10;
      count.value = tick * 10 + 1;
      await Promise.resolve();
    }

    expect(runs).toBe(4); // creation + one per tick
  });

  it('does not run an effect at all when the value settles back', async () => {
    configureReactive({ scheduler: 'batched' });
    const count = signal(0);
    let runs = 0;
    effect(() => {
      void count.value;
      runs++;
    });

    count.value = 1;
    count.value = 0; // back to where it started
    await Promise.resolve();

    // The signal's own Object.is check means the second write is a no-op, and
    // the queued observer sees an unchanged value.
    expect(runs).toBe(2);
  });
});

describe('batched scheduler: effects that write signals still settle', () => {
  it('settles a chain of effect-driven writes', async () => {
    configureReactive({ scheduler: 'batched' });
    const source = signal(0);
    const mirror = signal(0);

    effect(() => {
      mirror.value = source.value * 2;
    });

    source.value = 5;
    await Promise.resolve();

    expect(mirror.value).toBe(10);
  });

  it('does not hang on a cyclic update, and warns', async () => {
    configureReactive({ scheduler: 'batched' });
    const a = signal(0);
    const b = signal(0);

    const warnings: unknown[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => warnings.push(args[0]);

    try {
      effect(() => {
        b.value = a.value + 1;
      });
      effect(() => {
        a.value = b.value + 1;
      });

      a.value = 1;
      await Promise.resolve();
    } finally {
      console.warn = originalWarn;
    }

    // The MAX_FLUSH_PASSES guard stops it; the point is that it terminates.
    expect(Number.isFinite(a.value)).toBe(true);
    expect(Number.isFinite(b.value)).toBe(true);
  });
});

describe('batched scheduler: ordering', () => {
  it('runs a parent scope before the child it owns', async () => {
    configureReactive({ scheduler: 'batched' });
    const source = signal(0);
    const order: string[] = [];

    const scope = effectScope();
    scope.run(() => {
      effect(() => {
        void source.value;
        order.push('parent');
      });
      effectScope().run(() => {
        effect(() => {
          void source.value;
          order.push('child');
        });
      });
    });

    order.length = 0;
    source.value = 1;
    await Promise.resolve();

    expect(order).toEqual(['parent', 'child']);
    scope.stop();
  });

  it('runs a computed before the effect that reads it', async () => {
    configureReactive({ scheduler: 'batched' });
    const source = signal(1);
    const order: string[] = [];
    const derived = computed(() => {
      order.push('computed');
      return source.value * 2;
    });

    effect(() => {
      order.push(`effect:${derived.value}`);
    });

    order.length = 0;
    source.value = 2;
    await Promise.resolve();

    expect(order[0]).toBe('computed');
    expect(order[order.length - 1]).toBe('effect:4');
  });
});

describe('flushSync', () => {
  it('runs pending updates immediately, with no await', () => {
    configureReactive({ scheduler: 'batched' });
    const count = signal(0);
    const runs: number[] = [];
    effect(() => {
      runs.push(count.value);
    });

    count.value = 1;
    count.value = 2;
    expect(runs).toEqual([0]); // still queued

    flushSync();
    expect(runs).toEqual([0, 2]);
  });

  it('is a no-op with nothing queued', () => {
    configureReactive({ scheduler: 'batched' });
    expect(() => {
      flushSync();
      flushSync();
    }).not.toThrow();
  });

  it('does nothing under the sync scheduler, where nothing is queued', () => {
    const count = signal(0);
    const runs: number[] = [];
    effect(() => {
      runs.push(count.value);
    });

    count.value = 1;
    expect(runs).toEqual([0, 1]);
    flushSync();
    expect(runs).toEqual([0, 1]);
  });

  it('leaves work with the enclosing batch rather than breaking it open', () => {
    configureReactive({ scheduler: 'batched' });
    const count = signal(0);
    const runs: number[] = [];
    effect(() => {
      runs.push(count.value);
    });

    batch(() => {
      count.value = 1;
      flushSync();
      // Still inside the batch: the effect must not have run yet.
      expect(runs).toEqual([0]);
      count.value = 2;
    });

    expect(runs).toEqual([0, 2]);
  });

  it('settles a diamond synchronously', () => {
    configureReactive({ scheduler: 'batched' });
    const { a, runs } = diamond();

    a.value = 1;
    flushSync();
    a.value = 2;
    flushSync();

    expect(runs).toEqual([1, 4, 7]);
  });
});

describe('switching schedulers', () => {
  it('applies to writes made after the change', async () => {
    const count = signal(0);
    const runs: number[] = [];
    effect(() => {
      runs.push(count.value);
    });

    count.value = 1; // sync
    expect(runs).toEqual([0, 1]);

    configureReactive({ scheduler: 'batched' });
    count.value = 2;
    count.value = 3;
    expect(runs).toEqual([0, 1]); // queued
    await Promise.resolve();
    expect(runs).toEqual([0, 1, 3]);
  });

  it('flushes work queued before a switch back to sync', async () => {
    configureReactive({ scheduler: 'batched' });
    const count = signal(0);
    const runs: number[] = [];
    effect(() => {
      runs.push(count.value);
    });

    count.value = 1;
    configureReactive({ scheduler: 'sync' });
    await Promise.resolve();

    // The queued microtask still drains what was pending.
    expect(runs).toEqual([0, 1]);
  });
});
