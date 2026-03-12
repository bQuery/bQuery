import { describe, expect, it } from 'bun:test';
import {
  batch,
  computed,
  createUseFetch,
  effect,
  signal,
  useAsyncData,
  useFetch,
} from '../src/reactive/signal';

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
      fetcher: async (input, init) => {
        requests.push({ input, init });
        return new Response(JSON.stringify({ ok: true, search: String(input) }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
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
      fetcher: async (_input, init) => {
        body = String(init?.body);
        contentType = new Headers(init?.headers).get('content-type') ?? '';
        return new Response(JSON.stringify({ saved: true }), { status: 200 });
      },
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
      fetcher: async (_input, init) => {
        const headers = init?.headers;
        expect(headers).toBeInstanceOf(Headers);
        const requestHeaders = headers as Headers;
        contentTypes.push(requestHeaders.get('content-type') ?? '');
        requestHeaders.delete('content-type');
        return new Response(JSON.stringify({ saved: true }), { status: 200 });
      },
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
      fetcher: async (_input, init) => {
        const headers = new Headers(init?.headers);
        capturedContentType = headers.get('content-type') ?? '';
        capturedRequestId = headers.get('x-request-id') ?? '';
        capturedAuth = headers.get('authorization') ?? '';
        return new Response(JSON.stringify({ saved: true }), { status: 200 });
      },
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
        fetcher: async (_input, init) => {
          const headers = new Headers(init?.headers);
          capturedContentType = headers.get('content-type') ?? '';
          capturedAuth = headers.get('authorization') ?? '';
          capturedConfigHeader = headers.get('x-config') ?? '';
          capturedRequestId = headers.get('x-request-id') ?? '';
          return new Response(JSON.stringify({ saved: true }), { status: 200 });
        },
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
      fetcher: async (input, init) => {
        capturedUrl = input instanceof Request ? input.url : String(input);
        const headers = new Headers(init?.headers);
        capturedAuth = headers.get('authorization') ?? '';
        capturedExtra = headers.get('x-extra') ?? '';
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
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
    let capturedInput: RequestInfo | URL | null = null;

    const request = new Request('https://example.com/api/users?existing=1');
    const state = useFetch<{ ok: boolean }>(request, {
      immediate: false,
      fetcher: async (input) => {
        capturedInput = input;
        capturedUrl = input instanceof Request ? input.url : String(input);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
    });

    await state.execute();

    expect(capturedUrl).toBe('https://example.com/api/users?existing=1');
    expect(capturedInput).toBe(request);
  });

  it('resolves relative base URLs against the runtime base URL', async () => {
    let capturedUrl = '';

    const state = useFetch<{ ok: boolean }>('users', {
      baseUrl: '/api/',
      immediate: false,
      fetcher: async (input) => {
        capturedUrl = String(input);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
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
      fetcher: async (input) => {
        capturedUrl = String(input);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
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
      fetcher: async () => {
        calls.push('fetch');
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
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
      fetcher: async (_input, init) => {
        capturedMethod = init?.method ?? '';
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
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
      fetcher: async (_input, init) => {
        normalizedMethod = init?.method ?? '';
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
    });

    const defaulted = useFetch<{ ok: boolean }>('/api/users', {
      immediate: false,
      method: '   ',
      body: { saved: true },
      fetcher: async (_input, init) => {
        defaultedMethod = init?.method ?? '';
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
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
      fetcher: async () => {
        calls += 1;
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
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
      fetcher: async (input, init) => {
        expect(String(input)).toContain('https://example.com/users');
        expect(new Headers(init?.headers).get('x-default')).toBe('1');
        expect(new Headers(init?.headers).get('x-extra')).toBe('2');
        return new Response(JSON.stringify({ ok: true, url: String(input) }), { status: 200 });
      },
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
      fetcher: async (input) => {
        requests.push(String(input));

        if (String(input).includes('/users')) {
          return new Response(JSON.stringify([{ id: 1, name: 'Ada' }]), { status: 200 });
        }

        return new Response(JSON.stringify([{ id: 2, title: 'Hello' }]), { status: 200 });
      },
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
      fetcher: async () =>
        new Response(JSON.stringify({ id: 1, name: 'Ada' }), {
          status: 200,
        }),
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
