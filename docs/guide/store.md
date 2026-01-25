---
title: Store
---

The store module provides Pinia/Vuex-style state management built entirely on bQuery's reactive signals.

```ts
import { createStore } from '@bquery/bquery/store';
import { effect } from '@bquery/bquery/reactive';
```

## Basic Store

```ts
const counterStore = createStore({
  id: 'counter',
  state: () => ({
    count: 0,
    step: 1,
  }),
  getters: {
    doubled: (state) => state.count * 2,
    isPositive: (state) => state.count > 0,
  },
  actions: {
    increment() {
      this.count += this.step;
    },
    decrement() {
      this.count -= this.step;
    },
    setStep(newStep: number) {
      this.step = newStep;
    },
  },
});

// Use the store
counterStore.increment();
console.log(counterStore.count); // 1
console.log(counterStore.doubled); // 2
```

## Store Factory (defineStore)

Create a reusable store factory (Pinia-style) that lazily instantiates the store:

```ts
import { defineStore } from '@bquery/bquery/store';

const useCounter = defineStore('counter', {
  state: () => ({ count: 0 }),
  actions: {
    increment() {
      this.count++;
    },
  },
});

const counter = useCounter();
counter.increment();
```

## Reactive Updates

Store state is fully reactive:

```ts
effect(() => {
  console.log('Count changed:', counterStore.count);
});

counterStore.increment(); // Logs: "Count changed: 1"
```

## State

State is defined via a factory function that returns the initial values.

::: warning Shallow Reactivity
Store state uses **shallow reactivity**. Only top-level property assignments trigger reactive updates. Mutating nested objects directly (e.g., `store.nested.prop = value`) will NOT notify subscribers. Always replace the entire nested object or use `$patch`.
:::

```ts
const userStore = createStore({
  id: 'user',
  state: () => ({
    name: 'Anonymous',
    email: null as string | null,
    preferences: {
      theme: 'dark',
      notifications: true,
    },
  }),
});

// Read state
console.log(userStore.name);

// Update state (top-level properties are reactive)
userStore.name = 'Alice';

// ⚠️ Nested mutations do NOT trigger reactive updates:
// userStore.preferences.theme = 'light'; // Won't notify subscribers!

// ✅ Replace the entire nested object instead:
userStore.preferences = { ...userStore.preferences, theme: 'light' };

// ✅ Or use $patch for multiple updates:
userStore.$patch((state) => {
  state.preferences = { ...state.preferences, theme: 'light' };
});
```

## Getters

Getters derive computed values from state:

```ts
const cartStore = createStore({
  id: 'cart',
  state: () => ({
    items: [] as { price: number; qty: number }[],
    discount: 0,
  }),
  getters: {
    subtotal: (state) => state.items.reduce((sum, item) => sum + item.price * item.qty, 0),
    total: (state, getters) => getters.subtotal * (1 - state.discount),
    itemCount: (state) => state.items.reduce((sum, item) => sum + item.qty, 0),
  },
});

console.log(cartStore.subtotal);
console.log(cartStore.total);
```

## Actions

Actions are methods that can modify state. They support async operations:

```ts
const authStore = createStore({
  id: 'auth',
  state: () => ({
    user: null as User | null,
    loading: false,
    error: null as string | null,
  }),
  actions: {
    async login(email: string, password: string) {
      this.loading = true;
      this.error = null;

      try {
        const response = await fetch('/api/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });

        if (!response.ok) throw new Error('Login failed');

        this.user = await response.json();
      } catch (e) {
        this.error = (e as Error).message;
      } finally {
        this.loading = false;
      }
    },

    logout() {
      this.user = null;
    },
  },
});

await authStore.login('user@example.com', 'password');
```

## Store Methods

### $reset

Reset state to initial values:

```ts
counterStore.count = 100;
counterStore.$reset();
console.log(counterStore.count); // 0
```

### $patch

Update multiple properties at once:

```ts
// Object syntax
userStore.$patch({
  name: 'Bob',
  email: 'bob@example.com',
});

// Function syntax for nested updates
userStore.$patch((state) => {
  state.preferences = {
    ...state.preferences,
    theme: 'light',
    notifications: false,
  };
});
```

::: tip Nested Objects in $patch
Even within `$patch`, you must replace nested objects entirely (using spread or`Object.assign`) to ensure reactive updates. Direct nested mutations like`state.preferences.theme = 'light'` will NOT trigger subscribers.

In development mode, bQuery will warn you if it detects nested mutations that won't trigger reactive updates.
:::

### $patchDeep {#deep-reactivity}

For scenarios where you need deep reactivity without manually replacing objects, use `$patchDeep`. This method deep-clones the state before mutation, ensuring all changes trigger reactive updates:

```ts
// ✅ Nested mutations work with $patchDeep
userStore.$patchDeep((state) => {
  state.preferences.theme = 'light'; // Works!
  state.preferences.notifications = false; // Works!
});

// Also works with partial objects
userStore.$patchDeep({
  preferences: { theme: 'dark', notifications: true },
});
```

::: warning Performance
`$patchDeep` creates deep copies of your state, which has a performance cost for large objects or frequent updates. Use `$patch` with manual object replacement for performance-critical code.
:::

### $subscribe

React to state changes:

```ts
const unsubscribe = counterStore.$subscribe((state) => {
  console.log('State changed:', state);
  localStorage.setItem('counter', JSON.stringify(state));
});

// Later
unsubscribe();
```

### $state

Get a snapshot of current state:

```ts
const snapshot = counterStore.$state;
console.log(snapshot); // { count: 0, step: 1 }
```

### $id

Access the store identifier:

```ts
console.log(counterStore.$id); // 'counter'
```

## Store Registry

### getStore

Retrieve an existing store by ID:

```ts
import { getStore } from '@bquery/bquery/store';

const counter = getStore<typeof counterStore>('counter');
counter?.increment();
```

### listStores

List all registered store IDs:

```ts
import { listStores } from '@bquery/bquery/store';

console.log(listStores()); // ['counter', 'user', 'auth']
```

### destroyStore

Remove a store from the registry:

```ts
import { destroyStore } from '@bquery/bquery/store';

destroyStore('counter');
```

## Persisted Store

Automatically persist to localStorage:

```ts
import { createPersistedStore } from '@bquery/bquery/store';

const settingsStore = createPersistedStore({
  id: 'settings',
  state: () => ({
    theme: 'dark',
    language: 'en',
    fontSize: 14,
  }),
});

// State is automatically saved to localStorage
// and restored on page reload
settingsStore.theme = 'light';
```

Custom storage key:

```ts
const store = createPersistedStore(
  { id: 'mystore', state: () => ({ value: 0 }) },
  'custom-storage-key'
);
```

## Plugins

Extend all stores with plugins:

```ts
import { registerPlugin } from '@bquery/bquery/store';

// Logger plugin
registerPlugin(({ store, options }) => {
  console.log(`Store "${options.id}" created`);

  store.$subscribe((state) => {
    console.log(`[${options.id}] State changed:`, state);
  });
});

// Persistence plugin
registerPlugin(({ store, options }) => {
  const key = `store-${options.id}`;

  // Load saved state
  const saved = localStorage.getItem(key);
  if (saved) {
    store.$patch(JSON.parse(saved));
  }

  // Save on changes
  store.$subscribe((state) => {
    localStorage.setItem(key, JSON.stringify(state));
  });
});
```

## Mapping Helpers

### mapState

Map state properties for destructuring:

```ts
import { mapState } from '@bquery/bquery/store';

const { count, step } = mapState(counterStore, ['count', 'step']);

// Properties remain reactive
effect(() => {
  console.log(count); // Tracks changes
});
```

### mapGetters

Map computed getters for convenient access:

```ts
import { mapGetters } from '@bquery/bquery/store';

const getters = mapGetters(counterStore, ['doubled']);
console.log(getters.doubled); // Access via properties to preserve reactivity
```

### mapActions

Map actions for easier usage:

```ts
import { mapActions } from '@bquery/bquery/store';

const { increment, decrement } = mapActions(counterStore, ['increment', 'decrement']);

// Use directly
increment();
```

## watchStore

Watch a selected slice of store state with optional deep comparison:

```ts
import { watchStore } from '@bquery/bquery/store';

const stop = watchStore(
  counterStore,
  (state) => state.count,
  (value, previous) => {
    console.log('Count changed:', value, previous);
  },
  { immediate: true }
);

// Later
stop();
```

## Devtools Integration

Stores automatically register with `window.__BQUERY_DEVTOOLS__`:

```ts
// In browser console
window.__BQUERY_DEVTOOLS__.stores.get('counter');
```

Devtools can subscribe to store events:

```ts
window.__BQUERY_DEVTOOLS__ = {
  stores: new Map(),
  onStoreCreated: (id, store) => {
    console.log('Store created:', id);
  },
  onStateChange: (id, state) => {
    console.log('State changed:', id, state);
  },
};
```

## Type Reference

```ts
type StoreDefinition<S, G, A> = {
  id: string;
  state: () => S;
  getters?: Record<string, (state: S, getters: G) => unknown>;
  actions?: A;
};

type Store<S, G, A> = S &
  G &
  A & {
    $id: string;
    $reset: () => void;
    $subscribe: (callback: (state: S) => void) => () => void;
    $patch: (partial: Partial<S> | ((state: S) => void)) => void;
    $patchDeep: (partial: Partial<S> | ((state: S) => void)) => void;
    $state: S;
  };

const useStore = defineStore(id, definition);

const stop = watchStore(store, selector, callback, {
  immediate?: boolean;
  deep?: boolean;
  equals?: (a, b) => boolean;
});

const mapped = mapGetters(store, ['getterKey']);
```
