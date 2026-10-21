import { signal } from '@bquery/bquery/reactive';
import { mount, type View } from '@bquery/bquery/view';
import { todos } from '../stores/todos';

export const title = 'Todos';

// `bq-*` directives bind the markup to the context passed to `mount()`.
// `bq-text` writes text, never HTML, so user input is safe to show.
const template = `
  <h1>Todos</h1>
  <form bq-on:submit.prevent="add()">
    <label for="new-todo">New todo</label>
    <input id="new-todo" bq-model="draft" placeholder="What needs doing?" autocomplete="off" />
    <button type="submit">Add</button>
  </form>
  <p class="summary" bq-text="todos.remaining + ' of ' + todos.items.length + ' left'"></p>
  <ul class="todos">
    <li bq-for="todo in todos.items" :key="todo.id" bq-class="{ done: todo.done }">
      <label>
        <input type="checkbox" bq-bind:checked="todo.done" bq-on:change="todos.toggle(todo.value.id)" />
        <span bq-text="todo.text"></span>
      </label>
      <button type="button" class="link" bq-bind:aria-label="'Delete ' + todo.text" bq-on:click="todos.remove(todo.value.id)">Delete</button>
    </li>
  </ul>`;

/** Renders the todo list into `host`. */
export function render(host: HTMLElement): View {
  host.innerHTML = template;
  const draft = signal('');
  return mount(host, {
    draft,
    todos,
    add: () => {
      todos.add(draft.value);
      draft.value = '';
    },
  });
}
