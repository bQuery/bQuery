# Persisted store

**Problem.** Survive page reloads without writing per-store persistence logic.

**Solution.** Register a [Store plugin](/guide/store) that subscribes to `$subscribe` and writes to `localStorage`. With 1.12.0 you can `unregisterPlugin()` for test isolation.

```ts
import { defineStore, registerPlugin, unregisterPlugin } from '@bquery/bquery/store';

const persist = ({ store }) => {
  const key = `store:${store.id}`;
  const saved = localStorage.getItem(key);
  if (saved) store.$patch(JSON.parse(saved));
  store.$subscribe((state) => localStorage.setItem(key, JSON.stringify(state)));
};

registerPlugin(persist);

export const useSettings = defineStore('settings', {
  state: () => ({ theme: 'light' }),
  actions: {
    setTheme(theme: 'light' | 'dark') {
      this.theme = theme;
    },
  },
});

// In tests:
// afterEach(() => unregisterPlugin(persist));
```

**Why it works.** `$subscribe` fires once per action commit, batching multiple mutations into a single storage write.

## Related

- [Store guide](/guide/store)
- [Store — Plugin teardown (1.12.0)](/guide/store)
- Longer worked example: [Examples & Recipes — State management](/guide/examples#state-management)
