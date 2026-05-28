# Build a Todo SPA

A walkthrough of an idiomatic single-page todo app that exercises [Core](/guide/api-core), [Reactive](/guide/reactive), [Router](/guide/router), [Store](/guide/store), and [View](/guide/view) together. The result is ~120 lines of source for a fully reactive, routable, persisted todo app.

> 💡 Prefer to read the runnable code? The same approach powers the `todo-spa` snippets across [`docs/guide/examples.md`](/guide/examples) and the [Cookbook](/cookbook/).

## Goal

- A todo list with create / toggle / delete.
- Routes for `/`, `/active`, `/completed`.
- State persisted to `localStorage`.
- A reactive count badge in the header.

## 1. Define the store

```ts
// src/store/todos.ts
import { defineStore } from '@bquery/bquery/store';

export interface Todo {
  id: string;
  title: string;
  done: boolean;
}

export const useTodos = defineStore('todos', {
  state: () => ({ items: [] as Todo[] }),
  getters: {
    active: (s) => s.items.filter((t) => !t.done),
    completed: (s) => s.items.filter((t) => t.done),
    remaining: (s) => s.items.filter((t) => !t.done).length,
  },
  actions: {
    add(title: string) {
      this.items.push({ id: crypto.randomUUID(), title, done: false });
    },
    toggle(id: string) {
      const t = this.items.find((x) => x.id === id);
      if (t) t.done = !t.done;
    },
    remove(id: string) {
      this.items = this.items.filter((x) => x.id !== id);
    },
  },
  plugins: [
    /* registered globally below */
  ],
});
```

## 2. Persist with a plugin

```ts
// src/store/persist.ts
import type { StorePlugin } from '@bquery/bquery/store';

export const persist: StorePlugin = ({ store }) => {
  const key = `store:${store.id}`;
  const saved = localStorage.getItem(key);
  if (saved) store.$patch(JSON.parse(saved));
  store.$subscribe((state) => {
    localStorage.setItem(key, JSON.stringify(state));
  });
};
```

```ts
// src/main.ts
import { registerPlugin } from '@bquery/bquery/store';
import { persist } from './store/persist';

registerPlugin(persist);
```

## 3. Wire the router

```ts
// src/router.ts
import { createRouter } from '@bquery/bquery/router';

export const router = createRouter({
  routes: [
    { path: '/', name: 'all' },
    { path: '/active', name: 'active' },
    { path: '/completed', name: 'completed' },
  ],
});
```

## 4. Render with `bq-*` directives

```html
<header>
  <h1>Todos</h1>
  <nav>
    <a bq-on:click.prevent="router.push('/')">All</a>
    <a bq-on:click.prevent="router.push('/active')">Active</a>
    <a bq-on:click.prevent="router.push('/completed')">Completed</a>
    <span bq-text="`${todos.remaining} left`"></span>
  </nav>
</header>

<form bq-on:submit.prevent="todos.add(title.value); title.value = ''">
  <input bq-model="title" placeholder="What needs doing?" />
</form>

<ul>
  <li bq-for="t in visible" :key="t.id">
    <input type="checkbox" :checked="t.done" bq-on:change="todos.toggle(t.value.id)" />
    <span bq-text="t.title" bq-class="{ done: t.done }"></span>
    <button bq-on:click="todos.remove(t.value.id)" aria-label="Delete">×</button>
  </li>
</ul>
```

## 5. Bind state to the view

```ts
import { mount } from '@bquery/bquery/view';
import { computed, signal } from '@bquery/bquery/reactive';
import { router } from './router';
import { useTodos } from './store/todos';

const todos = useTodos();
const title = signal('');

const visible = computed(() => {
  switch (router.currentRoute.value.name) {
    case 'active':
      return todos.active;
    case 'completed':
      return todos.completed;
    default:
      return todos.items;
  }
});

mount('#app', { router, todos, title, visible });
```

## What you exercised

- **Store actions** mutate `this` directly; subscribers fire once per action.
- **Persist plugin** subscribes once and uses `$patch` for SSR-safe restoration.
- **Router** exposes `currentRoute` as a signal — `visible` re-derives automatically.
- **View** binds the same signals declaratively with `bq-*`.

## Next steps

- Add validation with [Forms](/guide/forms).
- Announce completed items to screen readers via [A11y](/guide/a11y)'s `createLiveRegion`.
- Replace `localStorage` with an HTTP backend through [`useFetch`](/guide/reactive#fetch-with-usefetch).
- Hydrate on the server with the [SSR workflow](./ssr-hydration).
