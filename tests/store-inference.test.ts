/**
 * Type inference regression tests for `createStore`, `defineStore` and
 * `createPersistedStore`.
 *
 * The type-level assertions are checked by `bun run test:types`
 * (`tsconfig.component-test.json` includes `tests/`); the runtime assertions
 * make sure inferred stores behave exactly like explicitly typed ones.
 */

import { beforeEach, describe, expect, it } from 'bun:test';
import type { StorageBackend } from '../src/store/index';
import {
  createPersistedStore,
  createStore,
  defineStore,
  destroyStore,
  listStores,
} from '../src/store/index';

/** Strict type equality (distinguishes `any`, `never` and `unknown`). */
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;

/** Compile-time assertion: fails type-checking unless `T` is `true`. */
const assertType = <T extends true>(_proof?: T): void => undefined;

type Todo = { id: number; title: string; done: boolean };
type TodoState = { items: Todo[]; nextId: number; filter: 'all' | 'open' | 'done' };

const createMemoryStorage = (): StorageBackend => {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
};

describe('store type inference', () => {
  beforeEach(() => {
    for (const id of listStores()) {
      destroyStore(id);
    }
  });

  it('infers state, getters and actions from a createStore definition', () => {
    const todos = createStore({
      id: 'inferred-todos',
      state: () => ({
        items: [] as Todo[],
        nextId: 1,
        filter: 'all' as TodoState['filter'],
      }),
      getters: {
        remaining: (state) => {
          // Getters receive the inferred state type.
          assertType<Equal<typeof state, TodoState>>();
          return state.items.filter((todo) => !todo.done).length;
        },
        visible: (state) =>
          state.filter === 'all'
            ? state.items
            : state.items.filter((todo) => todo.done === (state.filter === 'done')),
        isEmpty: (state) => state.items.length === 0,
      },
      actions: {
        add(title: string) {
          // `this` exposes state, getters and the other actions.
          assertType<Equal<typeof this.items, Todo[]>>();
          assertType<Equal<typeof this.remaining, number>>();
          assertType<Equal<typeof this.toggle, (id: number) => boolean>>();

          const todo: Todo = { id: this.nextId, title, done: false };
          this.items = [...this.items, todo];
          this.nextId += 1;
          return todo;
        },
        toggle(id: number) {
          const exists = this.items.some((todo) => todo.id === id);
          this.items = this.items.map((todo) =>
            todo.id === id ? { ...todo, done: !todo.done } : todo
          );
          return exists;
        },
        addAndComplete(title: string) {
          const todo = this.add(title);
          this.toggle(todo.id);
          return this.remaining;
        },
        async load(titles: readonly string[]) {
          await Promise.resolve();
          for (const title of titles) this.add(title);
          return this.items.length;
        },
      },
    });

    // State properties keep their inferred types.
    assertType<Equal<typeof todos.items, Todo[]>>();
    assertType<Equal<typeof todos.nextId, number>>();
    assertType<Equal<typeof todos.filter, 'all' | 'open' | 'done'>>();
    assertType<Equal<typeof todos.$state, TodoState>>();

    // Getter values are the inferred getter return types.
    assertType<Equal<typeof todos.remaining, number>>();
    assertType<Equal<typeof todos.visible, Todo[]>>();
    assertType<Equal<typeof todos.isEmpty, boolean>>();

    // Action parameters and return types are preserved.
    assertType<Equal<Parameters<typeof todos.add>, [title: string]>>();
    assertType<Equal<ReturnType<typeof todos.add>, Todo>>();
    assertType<Equal<ReturnType<typeof todos.toggle>, boolean>>();
    assertType<Equal<ReturnType<typeof todos.addAndComplete>, number>>();
    assertType<Equal<Parameters<typeof todos.load>, [titles: readonly string[]]>>();
    assertType<Equal<ReturnType<typeof todos.load>, Promise<number>>>();

    // Unknown keys and wrong argument types are still rejected.
    // @ts-expect-error - `missing` is neither state, getter nor action
    void todos.missing;
    // @ts-expect-error - `add` expects a string title
    void (() => todos.add(42));

    // $onAction receives the inferred action names.
    const unsubscribe = todos.$onAction(({ name }) => {
      const actionName: 'add' | 'toggle' | 'addAndComplete' | 'load' = name;
      void actionName;
    });
    unsubscribe();

    // Runtime behaviour is unchanged.
    expect(todos.isEmpty).toBe(true);
    const first = todos.add('write tests');
    expect(first).toEqual({ id: 1, title: 'write tests', done: false });
    expect(todos.remaining).toBe(1);
    expect(todos.addAndComplete('ship it')).toBe(1);
    expect(todos.toggle(first.id)).toBe(true);
    expect(todos.remaining).toBe(0);
    todos.filter = 'done';
    expect(todos.visible.map((todo) => todo.title)).toEqual(['write tests', 'ship it']);
  });

  it('infers async action results', async () => {
    const store = createStore({
      id: 'inferred-async',
      state: () => ({ items: [] as string[] }),
      actions: {
        async load(titles: readonly string[]) {
          await Promise.resolve();
          this.items = [...titles];
          return this.items.length;
        },
      },
    });

    assertType<Equal<ReturnType<typeof store.load>, Promise<number>>>();
    expect(await store.load(['a', 'b'])).toBe(2);
    expect(store.items).toEqual(['a', 'b']);
  });

  it('infers stores without getters or actions', () => {
    const store = createStore({
      id: 'inferred-state-only',
      state: () => ({ count: 0, label: 'clicks' }),
    });

    assertType<Equal<typeof store.count, number>>();
    assertType<Equal<typeof store.label, string>>();
    // @ts-expect-error - no getters/actions were declared
    void store.increment;

    store.count += 1;
    expect(store.count).toBe(1);
  });

  it('infers getters and actions through defineStore', () => {
    const useCounter = defineStore('inferred-counter', {
      state: () => ({ count: 0, step: 2 }),
      getters: {
        doubled: (state) => state.count * 2,
        label: (state) => `count: ${state.count}`,
      },
      actions: {
        increment() {
          this.count += this.step;
          return this.doubled;
        },
        incrementBy(amount: number) {
          this.count += amount;
        },
      },
    });

    const counter = useCounter();
    assertType<Equal<typeof counter.count, number>>();
    assertType<Equal<typeof counter.doubled, number>>();
    assertType<Equal<typeof counter.label, string>>();
    assertType<Equal<ReturnType<typeof counter.increment>, number>>();
    assertType<Equal<Parameters<typeof counter.incrementBy>, [amount: number]>>();
    assertType<Equal<ReturnType<typeof counter.incrementBy>, void>>();

    expect(counter.increment()).toBe(4);
    counter.incrementBy(3);
    expect(counter.label).toBe('count: 5');
    expect(useCounter()).toBe(counter);
  });

  it('infers getters and actions through createPersistedStore', () => {
    const storage = createMemoryStorage();
    const settings = createPersistedStore(
      {
        id: 'inferred-settings',
        state: () => ({ theme: 'light' as 'light' | 'dark' }),
        getters: {
          isDark: (state) => state.theme === 'dark',
        },
        actions: {
          toggleTheme() {
            this.theme = this.isDark ? 'light' : 'dark';
            return this.theme;
          },
        },
      },
      { storage }
    );

    assertType<Equal<typeof settings.isDark, boolean>>();
    assertType<Equal<ReturnType<typeof settings.toggleTheme>, 'light' | 'dark'>>();

    expect(settings.toggleTheme()).toBe('dark');
    expect(settings.isDark).toBe(true);
    expect(storage.getItem('bquery-store-inferred-settings')).toBe('{"theme":"dark"}');
  });

  it('keeps explicit generics working', () => {
    type CartState = { items: { price: number; qty: number }[]; discount: number };
    type CartGetters = { subtotal: number; total: number };
    type CartActions = { add(price: number, qty?: number): void; clear(): void };

    const cart = createStore<CartState, CartGetters, CartActions>({
      id: 'explicit-cart',
      state: () => ({ items: [], discount: 0.5 }),
      getters: {
        subtotal: (state) => state.items.reduce((sum, item) => sum + item.price * item.qty, 0),
        // Getters that read other getters need the explicit `G` generic.
        total: (state, getters) => getters.subtotal * (1 - state.discount),
      },
      actions: {
        // Parameters are contextually typed from the explicit actions type.
        add(price, qty = 1) {
          assertType<Equal<typeof price, number>>();
          this.items = [...this.items, { price, qty }];
        },
        clear() {
          this.items = [];
        },
      },
    });

    assertType<Equal<typeof cart.total, number>>();
    assertType<Equal<Parameters<typeof cart.add>, [price: number, qty?: number]>>();

    cart.add(10, 2);
    expect(cart.subtotal).toBe(20);
    expect(cart.total).toBe(10);
    cart.clear();
    expect(cart.total).toBe(0);

    // State-only explicit generic keeps the empty getters/actions defaults.
    const counter = createStore<{ count: number }>({
      id: 'explicit-state-only',
      state: () => ({ count: 1 }),
    });
    assertType<Equal<typeof counter.count, number>>();
    expect(counter.count).toBe(1);

    // `Record<string, never>` placeholders (the previous defaults) still compile.
    const useLegacy = defineStore<
      { value: number },
      Record<string, never>,
      { setValue(value: number): void }
    >('explicit-legacy', {
      state: () => ({ value: 0 }),
      actions: {
        setValue(value) {
          this.value = value;
        },
      },
    });
    const legacy = useLegacy();
    legacy.setValue(5);
    expect(legacy.value).toBe(5);
  });
});
