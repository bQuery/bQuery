/**
 * Store module tests
 */

import { beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { effect } from '../src/reactive/index';
import type { StorageBackend } from '../src/store/index';
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
      const store = createStore<
        { count: number },
        Record<string, never>,
        { increment(): void; add(amount: number): void }
      >({
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
      const store = createStore<
        { data: string | null },
        Record<string, never>,
        { fetchData(): Promise<void> }
      >({
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
      const store = createStore<
        { count: number },
        Record<string, never>,
        { complexOperation(): string }
      >({
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

    it('should allow defineStore factory to create fresh instance after destroy', () => {
      const useStore = defineStore<
        { value: number },
        Record<string, never>,
        { setValue(val: number): void }
      >('destroy-test', {
        state: () => ({ value: 0 }),
        actions: {
          setValue(val: number) {
            (this as { value: number }).value = val;
          },
        },
      });

      // Create and mutate the first instance
      const instance1 = useStore();
      instance1.setValue(100);
      expect(instance1.value).toBe(100);

      // Destroy the store
      destroyStore('destroy-test');
      expect(listStores()).not.toContain('destroy-test');

      // Factory should create a fresh instance with initial state
      const instance2 = useStore();
      expect(instance2.value).toBe(0); // Fresh initial state
      expect(instance1).not.toBe(instance2); // Different instance
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
      const store = createStore<{ count: number }, Record<string, never>, { increment(): void }>({
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
      const useCounter = defineStore<
        { count: number },
        Record<string, never>,
        { increment(): void }
      >('factory-counter', {
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
      const useCachedStore = defineStore<
        { value: number },
        Record<string, never>,
        { setValue(val: number): void }
      >('cached-store', {
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

  describe('$onAction', () => {
    it('should call the listener before each action', () => {
      const store = createStore<
        { count: number },
        Record<string, never>,
        { increment(): void; add(n: number): void }
      >({
        id: 'on-action-before',
        state: () => ({ count: 0 }),
        actions: {
          increment() {
            (this as { count: number }).count++;
          },
          add(n: number) {
            (this as { count: number }).count += n;
          },
        },
      });

      const calls: Array<{ name: string; args: unknown[] }> = [];
      store.$onAction(({ name, args }) => {
        calls.push({ name, args });
      });

      store.increment();
      store.add(5);

      expect(calls).toEqual([
        { name: 'increment', args: [] },
        { name: 'add', args: [5] },
      ]);
    });

    it('should run after hooks when sync action succeeds', () => {
      const store = createStore<{ count: number }, Record<string, never>, { increment(): number }>({
        id: 'on-action-after',
        state: () => ({ count: 0 }),
        actions: {
          increment() {
            (this as { count: number }).count++;
            return (this as { count: number }).count;
          },
        },
      });

      const results: unknown[] = [];
      store.$onAction(({ after }) => {
        after((result) => results.push(result));
      });

      store.increment();
      store.increment();

      expect(results).toEqual([1, 2]);
    });

    it('should run onError hooks when sync action throws', () => {
      const store = createStore<{ count: number }, Record<string, never>, { fail(): void }>({
        id: 'on-action-error',
        state: () => ({ count: 0 }),
        actions: {
          fail() {
            throw new Error('boom');
          },
        },
      });

      const errors: unknown[] = [];
      store.$onAction(({ onError }) => {
        onError((e) => errors.push(e));
      });

      expect(() => store.fail()).toThrow('boom');
      expect(errors).toHaveLength(1);
      expect((errors[0] as Error).message).toBe('boom');
    });

    it('should run after hooks when async action resolves', async () => {
      const store = createStore<
        { data: string },
        Record<string, never>,
        { fetchData(): Promise<string> }
      >({
        id: 'on-action-async-ok',
        state: () => ({ data: '' }),
        actions: {
          async fetchData() {
            await new Promise((r) => setTimeout(r, 5));
            (this as { data: string }).data = 'loaded';
            return 'loaded';
          },
        },
      });

      const results: unknown[] = [];
      store.$onAction(({ after }) => {
        after((result) => results.push(result));
      });

      await store.fetchData();
      expect(results).toEqual(['loaded']);
    });

    it('should treat thenable action results as async for after hooks', async () => {
      const store = createStore<
        { count: number },
        Record<string, never>,
        { incrementAsync(): Promise<number> }
      >({
        id: 'on-action-thenable-ok',
        state: () => ({ count: 0 }),
        actions: {
          incrementAsync() {
            return {
              then: (resolve: (value: number) => void) => {
                (this as { count: number }).count++;
                resolve((this as { count: number }).count);
              },
            } as Promise<number>;
          },
        },
      });

      const results: unknown[] = [];
      store.$onAction(({ after }) => {
        after((result) => results.push(result));
      });

      await store.incrementAsync();
      expect(results).toEqual([1]);
    });

    it('should run onError hooks when async action rejects', async () => {
      const store = createStore<
        { data: string },
        Record<string, never>,
        { failAsync(): Promise<void> }
      >({
        id: 'on-action-async-err',
        state: () => ({ data: '' }),
        actions: {
          async failAsync() {
            throw new Error('async boom');
          },
        },
      });

      const errors: unknown[] = [];
      store.$onAction(({ onError }) => {
        onError((e) => errors.push(e));
      });

      await expect(store.failAsync()).rejects.toThrow('async boom');
      expect(errors).toHaveLength(1);
      expect((errors[0] as Error).message).toBe('async boom');
    });

    it('should allow unsubscribing', () => {
      const store = createStore<{ count: number }, Record<string, never>, { increment(): void }>({
        id: 'on-action-unsub',
        state: () => ({ count: 0 }),
        actions: {
          increment() {
            (this as { count: number }).count++;
          },
        },
      });

      const calls: string[] = [];
      const unsub = store.$onAction(({ name }) => {
        calls.push(name);
      });

      store.increment();
      unsub();
      store.increment();

      expect(calls).toEqual(['increment']);
    });

    it('should provide store reference in context', () => {
      const store = createStore<{ count: number }, Record<string, never>, { increment(): void }>({
        id: 'on-action-ctx',
        state: () => ({ count: 0 }),
        actions: {
          increment() {
            (this as { count: number }).count++;
          },
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let capturedStore: any;
      store.$onAction(({ store: s }) => {
        capturedStore = s;
      });

      store.increment();
      expect(capturedStore).toBe(store);
    });

    it('should not affect action behavior when no listeners are registered', () => {
      const store = createStore<{ count: number }, Record<string, never>, { increment(): void }>({
        id: 'on-action-none',
        state: () => ({ count: 0 }),
        actions: {
          increment() {
            (this as { count: number }).count++;
          },
        },
      });

      // No $onAction registered — fast path
      store.increment();
      expect(store.count).toBe(1);
    });

    it('should support multiple listeners', () => {
      const store = createStore<{ count: number }, Record<string, never>, { increment(): void }>({
        id: 'on-action-multi',
        state: () => ({ count: 0 }),
        actions: {
          increment() {
            (this as { count: number }).count++;
          },
        },
      });

      const callsA: string[] = [];
      const callsB: string[] = [];
      store.$onAction(({ name }) => callsA.push(name));
      store.$onAction(({ name }) => callsB.push(name));

      store.increment();

      expect(callsA).toEqual(['increment']);
      expect(callsB).toEqual(['increment']);
    });

    it('should iterate over a stable listener snapshot when listeners mutate subscriptions', () => {
      const store = createStore<{ count: number }, Record<string, never>, { increment(): void }>({
        id: 'on-action-listener-snapshot',
        state: () => ({ count: 0 }),
        actions: {
          increment() {
            (this as { count: number }).count++;
          },
        },
      });

      const calls: string[] = [];
      let unsubscribeFirst = () => {};

      unsubscribeFirst = store.$onAction(() => {
        calls.push('first');
        unsubscribeFirst();
        store.$onAction(() => {
          calls.push('late');
        });
      });

      store.$onAction(() => {
        calls.push('second');
      });

      store.increment();
      store.increment();

      expect(calls).toEqual(['first', 'second', 'second', 'late']);
    });

    it('should ignore errors thrown by action listeners and hooks', async () => {
      const store = createStore<
        { count: number },
        Record<string, never>,
        { increment(): number; failAsync(): Promise<void> }
      >({
        id: 'on-action-safe-hooks',
        state: () => ({ count: 0 }),
        actions: {
          increment() {
            (this as { count: number }).count++;
            return (this as { count: number }).count;
          },
          async failAsync() {
            throw new Error('async boom');
          },
        },
      });
      const consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});

      try {
        store.$onAction(({ after, onError }) => {
          after(() => {
            throw new Error('after hook boom');
          });
          onError(() => {
            throw new Error('error hook boom');
          });
          throw new Error('listener boom');
        });

        expect(store.increment()).toBe(1);
        await expect(store.failAsync()).rejects.toThrow('async boom');

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('[bQuery store "on-action-safe-hooks"] Error in $onAction'),
          expect.any(Error)
        );
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('[bQuery store "on-action-safe-hooks"] Error in $onAction'),
          expect.any(Error)
        );
        expect(consoleErrorSpy.mock.calls).toEqual(
          expect.arrayContaining([
            [
              expect.stringContaining(
                '[bQuery store "on-action-safe-hooks"] Error in $onAction listener for action "increment"'
              ),
              expect.objectContaining({ message: 'listener boom' }),
            ],
            [
              expect.stringContaining(
                '[bQuery store "on-action-safe-hooks"] Error in $onAction after for action "increment"'
              ),
              expect.objectContaining({ message: 'after hook boom' }),
            ],
            [
              expect.stringContaining(
                '[bQuery store "on-action-safe-hooks"] Error in $onAction listener for action "failAsync"'
              ),
              expect.objectContaining({ message: 'listener boom' }),
            ],
            [
              expect.stringContaining(
                '[bQuery store "on-action-safe-hooks"] Error in $onAction onError for action "failAsync"'
              ),
              expect.objectContaining({ message: 'error hook boom' }),
            ],
          ])
        );
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });

    it('should report async rejections from action listeners without affecting the action', async () => {
      const store = createStore<{ count: number }, Record<string, never>, { increment(): number }>({
        id: 'on-action-async-listener-safe',
        state: () => ({ count: 0 }),
        actions: {
          increment() {
            (this as { count: number }).count++;
            return (this as { count: number }).count;
          },
        },
      });
      const consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
      const consoleWarnSpy = spyOn(console, 'warn').mockImplementation(() => {});

      try {
        store.$onAction(async () => {
          throw new Error('async listener boom');
        });

        expect(store.increment()).toBe(1);
        await Promise.resolve();

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            '[bQuery store "on-action-async-listener-safe"] Error in $onAction listener for action "increment"'
          ),
          expect.objectContaining({ message: 'async listener boom' })
        );
      } finally {
        consoleWarnSpy.mockRestore();
        consoleErrorSpy.mockRestore();
      }
    });

    it('should warn once that async listeners must register hooks before awaiting', async () => {
      const store = createStore<{ count: number }, Record<string, never>, { increment(): number }>({
        id: 'on-action-async-listener-warning',
        state: () => ({ count: 0 }),
        actions: {
          increment() {
            (this as { count: number }).count++;
            return (this as { count: number }).count;
          },
        },
      });
      const consoleWarnSpy = spyOn(console, 'warn').mockImplementation(() => {});
      let lateAfterCalled = false;

      try {
        store.$onAction(async ({ after }) => {
          await Promise.resolve();
          after(() => {
            lateAfterCalled = true;
          });
        });

        expect(store.increment()).toBe(1);
        await Promise.resolve();
        expect(store.increment()).toBe(2);
        await Promise.resolve();

        expect(lateAfterCalled).toBe(false);
        expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          `[bQuery store "on-action-async-listener-warning"] Async $onAction listener detected for action "increment". If it awaits, register after()/onError() before the first await; late registrations will not affect the current action.`
        );
      } finally {
        consoleWarnSpy.mockRestore();
      }
    });

    it('should preserve listener registration order across multiple hooks', () => {
      const store = createStore<
        { count: number },
        Record<string, never>,
        { increment(): number }
      >({
        id: 'on-action-order-verification',
        state: () => ({ count: 0 }),
        actions: {
          increment() {
            (this as { count: number }).count++;
            return (this as { count: number }).count;
          },
        },
      });

      const order: string[] = [];
      store.$onAction(({ after }) => {
        order.push('listener-A');
        after(() => order.push('after-A'));
      });
      store.$onAction(({ after }) => {
        order.push('listener-B');
        after(() => order.push('after-B'));
      });

      store.increment();

      expect(order).toEqual(['listener-A', 'listener-B', 'after-A', 'after-B']);
    });

    it('should run sync after hooks only after the action returns', () => {
      const store = createStore<
        { count: number },
        Record<string, never>,
        { increment(): number }
      >({
        id: 'on-action-after-timing',
        state: () => ({ count: 0 }),
        actions: {
          increment() {
            (this as { count: number }).count++;
            return (this as { count: number }).count;
          },
        },
      });

      let afterResult: unknown = undefined;
      store.$onAction(({ after }) => {
        after((result) => {
          afterResult = result;
        });
        // At this point the action hasn't run yet
        expect(afterResult).toBeUndefined();
      });

      const result = store.increment();
      // After the action call completes, the after hook has run
      expect(afterResult).toBe(1);
      expect(result).toBe(1);
    });

    it('should run async after hooks only after the promise resolves', async () => {
      let resolved = false;
      const store = createStore<
        { data: string },
        Record<string, never>,
        { fetchData(): Promise<string> }
      >({
        id: 'on-action-async-after-timing',
        state: () => ({ data: '' }),
        actions: {
          async fetchData() {
            await new Promise((r) => setTimeout(r, 5));
            resolved = true;
            (this as { data: string }).data = 'done';
            return 'done';
          },
        },
      });

      let afterCalled = false;
      store.$onAction(({ after }) => {
        after(() => {
          afterCalled = true;
          // The action must have resolved before after runs
          expect(resolved).toBe(true);
        });
      });

      expect(afterCalled).toBe(false);
      await store.fetchData();
      expect(afterCalled).toBe(true);
    });

    it('should not change the sync action return value when a listener throws', () => {
      const store = createStore<
        { count: number },
        Record<string, never>,
        { increment(): number }
      >({
        id: 'on-action-error-no-result-change',
        state: () => ({ count: 0 }),
        actions: {
          increment() {
            (this as { count: number }).count++;
            return (this as { count: number }).count;
          },
        },
      });
      const consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});

      try {
        store.$onAction(() => {
          throw new Error('listener error');
        });

        // The action should still return 1 despite the listener error
        expect(store.increment()).toBe(1);
        expect(store.count).toBe(1);
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });

    it('should not change the async action result when a listener throws', async () => {
      const store = createStore<
        { data: string },
        Record<string, never>,
        { fetchData(): Promise<string> }
      >({
        id: 'on-action-error-no-async-change',
        state: () => ({ data: '' }),
        actions: {
          async fetchData() {
            (this as { data: string }).data = 'loaded';
            return 'loaded';
          },
        },
      });
      const consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});

      try {
        store.$onAction(() => {
          throw new Error('listener error');
        });

        const result = await store.fetchData();
        expect(result).toBe('loaded');
        expect(store.data).toBe('loaded');
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });
  });

  describe('createPersistedStore advanced options', () => {
    const hasLocalStorage = (() => {
      try {
        return typeof localStorage !== 'undefined';
      } catch {
        return false;
      }
    })();

    /** In-memory storage backend for tests. */
    const createMemoryStorage = (): StorageBackend & { store: Map<string, string> } => {
      const store = new Map<string, string>();
      return {
        store,
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
        removeItem: (key: string) => store.delete(key),
      };
    };

    it('should accept a custom storage backend', () => {
      const mem = createMemoryStorage();

      const store = createPersistedStore(
        { id: 'mem-store', state: () => ({ value: 'hello' }) },
        { storage: mem }
      );

      store.value = 'world';
      expect(mem.store.get('bquery-store-mem-store')).toBe('{"value":"world"}');
    });

    it('should accept a custom serializer', () => {
      const mem = createMemoryStorage();
      const customSerializer = {
        serialize: (state: unknown) => `CUSTOM:${JSON.stringify(state)}`,
        deserialize: (raw: string) => JSON.parse(raw.replace('CUSTOM:', '')),
      };

      const store = createPersistedStore(
        { id: 'ser-store', state: () => ({ x: 1 }) },
        { storage: mem, serializer: customSerializer }
      );

      store.x = 42;
      expect(mem.store.get('bquery-store-ser-store')).toBe('CUSTOM:{"x":42}');
    });

    it('should restore from custom storage backend', () => {
      const mem = createMemoryStorage();
      mem.store.set('bquery-store-restore-test', '{"restored":true}');

      const store = createPersistedStore(
        { id: 'restore-test', state: () => ({ restored: false }) },
        { storage: mem }
      );

      expect(store.restored).toBe(true);
    });

    it('should accept a custom key', () => {
      const mem = createMemoryStorage();

      const store = createPersistedStore(
        { id: 'key-test', state: () => ({ val: 0 }) },
        { key: 'my-custom-key', storage: mem }
      );

      store.val = 99;
      expect(mem.store.get('my-custom-key')).toBe('{"val":99}');
    });

    it('should run migration when version changes', () => {
      const mem = createMemoryStorage();
      // Simulate previously persisted v1 data
      mem.store.set('bquery-store-migrate', '{"name":"Alice"}');
      mem.store.set('bquery-store-migrate__version', '1');

      const store = createPersistedStore(
        { id: 'migrate', state: () => ({ name: '', theme: 'dark' }) },
        {
          storage: mem,
          version: 2,
          migrate: (old, v) => {
            if (v < 2) return { ...old, theme: 'auto' };
            return old;
          },
        }
      );

      expect(store.name).toBe('Alice');
      expect(store.theme).toBe('auto');
      // Version should be updated
      expect(mem.store.get('bquery-store-migrate__version')).toBe('2');
    });

    it('should persist the migrated state payload and version together on successful migration', () => {
      const mem = createMemoryStorage();
      mem.store.set('bquery-store-migrate-persist', '{"name":"Alice"}');
      mem.store.set('bquery-store-migrate-persist__version', '1');

      createPersistedStore(
        { id: 'migrate-persist', state: () => ({ name: '', theme: 'dark' }) },
        {
          storage: mem,
          version: 2,
          migrate: (old, currentVersion) => {
            expect(currentVersion).toBe(1);
            return { ...old, theme: 'auto' };
          },
        }
      );

      expect(mem.store.get('bquery-store-migrate-persist')).toBe('{"name":"Alice","theme":"auto"}');
      expect(mem.store.get('bquery-store-migrate-persist__version')).toBe('2');

      destroyStore('migrate-persist');
    });

    it('should not run migration when version matches', () => {
      const mem = createMemoryStorage();
      mem.store.set('bquery-store-no-mig', '{"val":42}');
      mem.store.set('bquery-store-no-mig__version', '3');

      let migrateCalled = false;
      const store = createPersistedStore(
        { id: 'no-mig', state: () => ({ val: 0 }) },
        {
          storage: mem,
          version: 3,
          migrate: () => {
            migrateCalled = true;
            return {};
          },
        }
      );

      expect(migrateCalled).toBe(false);
      expect(store.val).toBe(42);
    });

    it('should treat missing version as 0 for migration', () => {
      const mem = createMemoryStorage();
      mem.store.set('bquery-store-zero-ver', '{"old":true}');
      // No version key — should default to 0

      let receivedVersion: number | undefined;
      createPersistedStore(
        { id: 'zero-ver', state: () => ({ old: false, newField: '' }) },
        {
          storage: mem,
          version: 1,
          migrate: (old, v) => {
            receivedVersion = v;
            return { ...old, newField: 'migrated' };
          },
        }
      );

      expect(receivedVersion).toBe(0);
    });

    it.skipIf(!hasLocalStorage)(
      'should remain backward compatible with string key argument',
      () => {
        localStorage.removeItem('compat-key');

        const store = createPersistedStore(
          { id: 'compat', state: () => ({ val: 1 }) },
          'compat-key'
        );

        store.val = 2;
        expect(localStorage.getItem('compat-key')).toBe('{"val":2}');

        localStorage.removeItem('compat-key');
      }
    );

    it('should handle empty/missing storage gracefully', () => {
      const mem = createMemoryStorage();
      // No pre-existing data

      const store = createPersistedStore(
        { id: 'empty-store', state: () => ({ val: 'default' }) },
        { storage: mem }
      );

      expect(store.val).toBe('default');
    });

    it('should treat invalid persisted version metadata as version 0 during migration', () => {
      const mem = createMemoryStorage();
      mem.store.set('bquery-store-invalid-version', JSON.stringify({ val: 'persisted' }));
      mem.store.set('bquery-store-invalid-version__version', 'not-a-number');

      let receivedVersion = -1;
      const store = createPersistedStore(
        { id: 'invalid-version', state: () => ({ val: 'default' }) },
        {
          storage: mem,
          version: 2,
          migrate: (old, version) => {
            receivedVersion = version;
            return old;
          },
        }
      );

      expect(receivedVersion).toBe(0);
      expect(store.val).toBe('persisted');
    });

    it('should persist the configured version metadata on first creation', () => {
      const mem = createMemoryStorage();

      createPersistedStore(
        { id: 'versioned-store', state: () => ({ val: 'default' }) },
        { storage: mem, version: 4 }
      );

      expect(mem.store.get('bquery-store-versioned-store__version')).toBe('4');
      destroyStore('versioned-store');
    });

    it('should handle corrupt data in storage gracefully', () => {
      const mem = createMemoryStorage();
      mem.store.set('bquery-store-corrupt', 'NOT_JSON!!!');

      const store = createPersistedStore(
        { id: 'corrupt', state: () => ({ val: 'fallback' }) },
        { storage: mem }
      );

      // Should fall back to default state
      expect(store.val).toBe('fallback');
    });

    it('should fall back when a custom serializer returns null or a non-object', () => {
      const invalidValues: unknown[] = [null, 'invalid'];

      for (const invalidValue of invalidValues) {
        const mem = createMemoryStorage();
        mem.store.set('bquery-store-invalid-persisted', '{"ignored":true}');

        const store = createPersistedStore(
          { id: 'invalid-persisted', state: () => ({ val: 'fallback' }) },
          {
            storage: mem,
            serializer: {
              serialize: (state: unknown) => JSON.stringify(state),
              deserialize: () => invalidValue,
            },
          }
        );

        expect(store.val).toBe('fallback');
        destroyStore('invalid-persisted');
      }
    });

    it('should fall back when a custom serializer throws during deserialize', () => {
      const mem = createMemoryStorage();
      mem.store.set('bquery-store-deserialize-throws', '{"ignored":true}');

      const store = createPersistedStore(
        { id: 'deserialize-throws', state: () => ({ val: 'fallback' }) },
        {
          storage: mem,
          serializer: {
            serialize: (state: unknown) => JSON.stringify(state),
            deserialize: () => {
              throw new Error('deserialize failed');
            },
          },
        }
      );

      expect(store.val).toBe('fallback');
      destroyStore('deserialize-throws');
    });

    it('should keep migrated state when serializer persistence fails after migration', () => {
      const mem = createMemoryStorage();
      mem.store.set('bquery-store-migration-persist-failure', JSON.stringify({ val: 'persisted' }));
      mem.store.set('bquery-store-migration-persist-failure__version', '1');
      const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});

      const store = createPersistedStore(
        { id: 'migration-persist-failure', state: () => ({ val: 'default', migrated: false }) },
        {
          storage: mem,
          version: 2,
          migrate: (old) => ({ ...old, migrated: true }),
          serializer: {
            serialize: () => {
              throw new Error('serialize failed');
            },
            deserialize: (raw: string) => JSON.parse(raw) as unknown,
          },
        }
      );

      expect(store.val).toBe('persisted');
      expect(store.migrated).toBe(true);
      expect(mem.store.get('bquery-store-migration-persist-failure__version')).toBe('1');
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
      destroyStore('migration-persist-failure');
    });

    it('should not advance the version key when writing migrated state fails', () => {
      const mem = createMemoryStorage();
      mem.store.set('bquery-store-migration-write-failure', JSON.stringify({ val: 'persisted' }));
      mem.store.set('bquery-store-migration-write-failure__version', '1');
      const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
      const failingStorage: StorageBackend = {
        getItem: (key: string) => mem.getItem(key),
        setItem: (key: string, value: string) => {
          if (key === 'bquery-store-migration-write-failure') {
            throw new Error('write failed');
          }
          mem.setItem(key, value);
        },
        removeItem: (key: string) => mem.removeItem(key),
      };

      try {
        const store = createPersistedStore(
          {
            id: 'migration-write-failure',
            state: () => ({ val: 'default', migrated: false }),
          },
          {
            storage: failingStorage,
            version: 2,
            migrate: (old) => ({ ...old, migrated: true }),
          }
        );

        expect(store.val).toBe('persisted');
        expect(store.migrated).toBe(true);
        expect(mem.store.get('bquery-store-migration-write-failure')).toBe(
          JSON.stringify({ val: 'persisted' })
        );
        expect(mem.store.get('bquery-store-migration-write-failure__version')).toBe('1');
        expect(warnSpy).toHaveBeenCalled();
      } finally {
        warnSpy.mockRestore();
        destroyStore('migration-write-failure');
      }
    });

    it('should retry persisting the migrated version when the first version write fails', () => {
      const mem = createMemoryStorage();
      const stateKey = 'bquery-store-migration-version-retry';
      const versionKey = stateKey + '__version';
      mem.store.set(stateKey, JSON.stringify({ val: 'persisted' }));
      mem.store.set(versionKey, '1');

      const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
      let versionWriteAttempts = 0;
      const flakyVersionStorage: StorageBackend = {
        getItem: (key: string) => mem.getItem(key),
        setItem: (key: string, value: string) => {
          if (key === versionKey) {
            versionWriteAttempts += 1;
            if (versionWriteAttempts === 1) {
              throw new Error('version write failed');
            }
          }
          mem.setItem(key, value);
        },
        removeItem: (key: string) => mem.removeItem(key),
      };

      try {
        const store = createPersistedStore(
          {
            id: 'migration-version-retry',
            state: () => ({ val: 'default', migrated: false }),
          },
          {
            storage: flakyVersionStorage,
            version: 2,
            migrate: (old) => ({ ...old, migrated: true }),
          }
        );

        expect(store.val).toBe('persisted');
        expect(store.migrated).toBe(true);
        expect(mem.store.get(stateKey)).toBe(JSON.stringify({ val: 'persisted', migrated: true }));
        expect(mem.store.get(versionKey)).toBe('2');
        expect(versionWriteAttempts).toBe(2);
        expect(warnSpy).toHaveBeenCalled();
      } finally {
        warnSpy.mockRestore();
        destroyStore('migration-version-retry');
      }
    });

    it('should not throw when dev-only persisted-store warnings run without console.warn', () => {
      const mem = createMemoryStorage();
      mem.store.set('bquery-store-consoleless-migration', JSON.stringify({ val: 'persisted' }));
      mem.store.set('bquery-store-consoleless-migration__version', '1');
      const originalWarn = console.warn;

      Object.defineProperty(console, 'warn', {
        value: undefined,
        configurable: true,
      });

      try {
        const store = createPersistedStore(
          { id: 'consoleless-migration', state: () => ({ val: 'default', migrated: false }) },
          {
            storage: mem,
            version: 2,
            migrate: (old) => ({ ...old, migrated: true }),
            serializer: {
              serialize: () => {
                throw new Error('serialize failed');
              },
              deserialize: (raw: string) => JSON.parse(raw) as unknown,
            },
          }
        );

        expect(store.val).toBe('persisted');
        expect(store.migrated).toBe(true);
        expect(mem.store.get('bquery-store-consoleless-migration__version')).toBe('1');
      } finally {
        Object.defineProperty(console, 'warn', {
          value: originalWarn,
          configurable: true,
        });
        destroyStore('consoleless-migration');
      }
    });

    it('should persist the pending migrated version after a later successful state write', () => {
      const mem = createMemoryStorage();
      const stateKey = 'bquery-store-migration-version-pending';
      const versionKey = stateKey + '__version';
      mem.store.set(stateKey, JSON.stringify({ val: 'persisted' }));
      mem.store.set(versionKey, '1');

      let stateWriteAttempts = 0;
      const flakyStateStorage: StorageBackend = {
        getItem: (key: string) => mem.getItem(key),
        setItem: (key: string, value: string) => {
          if (key === stateKey) {
            stateWriteAttempts += 1;
            if (stateWriteAttempts === 1) {
              throw new Error('state write failed');
            }
          }
          mem.setItem(key, value);
        },
        removeItem: (key: string) => mem.removeItem(key),
      };
      const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});

      try {
        const store = createPersistedStore(
          {
            id: 'migration-version-pending',
            state: () => ({ val: 'default', migrated: false }),
          },
          {
            storage: flakyStateStorage,
            version: 2,
            migrate: (old) => ({ ...old, migrated: true }),
          }
        );

        expect(store.val).toBe('persisted');
        expect(store.migrated).toBe(true);
        expect(mem.store.get(versionKey)).toBe('1');

        store.val = 'updated';

        expect(mem.store.get(stateKey)).toBe(JSON.stringify({ val: 'updated', migrated: true }));
        expect(mem.store.get(versionKey)).toBe('2');
      } finally {
        warnSpy.mockRestore();
        destroyStore('migration-version-pending');
      }
    });

    it('should fall back to defaults when deserialized persisted shapes are invalid', () => {
      const invalidPayloads = ['[]', '"text"', '123', 'null'];

      for (const rawPayload of invalidPayloads) {
        const mem = createMemoryStorage();
        mem.store.set('bquery-store-invalid-shape', rawPayload);

        const store = createPersistedStore(
          { id: 'invalid-shape', state: () => ({ val: 'fallback' }) },
          { storage: mem }
        );

        expect(store.val).toBe('fallback');

        destroyStore('invalid-shape');
      }
    });

    it('should fall back to defaults when a custom serializer returns a class instance', () => {
      class PersistedShape {
        constructor(public val: string) {}
      }

      const mem = createMemoryStorage();
      mem.store.set('bquery-store-instance-shape', '{"val":"persisted"}');

      const store = createPersistedStore(
        { id: 'instance-shape', state: () => ({ val: 'fallback' }) },
        {
          storage: mem,
          serializer: {
            serialize: (state: unknown) => JSON.stringify(state),
            deserialize: () => new PersistedShape('persisted') as unknown,
          },
        }
      );

      expect(store.val).toBe('fallback');
      destroyStore('instance-shape');
    });

    it('should accept null-prototype persisted objects from custom serializers', () => {
      const mem = createMemoryStorage();
      mem.store.set('bquery-store-null-prototype-shape', '{"ignored":true}');
      const persisted = Object.create(null) as Record<string, unknown>;
      persisted.val = 'persisted';

      const store = createPersistedStore(
        { id: 'null-prototype-shape', state: () => ({ val: 'fallback' }) },
        {
          storage: mem,
          serializer: {
            serialize: (state: unknown) => JSON.stringify(state),
            deserialize: () => persisted,
          },
        }
      );

      expect(store.val).toBe('persisted');
      destroyStore('null-prototype-shape');
    });

    it('should fall back to defaults when migration returns an invalid persisted shape', () => {
      const invalidMigratedValues: unknown[] = [null, [], 'invalid'];

      for (const invalidValue of invalidMigratedValues) {
        const mem = createMemoryStorage();
        mem.store.set('bquery-store-invalid-migrated-shape', JSON.stringify({ val: 'persisted' }));
        mem.store.set('bquery-store-invalid-migrated-shape__version', '1');

        const store = createPersistedStore(
          { id: 'invalid-migrated-shape', state: () => ({ val: 'fallback', migrated: false }) },
          {
            storage: mem,
            version: 2,
            migrate: () => invalidValue as Record<string, unknown>,
          }
        );

        expect(store.val).toBe('fallback');
        expect(store.migrated).toBe(false);
        expect(mem.store.get('bquery-store-invalid-migrated-shape__version')).toBe('1');

        destroyStore('invalid-migrated-shape');
      }
    });

    it('should ignore prototype-pollution keys from persisted state', () => {
      const mem = createMemoryStorage();
      mem.store.set('bquery-store-safe-persisted', '{"val":"persisted"}');
      const persisted = Object.create(null) as Record<string, unknown>;
      Object.defineProperty(persisted, '__proto__', {
        value: { polluted: true },
        enumerable: true,
      });
      Object.defineProperty(persisted, 'constructor', {
        value: { polluted: true },
        enumerable: true,
      });
      persisted.val = 'persisted';

      const store = createPersistedStore(
        { id: 'safe-persisted', state: () => ({ val: 'default' }) },
        {
          storage: mem,
          serializer: {
            serialize: (state: unknown) => JSON.stringify(state),
            deserialize: () => persisted,
          },
        }
      );

      expect(store.val).toBe('persisted');
      expect(Object.getPrototypeOf(store)).not.toEqual(expect.objectContaining({ polluted: true }));
      expect(Object.prototype.hasOwnProperty.call(store, '__proto__')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(store, 'constructor')).toBe(false);

      destroyStore('safe-persisted');
    });

    it('should ignore unknown persisted keys that are not part of the default state schema', () => {
      const mem = createMemoryStorage();
      mem.store.set('bquery-store-schema-persisted', '{"val":"persisted","extra":"ignored"}');

      const store = createPersistedStore(
        { id: 'schema-persisted', state: () => ({ val: 'default' }) },
        { storage: mem }
      );

      expect(store.val).toBe('persisted');
      expect(Object.prototype.hasOwnProperty.call(store, 'extra')).toBe(false);
      expect((store as { extra?: unknown }).extra).toBeUndefined();

      destroyStore('schema-persisted');
    });

    it('should fall back gracefully when default localStorage access throws', () => {
      const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

      Object.defineProperty(globalThis, 'localStorage', {
        get: () => {
          throw new Error('denied');
        },
        configurable: true,
      });

      try {
        const store = createPersistedStore({
          id: 'locked-storage',
          state: () => ({ val: 'default' }),
        });

        expect(store.val).toBe('default');
        store.val = 'changed';
        expect(store.val).toBe('changed');
      } finally {
        if (originalDescriptor) {
          Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
        }
      }
    });
  });
});

describe('store/isDev', () => {
  it('defaults to development for actual Node-like process objects without NODE_ENV', async () => {
    const originalProcessDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'process');
    const originalDevOverride = (globalThis as { __BQUERY_DEV__?: boolean }).__BQUERY_DEV__;

    Object.defineProperty(globalThis, 'process', {
      value: { env: {}, versions: { node: '22.0.0' } },
      configurable: true,
    });
    delete (globalThis as { __BQUERY_DEV__?: boolean }).__BQUERY_DEV__;

    try {
      const { isDev } = await import(`../src/store/utils.ts?missing-node-env=${Date.now()}`);
      expect(isDev()).toBe(true);
    } finally {
      if (originalProcessDescriptor) {
        Object.defineProperty(globalThis, 'process', originalProcessDescriptor);
      } else {
        delete (globalThis as { process?: unknown }).process;
      }
      if (originalDevOverride === undefined) {
        delete (globalThis as { __BQUERY_DEV__?: boolean }).__BQUERY_DEV__;
      } else {
        (globalThis as { __BQUERY_DEV__?: boolean }).__BQUERY_DEV__ = originalDevOverride;
      }
    }
  });

  it('defaults to production for process shims without NODE_ENV or Node markers', async () => {
    const originalProcessDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'process');
    const originalDevOverride = (globalThis as { __BQUERY_DEV__?: boolean }).__BQUERY_DEV__;

    Object.defineProperty(globalThis, 'process', {
      value: { env: {} },
      configurable: true,
    });
    delete (globalThis as { __BQUERY_DEV__?: boolean }).__BQUERY_DEV__;

    try {
      const { isDev } = await import(`../src/store/utils.ts?process-shim=${Date.now()}`);
      expect(isDev()).toBe(false);
    } finally {
      if (originalProcessDescriptor) {
        Object.defineProperty(globalThis, 'process', originalProcessDescriptor);
      } else {
        delete (globalThis as { process?: unknown }).process;
      }
      if (originalDevOverride === undefined) {
        delete (globalThis as { __BQUERY_DEV__?: boolean }).__BQUERY_DEV__;
      } else {
        (globalThis as { __BQUERY_DEV__?: boolean }).__BQUERY_DEV__ = originalDevOverride;
      }
    }
  });

  it('enables dev mode when the global dev override is set without process', async () => {
    const originalProcessDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'process');
    const originalDevOverride = (globalThis as { __BQUERY_DEV__?: boolean }).__BQUERY_DEV__;

    Object.defineProperty(globalThis, 'process', {
      value: undefined,
      configurable: true,
    });
    (globalThis as { __BQUERY_DEV__?: boolean }).__BQUERY_DEV__ = true;

    try {
      const { isDev } = await import(`../src/store/utils.ts?dev-override=${Date.now()}`);
      expect(isDev()).toBe(true);
    } finally {
      if (originalProcessDescriptor) {
        Object.defineProperty(globalThis, 'process', originalProcessDescriptor);
      } else {
        delete (globalThis as { process?: unknown }).process;
      }
      if (originalDevOverride === undefined) {
        delete (globalThis as { __BQUERY_DEV__?: boolean }).__BQUERY_DEV__;
      } else {
        (globalThis as { __BQUERY_DEV__?: boolean }).__BQUERY_DEV__ = originalDevOverride;
      }
    }
  });

  it('respects late dev override toggles for store diagnostics after import', async () => {
    const originalProcessDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'process');
    const originalDevOverride = (globalThis as { __BQUERY_DEV__?: boolean }).__BQUERY_DEV__;
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {});

    Object.defineProperty(globalThis, 'process', {
      value: undefined,
      configurable: true,
    });
    delete (globalThis as { __BQUERY_DEV__?: boolean }).__BQUERY_DEV__;

    try {
      const { createStore } = (await import(
        `../src/store/create-store.ts?late-dev-toggle=${Date.now()}`
      )) as typeof import('../src/store/create-store');
      const store = createStore<
        { count: number },
        Record<string, never>,
        { increment(): number }
      >({
        id: `late-store-dev-toggle-${Date.now()}`,
        state: () => ({ count: 0 }),
        actions: {
          increment(this: { count: number }) {
            this.count++;
            return this.count;
          },
        },
      });

      store.$onAction(() => {
        throw new Error('listener boom');
      });

      expect(store.increment()).toBe(1);
      expect(errorSpy).not.toHaveBeenCalled();

      (globalThis as { __BQUERY_DEV__?: boolean }).__BQUERY_DEV__ = true;

      expect(store.increment()).toBe(2);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `[bQuery store "${store.$id}"] Error in $onAction listener for action "increment"`
        ),
        expect.objectContaining({ message: 'listener boom' })
      );
    } finally {
      if (originalProcessDescriptor) {
        Object.defineProperty(globalThis, 'process', originalProcessDescriptor);
      } else {
        delete (globalThis as { process?: unknown }).process;
      }
      if (originalDevOverride === undefined) {
        delete (globalThis as { __BQUERY_DEV__?: boolean }).__BQUERY_DEV__;
      } else {
        (globalThis as { __BQUERY_DEV__?: boolean }).__BQUERY_DEV__ = originalDevOverride;
      }
      errorSpy.mockRestore();
    }
  });
});
