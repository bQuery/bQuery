import { describe, expect, it } from 'bun:test';
import {
  batch,
  computed,
  createUseFetch,
  effect,
  readonly,
  signal,
  useAsyncData,
  useFetch,
} from '../src/reactive/signal';
import { isReadonlySignal } from '../src/reactive/readonly';
import type { ReadonlySignal } from '../src/reactive/readonly';
import { isComputed, isSignal } from '../src/reactive/type-guards';
import { toValue } from '../src/reactive/to-value';
import type { MaybeSignal } from '../src/reactive/to-value';
import {
  effectScope,
  getCurrentScope,
  onScopeDispose,
} from '../src/reactive/scope';
import type { EffectScope } from '../src/reactive/scope';
import { watch as watchFn } from '../src/reactive/watch';
import { untrack as untrackedFn } from '../src/reactive/untrack';

const asMockFetch = (
  handler: (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>
): typeof fetch =>
  Object.assign(handler, {
    // Bun augments fetch with a preconnect helper; tests only need the call signature.
    preconnect: (_url: string | URL, _options?: { dns?: boolean; tcp?: boolean; tls?: boolean }) =>
      undefined,
  }) as typeof fetch;

describe('signal', () => {
  it('stores and retrieves values', () => {
    const count = signal(0);
    expect(count.value).toBe(0);

    count.value = 5;
    expect(count.value).toBe(5);
  });

  it('uses Object.is for equality', () => {
    const obj = signal({ a: 1 });
    const original = obj.value;

    // Same reference should not trigger update
    obj.value = original;
    expect(obj.value).toBe(original);
  });

  it('peek returns value without tracking', () => {
    const count = signal(0);
    expect(count.peek()).toBe(0);
  });

  it('update transforms value', () => {
    const count = signal(5);
    count.update((n) => n * 2);
    expect(count.value).toBe(10);
  });
});

describe('computed', () => {
  it('computes derived values', () => {
    const count = signal(1);
    const doubled = computed(() => count.value * 2);

    expect(doubled.value).toBe(2);
  });

  it('updates when dependencies change', () => {
    const count = signal(1);
    const doubled = computed(() => count.value * 2);

    expect(doubled.value).toBe(2);
    count.value = 3;
    expect(doubled.value).toBe(6);
  });

  it('caches value until dependencies change', () => {
    let computeCount = 0;
    const count = signal(1);
    const doubled = computed(() => {
      computeCount++;
      return count.value * 2;
    });

    // First access computes
    expect(doubled.value).toBe(2);
    expect(computeCount).toBe(1);

    // Second access uses cache
    expect(doubled.value).toBe(2);
    expect(computeCount).toBe(1);

    // Change triggers recompute
    count.value = 2;
    expect(doubled.value).toBe(4);
    expect(computeCount).toBe(2);
  });

  it('computes from multiple signals', () => {
    const price = signal(10);
    const quantity = signal(2);
    const total = computed(() => price.value * quantity.value);

    expect(total.value).toBe(20);
    price.value = 15;
    expect(total.value).toBe(30);
    quantity.value = 3;
    expect(total.value).toBe(45);
  });

  it('peek returns value without tracking', () => {
    const count = signal(1);
    const doubled = computed(() => count.value * 2);
    let runs = 0;

    // Access via peek inside an effect should NOT create a dependency
    effect(() => {
      doubled.peek();
      runs++;
    });

    expect(runs).toBe(1);
    expect(doubled.peek()).toBe(2);

    // Changing the dependency should NOT trigger the effect
    // because peek() was used instead of .value
    count.value = 5;
    expect(runs).toBe(1);

    // The computed should still update correctly
    expect(doubled.peek()).toBe(10);
  });

  it('peek recomputes if dirty', () => {
    let computeCount = 0;
    const count = signal(1);
    const doubled = computed(() => {
      computeCount++;
      return count.value * 2;
    });

    // First peek triggers computation
    expect(doubled.peek()).toBe(2);
    expect(computeCount).toBe(1);

    // Second peek uses cache
    expect(doubled.peek()).toBe(2);
    expect(computeCount).toBe(1);

    // Mark as dirty by changing dependency
    count.value = 3;

    // peek should recompute
    expect(doubled.peek()).toBe(6);
    expect(computeCount).toBe(2);
  });

  it('dispose unsubscribes the computed from upstream dependencies', () => {
    let computeCount = 0;
    const count = signal(1);
    const doubled = computed(() => {
      computeCount++;
      return count.value * 2;
    });

    expect(doubled.value).toBe(2);
    expect(computeCount).toBe(1);

    doubled.dispose();
    count.value = 2;

    expect(computeCount).toBe(1);
  });

  it('does not re-subscribe or recompute when read after dispose', () => {
    let computeCount = 0;
    const count = signal(1);
    const doubled = computed(() => {
      computeCount++;
      return count.value * 2;
    });

    expect(doubled.value).toBe(2);
    expect(computeCount).toBe(1);

    doubled.dispose();

    expect(doubled.value).toBe(2);
    count.value = 3;

    expect(doubled.value).toBe(2);
    expect(computeCount).toBe(1);
  });

  it('does not track caller dependencies when first read after dispose', () => {
    const source = signal(1);
    const derived = computed(() => source.value * 2);
    let effectRuns = 0;

    derived.dispose();

    effect(() => {
      effectRuns++;
      void derived.value;
    });

    expect(effectRuns).toBe(1);

    source.value = 2;

    expect(effectRuns).toBe(1);
    expect(derived.value).toBe(2);
  });

  it('recomputes once after dispose when a dirty cached value would otherwise be stale', () => {
    let computeCount = 0;
    const count = signal(1);
    const doubled = computed(() => {
      computeCount++;
      return count.value * 2;
    });

    expect(doubled.value).toBe(2);
    expect(computeCount).toBe(1);

    count.value = 3;
    doubled.dispose();

    expect(doubled.value).toBe(6);
    expect(computeCount).toBe(2);

    count.value = 4;
    expect(doubled.value).toBe(6);
    expect(computeCount).toBe(2);
  });
});

describe('effect', () => {
  it('runs immediately', () => {
    let ran = false;
    effect(() => {
      ran = true;
    });
    expect(ran).toBe(true);
  });

  it('re-runs when dependencies change', () => {
    const count = signal(0);
    let latest = 0;

    effect(() => {
      latest = count.value;
    });

    expect(latest).toBe(0);
    count.value = 5;
    expect(latest).toBe(5);
  });

  it('returns cleanup function', () => {
    const count = signal(0);
    let runCount = 0;

    const cleanup = effect(() => {
      expect(count.value).toBe(count.value); // track dependency
      runCount++;
    });

    expect(runCount).toBe(1);

    cleanup();
    count.value = 1;
    // After cleanup, effect should not run
    expect(runCount).toBe(1);
  });

  it('supports cleanup in effect function', () => {
    const count = signal(0);
    let cleanupRan = false;

    effect(() => {
      expect(count.value).toBe(count.value); // track
      return () => {
        cleanupRan = true;
      };
    });

    expect(cleanupRan).toBe(false);
    count.value = 1;
    expect(cleanupRan).toBe(true);
  });

  it('handles cleanup function errors without breaking', () => {
    const count = signal(0);
    let effectRan = 0;

    const originalError = console.error;
    let errorCalls = 0;
    console.error = () => {
      errorCalls++;
    };

    try {
      effect(() => {
        void count.value;
        effectRan++;
        return () => {
          throw new Error('cleanup error');
        };
      });

      expect(effectRan).toBe(1);

      // Should not throw; error in cleanup is caught and logged
      count.value = 1;
      expect(effectRan).toBe(2);
      expect(errorCalls).toBeGreaterThan(0);
    } finally {
      console.error = originalError;
    }
  });
});

describe('batch', () => {
  it('batches multiple updates', () => {
    const count = signal(0);
    let runs = 0;

    effect(() => {
      expect(count.value).toBe(count.value);
      runs++;
    });

    expect(runs).toBe(1);

    batch(() => {
      count.value = 1;
      count.value = 2;
      count.value = 3;
    });

    // Effect runs once at start, once after batch
    expect(runs).toBe(2);
  });

  it('supports nested batches', () => {
    const count = signal(0);
    let runs = 0;

    effect(() => {
      expect(count.value).toBe(count.value);
      runs++;
    });

    batch(() => {
      count.value = 1;
      batch(() => {
        count.value = 2;
      });
      count.value = 3;
    });

    // Only runs after outermost batch completes
    expect(runs).toBe(2);
  });

  it('continues flushing remaining observers when one throws', () => {
    const a = signal(0);
    const b = signal(0);
    let aRan = 0;
    let bRan = 0;

    // First effect will throw in batch
    effect(() => {
      if (a.value > 0) throw new Error('observer error');
      aRan++;
    });

    // Second effect should still run
    effect(() => {
      void b.value;
      bRan++;
    });

    expect(aRan).toBe(1);
    expect(bRan).toBe(1);

    // Mock console.error to avoid noisy output and assert logging behavior
    const originalError = console.error;
    let errorCalls = 0;
    console.error = () => {
      errorCalls++;
    };

    try {
      // Both signals update in a batch; first observer throws but second should still run.
      // Batch itself should not throw, it should log via console.error instead.
      expect(() => {
        batch(() => {
          a.value = 1;
          b.value = 1;
        });
      }).not.toThrow();

      expect(bRan).toBe(2);
      expect(errorCalls).toBeGreaterThan(0);
    } finally {
      console.error = originalError;
    }
  });

  it('recovers from endBatch underflow (no matching beginBatch)', async () => {
    const { endBatch } = await import('../src/reactive/internals');
    const count = signal(0);
    let runs = 0;

    effect(() => {
      void count.value;
      runs++;
    });

    expect(runs).toBe(1);

    // Call endBatch without beginBatch — should not break batching
    endBatch();

    // Subsequent batch should still work correctly
    batch(() => {
      count.value = 1;
      count.value = 2;
    });

    expect(runs).toBe(2);
    expect(count.value).toBe(2);
  });
});

describe('watch', () => {
  it('tracks old and new values', async () => {
    const { watch, signal } = await import('../src/reactive/signal');
    const count = signal(0);
    const changes: [number, number | undefined][] = [];

    watch(count, (newVal, oldVal) => {
      changes.push([newVal, oldVal]);
    });

    count.value = 1;
    count.value = 2;

    expect(changes).toEqual([
      [1, 0],
      [2, 1],
    ]);
  });

  it('supports immediate option', async () => {
    const { watch, signal } = await import('../src/reactive/signal');
    const count = signal(5);
    let called = false;

    watch(
      count,
      (newVal, oldVal) => {
        called = true;
        expect(newVal).toBe(5);
        expect(oldVal).toBe(undefined);
      },
      { immediate: true }
    );

    expect(called).toBe(true);
  });

  it('returns cleanup function', async () => {
    const { watch, signal } = await import('../src/reactive/signal');
    const count = signal(0);
    let callCount = 0;

    const cleanup = watch(count, () => {
      callCount++;
    });

    count.value = 1;
    expect(callCount).toBe(1);

    cleanup();
    count.value = 2;
    expect(callCount).toBe(1);
  });
});

describe('readonly', () => {
  it('creates read-only wrapper', async () => {
    const { readonly, signal } = await import('../src/reactive/signal');
    const _count = signal(0);
    const count = readonly(_count);

    expect(count.value).toBe(0);

    // Original can still be modified
    _count.value = 5;
    expect(count.value).toBe(5);
  });

  it('provides peek method', async () => {
    const { readonly, signal } = await import('../src/reactive/signal');
    const _count = signal(10);
    const count = readonly(_count);

    expect(count.peek()).toBe(10);
  });
});

describe('linkedSignal', () => {
  it('derives value from linked signals', async () => {
    const { linkedSignal, signal } = await import('../src/reactive/signal');
    const first = signal('Ada');
    const last = signal('Lovelace');
    const fullName = linkedSignal(
      () => `${first.value} ${last.value}`,
      (next) => {
        const [nextFirst, nextLast] = next.split(' ');
        first.value = nextFirst ?? '';
        last.value = nextLast ?? '';
      }
    );

    expect(fullName.value).toBe('Ada Lovelace');
    first.value = 'Grace';
    expect(fullName.value).toBe('Grace Lovelace');
  });

  it('writes through to source signals', async () => {
    const { linkedSignal, signal } = await import('../src/reactive/signal');
    const first = signal('Ada');
    const last = signal('Lovelace');
    const fullName = linkedSignal(
      () => `${first.value} ${last.value}`,
      (next) => {
        const [nextFirst, nextLast] = next.split(' ');
        first.value = nextFirst ?? '';
        last.value = nextLast ?? '';
      }
    );

    fullName.value = 'Grace Hopper';
    expect(first.value).toBe('Grace');
    expect(last.value).toBe('Hopper');
  });
});

describe('untrack', () => {
  it('prevents dependency tracking', async () => {
    const { untrack, signal, effect } = await import('../src/reactive/signal');
    const tracked = signal(0);
    const untracked = signal(0);
    let runs = 0;

    effect(() => {
      // This creates a dependency
      void tracked.value;
      // This does NOT create a dependency
      untrack(() => untracked.value);
      runs++;
    });

    expect(runs).toBe(1);

    // Changes to tracked signal trigger effect
    tracked.value = 1;
    expect(runs).toBe(2);

    // Changes to untracked signal do NOT trigger effect
    untracked.value = 1;
    expect(runs).toBe(2);
  });

  it('prevents dependency tracking for computed values', async () => {
    const { untrack, signal, computed, effect } = await import('../src/reactive/signal');
    const source = signal(0);
    const derived = computed(() => source.value * 2);
    let runs = 0;

    effect(() => {
      // Reading computed inside untrack should NOT create a dependency
      untrack(() => derived.value);
      runs++;
    });

    expect(runs).toBe(1);

    // Changes to source signal should NOT trigger effect (computed was read via untrack)
    source.value = 1;
    expect(runs).toBe(1);
  });

  it('allows nested computed to still track its own dependencies', async () => {
    const { untrack, signal, computed } = await import('../src/reactive/signal');
    const source = signal(1);
    let computeCount = 0;

    // Create a computed that depends on source
    const derived = computed(() => {
      computeCount++;
      return source.value * 10;
    });

    // First access inside untrack - should still allow computed to track its deps
    const result1 = untrack(() => derived.value);
    expect(result1).toBe(10);
    expect(computeCount).toBe(1);

    // Change source - computed should know it's dirty because it tracked source
    source.value = 2;

    // Access again inside untrack - should recompute with new value
    const result2 = untrack(() => derived.value);
    expect(result2).toBe(20);
    expect(computeCount).toBe(2);

    // Access outside untrack - computed should still work normally
    expect(derived.value).toBe(20);
    expect(computeCount).toBe(2); // cached, no recompute
  });
});

describe('isSignal / isComputed', () => {
  it('identifies signals correctly', async () => {
    const { isSignal, signal, computed } = await import('../src/reactive/signal');
    const sig = signal(0);
    const comp = computed(() => sig.value * 2);

    expect(isSignal(sig)).toBe(true);
    expect(isSignal(comp)).toBe(false);
    expect(isSignal(42)).toBe(false);
    expect(isSignal(null)).toBe(false);
  });

  it('identifies computed correctly', async () => {
    const { isComputed, signal, computed } = await import('../src/reactive/signal');
    const sig = signal(0);
    const comp = computed(() => sig.value * 2);

    expect(isComputed(comp)).toBe(true);
    expect(isComputed(sig)).toBe(false);
    expect(isComputed({})).toBe(false);
  });
});

describe('persistedSignal', () => {
  it('persists to localStorage when available', async () => {
    const { persistedSignal } = await import('../src/reactive/signal');
    const key = 'test-persisted-signal';

    // Clean up any existing value
    localStorage.removeItem(key);

    const count = persistedSignal(key, 0);
    expect(count.value).toBe(0);

    // Update should persist
    count.value = 42;
    expect(localStorage.getItem(key)).toBe('42');

    // Clean up
    localStorage.removeItem(key);
  });

  it('loads initial value from localStorage if exists', async () => {
    const { persistedSignal } = await import('../src/reactive/signal');
    const key = 'test-persisted-initial';

    // Pre-populate storage
    localStorage.setItem(key, JSON.stringify(123));

    const count = persistedSignal(key, 0);
    expect(count.value).toBe(123);

    // Clean up
    localStorage.removeItem(key);
  });

  it('falls back to in-memory signal when localStorage is unavailable', async () => {
    // Capture original property descriptor to restore properly
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

    try {
      // Temporarily hide localStorage to simulate SSR/unavailable environment
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        get: () => undefined,
      });

      const { persistedSignal } = await import('../src/reactive/persisted');
      const count = persistedSignal('test-fallback', 10);

      // Should still work as a normal signal
      expect(count.value).toBe(10);

      // Should be updatable
      count.value = 20;
      expect(count.value).toBe(20);
    } finally {
      // Restore localStorage with original descriptor
      if (originalDescriptor) {
        Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
      }
    }
  });

  it('handles JSON parse errors gracefully', async () => {
    const { persistedSignal } = await import('../src/reactive/signal');
    const key = 'test-parse-error';

    // Set invalid JSON
    localStorage.setItem(key, 'invalid-json-{[}');

    // Should fall back to initial value
    const count = persistedSignal(key, 42);
    expect(count.value).toBe(42);

    // Clean up
    localStorage.removeItem(key);
  });

  it('handles Safari private mode SecurityError gracefully', async () => {
    // Capture original property descriptor to restore properly
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

    try {
      // Simulate Safari private mode where accessing localStorage or calling methods throws
      const mockStorage = {
        getItem: () => {
          throw new DOMException('SecurityError', 'SecurityError');
        },
        setItem: () => {
          throw new DOMException('SecurityError', 'SecurityError');
        },
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 0,
      };

      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        get: () => mockStorage,
      });

      const { persistedSignal } = await import('../src/reactive/persisted');
      const count = persistedSignal('test-safari-private', 100);

      // Should still work as a normal signal despite localStorage throwing
      expect(count.value).toBe(100);

      // Should be updatable
      count.value = 200;
      expect(count.value).toBe(200);
    } finally {
      // Restore localStorage with original descriptor
      if (originalDescriptor) {
        Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
      }
    }
  });
});

describe('signal dispose', () => {
  it('dispose clears all subscribers', () => {
    const count = signal(0);
    let effectRuns = 0;

    effect(() => {
      void count.value;
      effectRuns++;
    });

    expect(effectRuns).toBe(1);

    count.dispose();
    count.value = 1;

    // Effect should not run again after dispose
    expect(effectRuns).toBe(1);
  });

  it('dispose allows value to still be read', () => {
    const count = signal(42);
    count.dispose();

    expect(count.value).toBe(42);
    expect(count.peek()).toBe(42);
  });
});

describe('effect error handling', () => {
  it('effect catches errors and continues working', () => {
    const count = signal(0);
    let errorLogged = false;
    let effectRanAfterError = false;
    const originalError = console.error;
    console.error = () => {
      errorLogged = true;
    };

    try {
      const dispose = effect(() => {
        if (count.value === 1) {
          throw new Error('test error');
        }
        if (count.value === 2) {
          effectRanAfterError = true;
        }
      });

      count.value = 1; // Should trigger error but not crash
      expect(errorLogged).toBe(true);

      count.value = 2; // Should still work after the error
      expect(effectRanAfterError).toBe(true);

      dispose();
    } finally {
      console.error = originalError;
    }
  });
});

describe('useAsyncData', () => {
  it('tracks async state transitions and transforms results', async () => {
    const state = useAsyncData(
      async () => {
        return { value: 21 };
      },
      {
        transform: (result) => result.value * 2,
      }
    );

    expect(state.status.value).toBe('pending');

    const result = await state.execute();
    expect(result).toBe(42);
    expect(state.data.value).toBe(42);
    expect(state.error.value).toBeNull();
    expect(state.status.value).toBe('success');
    expect(state.pending.value).toBe(false);
  });

  it('refreshes when watched signals change', async () => {
    const endpoint = signal('/first');
    const seen: string[] = [];
    const state = useAsyncData(
      async () => {
        seen.push(endpoint.value);
        return endpoint.value;
      },
      {
        immediate: false,
        watch: [endpoint],
      }
    );

    expect(seen).toEqual([]);

    endpoint.value = '/second';
    await Promise.resolve();

    expect(seen).toEqual(['/second']);
    expect(state.data.value).toBe('/second');
  });

  it('disposes watched refresh effects', async () => {
    const endpoint = signal('/first');
    const seen: string[] = [];
    const state = useAsyncData(
      async () => {
        seen.push(endpoint.value);
        return endpoint.value;
      },
      {
        immediate: false,
        watch: [endpoint],
      }
    );

    endpoint.value = '/second';
    await Promise.resolve();

    expect(seen).toEqual(['/second']);
    expect(state.data.value).toBe('/second');

    state.dispose();
    endpoint.value = '/third';
    await Promise.resolve();

    expect(seen).toEqual(['/second']);
    expect(state.data.value).toBe('/second');

    const resultAfterDispose = await state.execute();
    expect(resultAfterDispose).toBe('/second');
    expect(seen).toEqual(['/second']);
  });

  it('tracks only explicit watch sources during watched refreshes', async () => {
    const endpoint = signal('/first');
    const dependency = signal('alpha');
    const seen: string[] = [];

    const state = useAsyncData(
      async () => {
        seen.push(`${endpoint.value}:${dependency.value}`);
        return dependency.value;
      },
      {
        immediate: false,
        watch: [endpoint],
      }
    );

    expect(state.status.value).toBe('idle');
    expect(state.data.value).toBeUndefined();
    expect(state.error.value).toBeNull();

    endpoint.value = '/second';
    await Promise.resolve();

    expect(seen).toEqual(['/second:alpha']);

    dependency.value = 'beta';
    await Promise.resolve();

    expect(seen).toEqual(['/second:alpha']);

    endpoint.value = '/third';
    await Promise.resolve();

    expect(seen).toEqual(['/second:alpha', '/third:beta']);
  });
});

describe('useFetch', () => {
  it('fetches JSON and appends query parameters', async () => {
    const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const state = useFetch<{ ok: boolean; search: string }>('/api/users', {
      immediate: false,
      query: { page: 2, tags: ['a', 'b'] },
      fetcher: asMockFetch(async (input, init) => {
        requests.push({ input, init });
        return new Response(JSON.stringify({ ok: true, search: String(input) }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    });

    const result = await state.execute();

    expect(result?.ok).toBe(true);
    expect(result?.search).toContain('page=2');
    expect(result?.search).toContain('tags=a');
    expect(result?.search).toContain('tags=b');
    expect(requests).toHaveLength(1);
  });

  it('serializes plain object bodies as JSON', async () => {
    let body = '';
    let contentType = '';

    const state = useFetch<{ saved: boolean }>('/api/save', {
      immediate: false,
      method: 'POST',
      body: { name: 'Ada' },
      fetcher: asMockFetch(async (_input, init) => {
        body = String(init?.body);
        contentType = new Headers(init?.headers).get('content-type') ?? '';
        return new Response(JSON.stringify({ saved: true }), { status: 200 });
      }),
    });

    await state.execute();

    expect(body).toBe(JSON.stringify({ name: 'Ada' }));
    expect(contentType).toBe('application/json');
  });

  it('creates fresh headers for each execution when serializing JSON bodies', async () => {
    const contentTypes: string[] = [];
    const state = useFetch<{ saved: boolean }>('/api/save', {
      immediate: false,
      method: 'POST',
      body: { name: 'Ada' },
      headers: { 'x-test': '1' },
      fetcher: asMockFetch(async (_input, init) => {
        const headers = init?.headers;
        expect(headers).toBeInstanceOf(Headers);
        const requestHeaders = headers as Headers;
        contentTypes.push(requestHeaders.get('content-type') ?? '');
        requestHeaders.delete('content-type');
        return new Response(JSON.stringify({ saved: true }), { status: 200 });
      }),
    });

    await state.execute();
    await state.execute();

    expect(contentTypes).toEqual(['application/json', 'application/json']);
  });

  it('preserves existing headers when input is a Request', async () => {
    let capturedContentType = '';
    let capturedRequestId = '';
    let capturedAuth = '';

    const request = new Request('https://example.com/api/save', {
      method: 'POST',
      headers: {
        authorization: 'Bearer request-token',
        'content-type': 'text/plain',
      },
      body: 'existing body',
    });

    const state = useFetch<{ saved: boolean }>(request, {
      immediate: false,
      headers: { 'x-request-id': '123' },
      fetcher: asMockFetch(async (_input, init) => {
        const headers = new Headers(init?.headers);
        capturedContentType = headers.get('content-type') ?? '';
        capturedRequestId = headers.get('x-request-id') ?? '';
        capturedAuth = headers.get('authorization') ?? '';
        return new Response(JSON.stringify({ saved: true }), { status: 200 });
      }),
    });

    await state.execute();

    expect(capturedContentType).toBe('text/plain');
    expect(capturedRequestId).toBe('123');
    expect(capturedAuth).toBe('Bearer request-token');
  });

  it('treats global fetch config headers as defaults for Request inputs', async () => {
    const { defineBqueryConfig, getBqueryConfig } = await import('../src/platform/index');
    const previousConfig = getBqueryConfig();
    let capturedContentType = '';
    let capturedAuth = '';
    let capturedConfigHeader = '';
    let capturedRequestId = '';

    defineBqueryConfig({
      fetch: {
        headers: {
          authorization: 'Bearer config-token',
          'content-type': 'application/json',
          'x-config': '1',
        },
      },
    });

    try {
      const request = new Request('https://example.com/api/save', {
        method: 'POST',
        headers: {
          authorization: 'Bearer request-token',
          'content-type': 'text/plain',
        },
        body: 'existing body',
      });

      const state = useFetch<{ saved: boolean }>(request, {
        immediate: false,
        headers: { 'x-request-id': '123' },
        fetcher: asMockFetch(async (_input, init) => {
          const headers = new Headers(init?.headers);
          capturedContentType = headers.get('content-type') ?? '';
          capturedAuth = headers.get('authorization') ?? '';
          capturedConfigHeader = headers.get('x-config') ?? '';
          capturedRequestId = headers.get('x-request-id') ?? '';
          return new Response(JSON.stringify({ saved: true }), { status: 200 });
        }),
      });

      await state.execute();
    } finally {
      defineBqueryConfig(previousConfig);
    }

    expect(capturedContentType).toBe('text/plain');
    expect(capturedAuth).toBe('Bearer request-token');
    expect(capturedConfigHeader).toBe('1');
    expect(capturedRequestId).toBe('123');
  });

  it('applies query parameters when input is a Request', async () => {
    let capturedUrl = '';
    let capturedAuth = '';
    let capturedExtra = '';

    const request = new Request('https://example.com/api/users?existing=1', {
      headers: { authorization: 'Bearer token' },
    });

    const state = useFetch<{ ok: boolean }>(request, {
      immediate: false,
      query: { page: 2, tags: ['a', 'hello world'] },
      headers: { 'x-extra': '123' },
      fetcher: asMockFetch(async (input, init) => {
        capturedUrl = input instanceof Request ? input.url : String(input);
        const headers = new Headers(init?.headers);
        capturedAuth = headers.get('authorization') ?? '';
        capturedExtra = headers.get('x-extra') ?? '';
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    });

    await state.execute();

    expect(capturedUrl).toBe(
      'https://example.com/api/users?existing=1&page=2&tags=a&tags=hello+world'
    );
    expect(capturedAuth).toBe('Bearer token');
    expect(capturedExtra).toBe('123');
  });

  it('preserves the original Request URL when no query parameters are provided', async () => {
    let capturedUrl = '';
    let capturedInput: Request | null = null;

    const request = new Request('https://example.com/api/users?existing=1');
    const state = useFetch<{ ok: boolean }>(request, {
      immediate: false,
      fetcher: asMockFetch(async (input) => {
        capturedInput = input as Request;
        capturedUrl = input instanceof Request ? input.url : String(input);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    });

    await state.execute();

    expect(capturedUrl).toBe('https://example.com/api/users?existing=1');
    expect(capturedInput === request).toBe(true);
  });

  it('resolves relative base URLs against the runtime base URL', async () => {
    let capturedUrl = '';

    const state = useFetch<{ ok: boolean }>('users', {
      baseUrl: '/api/',
      immediate: false,
      fetcher: asMockFetch(async (input) => {
        capturedUrl = String(input);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    });

    await state.execute();

    expect(capturedUrl).toBe('http://localhost/api/users');
    expect(state.data.value).toEqual({ ok: true });
  });

  it('preserves absolute base URLs when resolving request URLs', async () => {
    let capturedUrl = '';

    const state = useFetch<{ ok: boolean }>('users', {
      baseUrl: 'https://example.com/api/',
      immediate: false,
      fetcher: asMockFetch(async (input) => {
        capturedUrl = String(input);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    });

    await state.execute();

    expect(capturedUrl).toBe('https://example.com/api/users');
    expect(state.status.value).toBe('success');
    expect(state.data.value).toEqual({ ok: true });
  });

  it('returns the cached value after dispose()', async () => {
    const calls: string[] = [];
    const state = useFetch<{ ok: boolean }>('/api/users', {
      immediate: false,
      fetcher: asMockFetch(async () => {
        calls.push('fetch');
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    });

    const initial = await state.execute();
    expect(initial?.ok).toBe(true);
    expect(calls).toEqual(['fetch']);

    state.dispose();

    const resultAfterDispose = await state.execute();
    expect(resultAfterDispose?.ok).toBe(true);
    expect(calls).toEqual(['fetch']);
  });

  it('defaults to POST when a body is provided without an explicit method', async () => {
    let capturedMethod = '';

    const state = useFetch<{ ok: boolean }>('/api/users', {
      immediate: false,
      body: { saved: true },
      fetcher: asMockFetch(async (_input, init) => {
        capturedMethod = init?.method ?? '';
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    });

    await state.execute();

    expect(capturedMethod).toBe('POST');
    expect(state.status.value).toBe('success');
  });

  it('normalizes mixed-case methods and treats whitespace-only methods as unspecified', async () => {
    let normalizedMethod = '';
    let defaultedMethod = '';

    const normalized = useFetch<{ ok: boolean }>('/api/users', {
      immediate: false,
      method: ' PoSt ',
      body: { saved: true },
      fetcher: asMockFetch(async (_input, init) => {
        normalizedMethod = init?.method ?? '';
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    });

    const defaulted = useFetch<{ ok: boolean }>('/api/users', {
      immediate: false,
      method: '   ',
      body: { saved: true },
      fetcher: asMockFetch(async (_input, init) => {
        defaultedMethod = init?.method ?? '';
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    });

    await normalized.execute();
    await defaulted.execute();

    expect(normalizedMethod).toBe('POST');
    expect(defaultedMethod).toBe('POST');
  });

  it('stores a clear error when a GET request is given a body', async () => {
    let calls = 0;
    const state = useFetch<{ ok: boolean }>('/api/users', {
      immediate: false,
      method: 'GET',
      body: { invalid: true },
      fetcher: asMockFetch(async () => {
        calls += 1;
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    });

    const result = await state.execute();

    expect(result).toBeUndefined();
    expect(state.status.value).toBe('error');
    expect(state.error.value?.message).toBe('Cannot send a request body with GET requests');
    expect(calls).toBe(0);
  });

  it('stores a clear error when a HEAD request is given a body', async () => {
    const state = useFetch<{ ok: boolean }>('/api/users', {
      immediate: false,
      method: 'HEAD',
      body: { invalid: true },
    });

    const result = await state.execute();

    expect(result).toBeUndefined();
    expect(state.status.value).toBe('error');
    expect(state.error.value?.message).toBe('Cannot send a request body with HEAD requests');
  });
});

describe('createUseFetch', () => {
  it('applies shared defaults to derived useFetch instances', async () => {
    const useApiFetch = createUseFetch<{ ok: boolean; url: string }>({
      baseUrl: 'https://example.com',
      headers: { 'x-default': '1' },
      immediate: false,
      fetcher: asMockFetch(async (input, init) => {
        expect(String(input)).toContain('https://example.com/users');
        expect(new Headers(init?.headers).get('x-default')).toBe('1');
        expect(new Headers(init?.headers).get('x-extra')).toBe('2');
        return new Response(JSON.stringify({ ok: true, url: String(input) }), { status: 200 });
      }),
    });

    const state = useApiFetch('/users', {
      headers: { 'x-extra': '2' },
    });

    const result = await state.execute();
    expect(result?.ok).toBe(true);
  });

  it('allows response types to be specified per invocation', async () => {
    const requests: string[] = [];
    const useApiFetch = createUseFetch({
      baseUrl: 'https://example.com',
      immediate: false,
      fetcher: asMockFetch(async (input) => {
        requests.push(String(input));

        if (String(input).includes('/users')) {
          return new Response(JSON.stringify([{ id: 1, name: 'Ada' }]), { status: 200 });
        }

        return new Response(JSON.stringify([{ id: 2, title: 'Hello' }]), { status: 200 });
      }),
    });

    const users = useApiFetch<Array<{ id: number; name: string }>>('/users');
    const posts = useApiFetch<Array<{ id: number; title: string }>>('/posts');

    const [userResult, postResult] = await Promise.all([users.execute(), posts.execute()]);

    expect(userResult?.[0]?.name).toBe('Ada');
    expect(postResult?.[0]?.title).toBe('Hello');
    expect(requests).toEqual(['https://example.com/users', 'https://example.com/posts']);
  });

  it('preserves configured transform data types by default', async () => {
    const useApiFetch = createUseFetch<{ id: number; name: string }, string>({
      baseUrl: 'https://example.com',
      immediate: false,
      transform: (value) => value.name,
      fetcher: asMockFetch(
        async () =>
          new Response(JSON.stringify({ id: 1, name: 'Ada' }), {
            status: 200,
          })
      ),
    });

    const state = useApiFetch('/users');
    const execution: Promise<string | undefined> = state.execute();
    const currentValue: string | undefined = state.data.value;

    expect(currentValue).toBeUndefined();
    expect(await execution).toBe('Ada');
    expect(state.data.value).toBe('Ada');
    expect(state.status.value).toBe('success');
    expect(state.error.value).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// toValue
// ---------------------------------------------------------------------------

describe('toValue', () => {
  it('returns plain values as-is', () => {
    expect(toValue(42)).toBe(42);
    expect(toValue('hello')).toBe('hello');
    expect(toValue(null)).toBeNull();
    expect(toValue(undefined)).toBeUndefined();
    expect(toValue(true)).toBe(true);
    expect(toValue(false)).toBe(false);
  });

  it('unwraps a Signal', () => {
    const s = signal(10);
    expect(toValue(s)).toBe(10);
    s.value = 20;
    expect(toValue(s)).toBe(20);
  });

  it('unwraps a Computed', () => {
    const s = signal(3);
    const c = computed(() => s.value * 2);
    expect(toValue(c)).toBe(6);
    s.value = 5;
    expect(toValue(c)).toBe(10);
  });

  it('unwraps a ReadonlySignal', () => {
    const s = signal(7);
    const ro = readonly(s);

    expect(toValue(ro)).toBe(7);
    s.value = 9;
    expect(toValue(ro)).toBe(9);
  });

  it('only narrows readonly wrappers created by readonly()', () => {
    const wrapped = readonly(signal(1));
    const computedValue = computed(() => 2);

    expect(isReadonlySignal(wrapped)).toBe(true);
    expect(isReadonlySignal(computedValue)).toBe(false);
  });

  it('does not unwrap unrelated objects that happen to have value and peek', () => {
    type DomainObject = {
      value: number;
      peek: () => number;
      label: string;
    };

    const domainObject = {
      value: 123,
      peek: () => 123,
      label: 'not a readonly signal',
    } satisfies DomainObject;
    const result = toValue<DomainObject>(domainObject);

    expect(result).toBe(domainObject);
    expect(result.label).toBe('not a readonly signal');
  });

  it('does not unwrap objects that inherit the readonly brand through the prototype chain', () => {
    const wrapped = readonly(signal(5));
    const inheritedWrapper = Object.create(wrapped) as ReadonlySignal<number>;

    expect(isReadonlySignal(inheritedWrapper)).toBe(false);
    expect(toValue<ReadonlySignal<number>>(inheritedWrapper)).toBe(inheritedWrapper);
  });

  it('participates in reactive tracking', () => {
    const s = signal(1);
    let tracked = 0;
    effect(() => {
      toValue(s);
      tracked++;
    });
    expect(tracked).toBe(1);
    s.value = 2;
    expect(tracked).toBe(2);
  });

  it('handles complex objects', () => {
    const obj = { a: 1, b: [2, 3] };
    expect(toValue(obj)).toBe(obj);
    const objSignal = signal(obj);
    expect(toValue(objSignal)).toBe(obj);
  });

  it('handles zero and empty string', () => {
    expect(toValue(0)).toBe(0);
    expect(toValue('')).toBe('');
    const zeroSignal = signal(0);
    expect(toValue(zeroSignal)).toBe(0);
  });

  it('satisfies MaybeSignal type constraint', () => {
    const plainVal: MaybeSignal<number> = 5;
    const sigVal: MaybeSignal<number> = signal(5);
    const readonlyVal: MaybeSignal<number> = readonly(signal(5));
    const compVal: MaybeSignal<number> = computed(() => 5);
    expect(toValue(plainVal)).toBe(5);
    expect(toValue(sigVal)).toBe(5);
    expect(toValue(readonlyVal)).toBe(5);
    expect(toValue(compVal)).toBe(5);
  });

  it('does not accept structural ReadonlySignal objects as MaybeSignal inputs', () => {
    const structuralReadonly = {
      value: 1,
      peek: () => 1,
    } satisfies ReadonlySignal<number>;
    const readMaybeSignal = (input: MaybeSignal<number>) => input;

    // @ts-expect-error MaybeSignal only accepts readonly() wrappers, not arbitrary structural values
    readMaybeSignal(structuralReadonly);

    expect(toValue<typeof structuralReadonly>(structuralReadonly)).toBe(structuralReadonly);
    expect(toValue<typeof structuralReadonly>(structuralReadonly).value).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// isSignal / isComputed (edge cases)
// ---------------------------------------------------------------------------

describe('type guards edge cases', () => {
  it('isSignal rejects non-signal objects', () => {
    expect(isSignal(null)).toBe(false);
    expect(isSignal(undefined)).toBe(false);
    expect(isSignal(42)).toBe(false);
    expect(isSignal({ value: 1 })).toBe(false);
    expect(isSignal(computed(() => 1))).toBe(false);
  });

  it('isComputed rejects non-computed objects', () => {
    expect(isComputed(null)).toBe(false);
    expect(isComputed(undefined)).toBe(false);
    expect(isComputed(42)).toBe(false);
    expect(isComputed({ value: 1 })).toBe(false);
    expect(isComputed(signal(1))).toBe(false);
  });

  it('isSignal returns true for Signal instances', () => {
    expect(isSignal(signal(1))).toBe(true);
  });

  it('isComputed returns true for Computed instances', () => {
    expect(isComputed(computed(() => 1))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// effectScope
// ---------------------------------------------------------------------------

describe('effectScope', () => {
  it('creates an active scope', () => {
    const scope = effectScope();
    expect(scope.active).toBe(true);
  });

  it('stops and marks scope inactive', () => {
    const scope = effectScope();
    scope.stop();
    expect(scope.active).toBe(false);
  });

  it('stop is a safe no-op when called twice', () => {
    const scope = effectScope();
    scope.stop();
    scope.stop(); // should not throw
    expect(scope.active).toBe(false);
  });

  it('run returns the function return value', () => {
    const scope = effectScope();
    const result = scope.run(() => 42);
    expect(result).toBe(42);
    scope.stop();
  });

  it('throws when run receives an async callback', () => {
    const scope = effectScope();
    let invoked = false;

    expect(() =>
      scope.run(async () => {
        invoked = true;
        await Promise.resolve();
      })
    ).toThrow('effectScope.run() only supports synchronous callbacks');
    expect(invoked).toBe(false);
  });

  it('stops synchronously collected resources when run returns a promise-like value', () => {
    const scope = effectScope();
    const count = signal(0);
    let runs = 0;

    expect(() =>
      scope.run(() => {
        effect(() => {
          void count.value;
          runs++;
        });

        return Promise.resolve();
      })
    ).toThrow('effectScope.run() only supports synchronous callbacks');

    expect(scope.active).toBe(false);
    expect(runs).toBe(1);

    count.value = 1;
    expect(runs).toBe(1);
  });

  it('throws when running inside a stopped scope', () => {
    const scope = effectScope();
    scope.stop();
    expect(() => scope.run(() => {})).toThrow('Cannot run in a stopped effectScope');
  });

  // -----------------------------------------------------------------------
  // Effect collection
  // -----------------------------------------------------------------------

  it('collects effects and disposes them on stop', () => {
    const scope = effectScope();
    const count = signal(0);
    let runs = 0;

    scope.run(() => {
      effect(() => {
        void count.value;
        runs++;
      });
    });

    expect(runs).toBe(1);
    count.value = 1;
    expect(runs).toBe(2);

    scope.stop();

    // After stop, effect should no longer react
    count.value = 2;
    expect(runs).toBe(2);
  });

  it('disposes an effect when the scope stops during the initial synchronous run', () => {
    const scope = effectScope();
    const count = signal(0);
    let runs = 0;

    scope.run(() => {
      effect(() => {
        void count.value;
        runs++;

        if (runs === 1) {
          scope.stop();
        }
      });
    });

    expect(scope.active).toBe(false);
    expect(runs).toBe(1);

    count.value = 1;
    expect(runs).toBe(1);
  });

  it('collects multiple effects', () => {
    const scope = effectScope();
    const a = signal(0);
    const b = signal(0);
    let runsA = 0;
    let runsB = 0;

    scope.run(() => {
      effect(() => { void a.value; runsA++; });
      effect(() => { void b.value; runsB++; });
    });

    expect(runsA).toBe(1);
    expect(runsB).toBe(1);

    a.value = 1;
    b.value = 1;
    expect(runsA).toBe(2);
    expect(runsB).toBe(2);

    scope.stop();

    a.value = 2;
    b.value = 2;
    expect(runsA).toBe(2);
    expect(runsB).toBe(2);
  });

  // -----------------------------------------------------------------------
  // Computed collection
  // -----------------------------------------------------------------------

  it('collects computed values and disposes them on stop', () => {
    const scope = effectScope();
    const count = signal(1);
    let c: ReturnType<typeof computed<number>> | undefined;

    scope.run(() => {
      c = computed(() => count.value * 2);
    });

    expect(c!.value).toBe(2);
    count.value = 5;
    expect(c!.value).toBe(10);

    scope.stop();

    // After dispose, computed returns last cached value and no longer updates
    count.value = 100;
    expect(c!.value).toBe(10);
  });

  // -----------------------------------------------------------------------
  // Watch collection
  // -----------------------------------------------------------------------

  it('collects watches and disposes them on stop', () => {
    const scope = effectScope();
    const count = signal(0);
    const values: number[] = [];

    scope.run(() => {
      watchFn(count, (v: number) => values.push(v));
    });

    count.value = 1;
    expect(values).toEqual([1]);

    scope.stop();

    count.value = 2;
    expect(values).toEqual([1]); // watch stopped
  });

  // -----------------------------------------------------------------------
  // onScopeDispose
  // -----------------------------------------------------------------------

  it('runs onScopeDispose callbacks on stop', () => {
    const scope = effectScope();
    let disposed = false;

    scope.run(() => {
      onScopeDispose(() => {
        disposed = true;
      });
    });

    expect(disposed).toBe(false);
    scope.stop();
    expect(disposed).toBe(true);
  });

  it('runs multiple onScopeDispose callbacks in reverse order', () => {
    const scope = effectScope();
    const order: number[] = [];

    scope.run(() => {
      onScopeDispose(() => order.push(1));
      onScopeDispose(() => order.push(2));
      onScopeDispose(() => order.push(3));
    });

    scope.stop();
    expect(order).toEqual([3, 2, 1]);
  });

  it('throws when onScopeDispose is called outside a scope', () => {
    expect(() => onScopeDispose(() => {})).toThrow(
      'onScopeDispose() must be called inside an active effectScope'
    );
  });

  it('throws when onScopeDispose is called after the current scope is stopped', () => {
    const scope = effectScope();

    expect(() =>
      scope.run(() => {
        scope.stop();
        onScopeDispose(() => {});
      })
    ).toThrow('onScopeDispose() must be called inside an active effectScope');
  });

  // -----------------------------------------------------------------------
  // getCurrentScope
  // -----------------------------------------------------------------------

  it('getCurrentScope returns the active scope inside run', () => {
    const scope = effectScope();
    let captured: EffectScope | undefined;

    scope.run(() => {
      captured = getCurrentScope();
    });

    expect(captured).toBe(scope);
  });

  it('getCurrentScope returns undefined outside any scope', () => {
    expect(getCurrentScope()).toBeUndefined();
  });

  it('getCurrentScope reflects the innermost scope when nested', () => {
    const outer = effectScope();
    const inner = effectScope();
    let outerCaptured: EffectScope | undefined;
    let innerCaptured: EffectScope | undefined;

    outer.run(() => {
      outerCaptured = getCurrentScope();
      inner.run(() => {
        innerCaptured = getCurrentScope();
      });
    });

    expect(outerCaptured).toBe(outer);
    expect(innerCaptured).toBe(inner);
  });

  it('getCurrentScope falls back to the nearest active parent after an inner scope stops', () => {
    const outer = effectScope();
    const inner = effectScope();
    const count = signal(0);
    let capturedAfterInnerStop: EffectScope | undefined;
    let outerRuns = 0;

    outer.run(() => {
      inner.run(() => {
        inner.stop();
        capturedAfterInnerStop = getCurrentScope();
        effect(() => {
          void count.value;
          outerRuns++;
        });
      });
    });

    expect(capturedAfterInnerStop).toBe(outer);
    expect(outerRuns).toBe(1);

    outer.stop();
    count.value = 1;

    expect(outerRuns).toBe(1);
  });

  // -----------------------------------------------------------------------
  // Nested scopes
  // -----------------------------------------------------------------------

  it('nested scopes are collected by parent and disposed together', () => {
    const parent = effectScope();
    const count = signal(0);
    let childRuns = 0;

    parent.run(() => {
      const child = effectScope();
      child.run(() => {
        effect(() => {
          void count.value;
          childRuns++;
        });
      });
    });

    expect(childRuns).toBe(1);
    count.value = 1;
    expect(childRuns).toBe(2);

    parent.stop();

    count.value = 2;
    expect(childRuns).toBe(2); // child was stopped by parent
  });

  it('stopping parent stops deeply nested scopes', () => {
    const root = effectScope();
    const count = signal(0);
    let deepRuns = 0;

    root.run(() => {
      const level1 = effectScope();
      level1.run(() => {
        const level2 = effectScope();
        level2.run(() => {
          effect(() => {
            void count.value;
            deepRuns++;
          });
        });
      });
    });

    expect(deepRuns).toBe(1);
    count.value = 1;
    expect(deepRuns).toBe(2);

    root.stop();

    count.value = 2;
    expect(deepRuns).toBe(2);
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  it('effects created outside scope are NOT collected', () => {
    const count = signal(0);
    let runs = 0;

    const stop = effect(() => {
      void count.value;
      runs++;
    });

    expect(runs).toBe(1);
    count.value = 1;
    expect(runs).toBe(2);

    // Must be manually stopped
    stop();
    count.value = 2;
    expect(runs).toBe(2);
  });

  it('effect cleanup functions still run when scope stops', () => {
    const scope = effectScope();
    let cleanedUp = false;

    scope.run(() => {
      effect(() => {
        return () => {
          cleanedUp = true;
        };
      });
    });

    expect(cleanedUp).toBe(false);
    scope.stop();
    expect(cleanedUp).toBe(true);
  });

  it('errors in scope cleanup are caught and logged', () => {
    const scope = effectScope();
    const loggedMessages: string[] = [];
    const originalError = console.error;
    try {
      console.error = (message: string) => loggedMessages.push(message);

      scope.run(() => {
        onScopeDispose(() => {
          throw new Error('cleanup error');
        });
      });

      scope.stop();

      expect(loggedMessages.length).toBe(1);
      expect(loggedMessages[0]).toContain('Error in scope cleanup');
    } finally {
      console.error = originalError;
    }
  });

  it('scope.run can be called multiple times to collect more resources', () => {
    const scope = effectScope();
    const count = signal(0);
    let runsA = 0;
    let runsB = 0;

    scope.run(() => {
      effect(() => { void count.value; runsA++; });
    });

    scope.run(() => {
      effect(() => { void count.value; runsB++; });
    });

    count.value = 1;
    expect(runsA).toBe(2);
    expect(runsB).toBe(2);

    scope.stop();

    count.value = 2;
    expect(runsA).toBe(2);
    expect(runsB).toBe(2);
  });

  it('manually stopping an effect inside a scope is safe', () => {
    const scope = effectScope();
    const count = signal(0);
    let runs = 0;
    let manualStop: () => void;

    scope.run(() => {
      manualStop = effect(() => {
        void count.value;
        runs++;
      });
    });

    expect(runs).toBe(1);

    // Manual stop
    manualStop!();
    count.value = 1;
    expect(runs).toBe(1);

    // scope.stop() should not error (double-dispose is safe)
    scope.stop();
  });

  it('does not collect effects added after scope.stop()', () => {
    const scope = effectScope();
    const count = signal(0);
    let runs = 0;

    scope.stop();

    // Can't run anymore
    expect(() => scope.run(() => {
      effect(() => { void count.value; runs++; });
    })).toThrow();

    expect(runs).toBe(0);
  });

  it('batch and scope work correctly together', () => {
    const scope = effectScope();
    const a = signal(0);
    const b = signal(0);
    let runs = 0;

    scope.run(() => {
      effect(() => {
        void a.value;
        void b.value;
        runs++;
      });
    });

    expect(runs).toBe(1);

    batch(() => {
      a.value = 1;
      b.value = 1;
    });

    expect(runs).toBe(2); // One batched run

    scope.stop();

    batch(() => {
      a.value = 2;
      b.value = 2;
    });

    expect(runs).toBe(2); // No runs after stop
  });

  it('untrack inside scope still works', () => {
    const scope = effectScope();
    const tracked = signal(0);
    const untracked = signal(0);
    let runs = 0;

    scope.run(() => {
      effect(() => {
        void tracked.value;
        untrackedFn(() => untracked.value);
        runs++;
      });
    });

    expect(runs).toBe(1);

    untracked.value = 1; // Should not trigger
    expect(runs).toBe(1);

    tracked.value = 1; // Should trigger
    expect(runs).toBe(2);

    scope.stop();
  });
});
