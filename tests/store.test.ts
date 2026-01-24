/**
 * Store module tests
 */

import { beforeEach, describe, expect, it } from 'bun:test';
import { effect } from '../src/reactive/index';
import {
  createPersistedStore,
  createStore,
  destroyStore,
  getStore,
  listStores,
  mapActions,
  mapState,
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
});
