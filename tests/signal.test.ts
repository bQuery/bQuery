import { describe, expect, it } from 'bun:test';
import { batch, computed, effect, signal } from '../src/reactive/signal';

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
