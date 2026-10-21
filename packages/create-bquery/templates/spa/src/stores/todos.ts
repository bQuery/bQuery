import { createStore } from '@bquery/bquery/store';

export interface Todo {
  id: number;
  text: string;
  done: boolean;
}

// Type aliases (not interfaces) so they satisfy the store's record constraints.
type TodoState = { items: Todo[]; nextId: number };
type TodoGetters = { remaining: number };
type TodoActions = {
  add(text: string): void;
  toggle(id: number): void;
  remove(id: number): void;
};

/**
 * App state lives in a store: state, derived getters and the actions that
 * change it. State is shallow-reactive — replace arrays instead of mutating them.
 */
export const todos = createStore<TodoState, TodoGetters, TodoActions>({
  id: 'todos',
  state: () => ({ items: [], nextId: 1 }),
  getters: {
    remaining: (state) => state.items.filter((todo) => !todo.done).length,
  },
  actions: {
    add(text) {
      const trimmed = text.trim();
      if (!trimmed) return;
      this.items = [...this.items, { id: this.nextId, text: trimmed, done: false }];
      this.nextId += 1;
    },
    toggle(id) {
      this.items = this.items.map((todo) =>
        todo.id === id ? { ...todo, done: !todo.done } : todo
      );
    },
    remove(id) {
      this.items = this.items.filter((todo) => todo.id !== id);
    },
  },
});
