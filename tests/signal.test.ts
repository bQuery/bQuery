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
