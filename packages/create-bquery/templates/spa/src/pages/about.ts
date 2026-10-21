import { computed } from '@bquery/bquery/reactive';
import { currentRoute } from '@bquery/bquery/router';
import { mount, type View } from '@bquery/bquery/view';
import { todos } from '../stores/todos';

export const title = 'About';

const template = `
  <h1>About</h1>
  <p>
    This app uses the bQuery router for navigation, a store for state and the
    view module for <code>bq-*</code> bindings. The store outlives pages:
    <strong bq-text="summary"></strong>
  </p>
  <p>Current path: <code bq-text="path"></code></p>`;

/** Renders the about page into `host`. */
export function render(host: HTMLElement): View {
  host.innerHTML = template;
  return mount(host, {
    path: computed(() => currentRoute.value.path),
    summary: computed(() => `${todos.items.length} todo(s), ${todos.remaining} open.`),
  });
}
