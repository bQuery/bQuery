/**
 * Store module tests
 */

import { beforeEach, describe, expect, it } from 'bun:test';
import { effect } from '../src/reactive/index';
import {
  createPersistedStore,
  createStore,
  defineStore,
  destroyStore,
  getStore,
  listStores,
  mapActions,
  mapGetters,
  mapState,
  watchStore,
} from '../src/store/index';

describe('Store', () => {
  beforeEach(() => {
    // Clean up any existing stores
    for (const id of listStores()) {
      destroyStore(id);
    }
  });

  describe('createStore', () => {
    it('should create a store with initial state', () => {
      const store = createStore({
        id: 'counter',
        state: () => ({ count: 0 }),
      });

      expect(store.count).toBe(0);
      expect(store.$id).toBe('counter');
    });

    it('should allow state mutations', () => {
      const store = createStore({
        id: 'counter',
        state: () => ({ count: 0 }),
      });

      store.count = 5;
      expect(store.count).toBe(5);
    });

    it('should trigger reactive updates on state change', () => {
      const store = createStore({
        id: 'counter',
        state: () => ({ count: 0 }),
      });

      const values: number[] = [];
      effect(() => {
        values.push(store.count as number);
      });

      store.count = 1;
      store.count = 2;

      expect(values).toEqual([0, 1, 2]);
    });

    it('should return existing store for same id', () => {
      const store1 = createStore({
        id: 'singleton',
        state: () => ({ value: 1 }),
      });

      const store2 = createStore({
        id: 'singleton',
        state: () => ({ value: 999 }),
      });

      expect(store1).toBe(store2);
      expect(store2.value).toBe(1);
    });
  });

  describe('getters', () => {
    it('should compute derived values', () => {
      const store = createStore({
        id: 'counter',
        state: () => ({ count: 5 }),
        getters: {
          doubled: (state) => (state.count as number) * 2,
          isPositive: (state) => (state.count as number) > 0,
        },
      });

      expect(store.doubled).toBe(10);
      expect(store.isPositive).toBe(true);
    });

    it('should update when state changes', () => {
      const store = createStore({
        id: 'counter',
        state: () => ({ count: 0 }),
        getters: {
          doubled: (state) => (state.count as number) * 2,
        },
      });

      expect(store.doubled).toBe(0);
      store.count = 7;
      expect(store.doubled).toBe(14);
    });
  });

  describe('actions', () => {
    it('should define callable actions', () => {
      const store = createStore({
        id: 'counter',
        state: () => ({ count: 0 }),
        actions: {
          increment() {
            (this as { count: number }).count++;
          },
          add(amount: number) {
            (this as { count: number }).count += amount;
          },
        },
      });

      store.increment();
      expect(store.count).toBe(1);

      store.add(10);
      expect(store.count).toBe(11);
    });

    it('should support async actions', async () => {
      const store = createStore({
        id: 'async',
        state: () => ({ data: null as string | null }),
        actions: {
          async fetchData() {
            await new Promise((r) => setTimeout(r, 10));
            (this as { data: string | null }).data = 'loaded';
          },
        },
      });

      expect(store.data).toBe(null);
      await store.fetchData();
      expect(store.data).toBe('loaded');
    });

    it('should allow non-state property assignments in actions without throwing', () => {
      const store = createStore({
        id: 'assignment-test',
        state: () => ({ count: 0 }),
        actions: {
          complexOperation() {
            // This should not throw TypeError in strict mode
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (this as any).tempVar = 'temporary';
            (this as { count: number }).count += 1;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (this as any).tempVar;
          },
        },
      });

      // Should not throw
      expect(() => store.complexOperation()).not.toThrow();
      expect(store.count).toBe(1);
    });
  });

  describe('$reset', () => {
    it('should reset state to initial values', () => {
      const store = createStore({
        id: 'counter',
        state: () => ({ count: 0, name: 'test' }),
      });

      store.count = 100;
      store.name = 'changed';

      store.$reset();

      expect(store.count).toBe(0);
      expect(store.name).toBe('test');
    });
  });

  describe('$patch', () => {
    it('should patch with partial object', () => {
      const store = createStore({
        id: 'user',
        state: () => ({ name: 'Alice', age: 30 }),
      });

      store.$patch({ age: 31 });

      expect(store.name).toBe('Alice');
      expect(store.age).toBe(31);
    });

    it('should patch with function', () => {
      const store = createStore({
        id: 'counter',
        state: () => ({ count: 0 }),
      });

      store.$patch((state) => {
        (state as { count: number }).count += 10;
      });

      expect(store.count).toBe(10);
    });
  });

  describe('$subscribe', () => {
    it('should call subscribers on state changes', () => {
      const store = createStore({
        id: 'counter',
        state: () => ({ count: 0 }),
      });

      const states: number[] = [];
      store.$subscribe((state) => {
        states.push(state.count as number);
      });

      store.count = 1;
      store.count = 2;

      expect(states).toEqual([1, 2]);
    });

    it('should allow unsubscribing', () => {
      const store = createStore({
        id: 'counter',
        state: () => ({ count: 0 }),
      });

      const states: number[] = [];
      const unsubscribe = store.$subscribe((state) => {
        states.push(state.count as number);
      });

      store.count = 1;
      unsubscribe();
      store.count = 2;

      expect(states).toEqual([1]);
    });

    it('should not create reactive dependencies when $state is accessed inside effect', () => {
      const store = createStore({
        id: 'counter',
        state: () => ({ count: 0 }),
      });

      let effectRunCount = 0;
      const stateSnapshots: Array<{ count: number }> = [];

      // Access $state inside an effect - this calls getCurrentState()
      // Without untrack(), this would register the effect as dependent on all store signals
      effect(() => {
        effectRunCount++;
        
        // Reading $state calls getCurrentState() which is wrapped in untrack()
        // This should NOT create a dependency on store signals
        const snapshot = store.$state;
        stateSnapshots.push(snapshot);
      });

      // Effect should run once on creation
      expect(effectRunCount).toBe(1);
      expect(stateSnapshots).toHaveLength(1);
      expect(stateSnapshots[0]).toEqual({ count: 0 });

      // Mutate store state
      store.count = 5;

      // Effect should NOT re-run due to store changes (no reactive dependency created)
      // because getCurrentState() is wrapped in untrack()
      expect(effectRunCount).toBe(1);
      expect(stateSnapshots).toHaveLength(1); // No new snapshots captured
    });
  });

  describe('$state', () => {
    it('should return current state snapshot', () => {
      const store = createStore({
        id: 'counter',
        state: () => ({ count: 5 }),
      });

      const snapshot = store.$state;
      expect(snapshot).toEqual({ count: 5 });
    });
  });

  describe('getStore', () => {
    it('should retrieve existing store by id', () => {
      createStore({
        id: 'mystore',
        state: () => ({ value: 42 }),
      });

      const retrieved = getStore<{ value: number }>('mystore');
      expect(retrieved?.value).toBe(42);
    });

    it('should return undefined for non-existent store', () => {
      const store = getStore('nonexistent');
      expect(store).toBeUndefined();
    });
  });

  describe('listStores', () => {
    it('should list all store ids', () => {
      createStore({ id: 'store1', state: () => ({}) });
      createStore({ id: 'store2', state: () => ({}) });

      const ids = listStores();
      expect(ids).toContain('store1');
      expect(ids).toContain('store2');
    });
  });

  describe('destroyStore', () => {
    it('should remove store from registry', () => {
      createStore({ id: 'temp', state: () => ({}) });
      expect(listStores()).toContain('temp');

      destroyStore('temp');
      expect(listStores()).not.toContain('temp');
    });
  });

  describe('mapState', () => {
    it('should map state properties', () => {
      const store = createStore({
        id: 'counter',
        state: () => ({ count: 5, name: 'test' }),
      });

      const mapped = mapState(store, ['count']);
      expect(mapped.count).toBe(5);

      store.count = 10;
      expect(mapped.count).toBe(10);
    });
  });

  describe('mapGetters', () => {
    it('should map getter properties', () => {
      const store = createStore({
        id: 'getter-map',
        state: () => ({ count: 2 }),
        getters: {
          doubled: (state) => (state.count as number) * 2,
        },
      });

      const mapped = mapGetters(store, ['doubled']);
      expect(mapped.doubled).toBe(4);

      store.count = 3;
      expect(mapped.doubled).toBe(6);
    });
  });

  describe('mapActions', () => {
    it('should map actions', () => {
      const store = createStore({
        id: 'counter',
        state: () => ({ count: 0 }),
        actions: {
          increment() {
            (this as { count: number }).count++;
          },
        },
      });

      const { increment } = mapActions(store, ['increment']);
      increment();
      expect(store.count).toBe(1);
    });
  });

  describe('watchStore', () => {
    it('should watch selected state changes', () => {
      const store = createStore({
        id: 'watcher',
        state: () => ({ count: 0 }),
      });

      const calls: Array<[number, number | undefined]> = [];
      const stop = watchStore(
        store,
        (state) => state.count as number,
        (value, previous) => {
          calls.push([value, previous]);
        },
        { immediate: true }
      );

      store.count = 2;
      stop();
      store.count = 3;

      expect(calls).toEqual([
        [0, undefined],
        [2, 0],
      ]);
    });
  });

  describe('defineStore', () => {
    it('should create a store factory', () => {
      const useCounter = defineStore('factory-counter', {
        state: () => ({ count: 0 }),
        actions: {
          increment() {
            (this as { count: number }).count++;
          },
        },
      });

      const counter = useCounter();
      counter.increment();
      expect(counter.count).toBe(1);
    });

    it('should cache and return the same store instance on multiple calls', () => {
      const useCachedStore = defineStore('cached-store', {
        state: () => ({ value: 0 }),
        actions: {
          setValue(val: number) {
            (this as { value: number }).value = val;
          },
        },
      });

      // Call the factory multiple times
      const instance1 = useCachedStore();
      const instance2 = useCachedStore();
      const instance3 = useCachedStore();

      // All should be the same instance
      expect(instance1).toBe(instance2);
      expect(instance2).toBe(instance3);

      // Changes to one should affect all (since they're the same instance)
      instance1.setValue(42);
      expect(instance2.value).toBe(42);
      expect(instance3.value).toBe(42);
    });
  });

  describe('createPersistedStore', () => {
    // Skip if localStorage is not available in test environment
    const hasLocalStorage = (() => {
      try {
        return typeof localStorage !== 'undefined';
      } catch {
        return false;
      }
    })();

    it.skipIf(!hasLocalStorage)('should create a store with persistence', () => {
      // Clear localStorage
      localStorage.removeItem('bquery-store-settings');

      const store = createPersistedStore({
        id: 'settings',
        state: () => ({ theme: 'dark' }),
      });

      expect(store.theme).toBe('dark');

      store.theme = 'light';

      // Check if saved to localStorage
      const saved = localStorage.getItem('bquery-store-settings');
      expect(saved).toBe('{"theme":"light"}');
    });

    it.skipIf(!hasLocalStorage)('should restore from localStorage', () => {
      localStorage.setItem('bquery-store-restored', '{"value":999}');

      const store = createPersistedStore({
        id: 'restored',
        state: () => ({ value: 0 }),
      });

      expect(store.value).toBe(999);
    });
  });

  describe('$patchDeep', () => {
    it('should deep clone nested objects for reactivity', () => {
      const store = createStore({
        id: 'nested',
        state: () => ({
          user: { name: 'Alice', address: { city: 'NYC' } },
        }),
      });

      const updates: string[] = [];
      effect(() => {
        updates.push((store.user as { name: string }).name);
      });

      // Use $patchDeep to ensure nested mutation triggers reactivity
      store.$patchDeep((state) => {
        (state.user as { name: string; address: { city: string } }).name = 'Bob';
      });

      expect((store.user as { name: string }).name).toBe('Bob');
      expect(updates).toEqual(['Alice', 'Bob']);
    });

    it('should handle partial object patches with deep cloning', () => {
      const store = createStore({
        id: 'nested-partial',
        state: () => ({
          config: { theme: 'dark', nested: { value: 1 } },
        }),
      });

      const originalConfig = store.config;

      store.$patchDeep({
        config: { theme: 'light', nested: { value: 2 } },
      });

      // Should be a new reference due to deep cloning
      expect(store.config).not.toBe(originalConfig);
      expect((store.config as { theme: string }).theme).toBe('light');
      expect((store.config as { nested: { value: number } }).nested.value).toBe(2);
    });

    it('should deep clone arrays', () => {
      const store = createStore({
        id: 'array-test',
        state: () => ({
          items: [{ id: 1, name: 'Item 1' }],
        }),
      });

      const originalItems = store.items;

      store.$patchDeep((state) => {
        (state.items as Array<{ id: number; name: string }>).push({ id: 2, name: 'Item 2' });
      });

      // Should be a new reference due to deep cloning
      expect(store.items).not.toBe(originalItems);
      expect((store.items as Array<{ id: number }>).length).toBe(2);
    });

    it('should trigger subscribers after deep patch', () => {
      const store = createStore({
        id: 'deep-subscribe',
        state: () => ({
          data: { value: 0 },
        }),
      });

      const states: number[] = [];
      store.$subscribe((state) => {
        states.push((state.data as { value: number }).value);
      });

      store.$patchDeep((state) => {
        (state.data as { value: number }).value = 42;
      });

      expect(states).toEqual([42]);
    });
  });
});
