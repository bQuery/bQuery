import { createStore } from '@bquery/bquery/store';

export interface Todo {
  id: number;
  text: string;
  done: boolean;
}

/**
 * App state lives in a store: state, derived getters and the actions that
 * change it. Types are inferred from the definition — annotate action
 * parameters, and `this` is typed as state + getters + actions.
 * State is shallow-reactive — replace arrays instead of mutating them.
 */
export const todos = createStore({
  id: 'todos',
  state: () => ({ items: [] as Todo[], nextId: 1 }),
  getters: {
    remaining: (state) => state.items.filter((todo) => !todo.done).length,
  },
  actions: {
    add(text: string) {
      const trimmed = text.trim();
      if (!trimmed) return;
      this.items = [...this.items, { id: this.nextId, text: trimmed, done: false }];
      this.nextId += 1;
    },
    toggle(id: number) {
      this.items = this.items.map((todo) =>
        todo.id === id ? { ...todo, done: !todo.done } : todo
      );
    },
    remove(id: number) {
      this.items = this.items.filter((todo) => todo.id !== id);
    },
  },
});
