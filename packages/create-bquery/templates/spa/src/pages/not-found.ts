import { computed } from '@bquery/bquery/reactive';
import { currentRoute } from '@bquery/bquery/router';
import { mount, type View } from '@bquery/bquery/view';

export const title = 'Not found';

const template = `
  <h1>Page not found</h1>
  <p>Nothing lives at <code bq-text="path"></code>. <bq-link to="/">Back to the todos</bq-link></p>`;

/** Renders the fallback page for unknown paths into `host`. */
export function render(host: HTMLElement): View {
  host.innerHTML = template;
  return mount(host, { path: computed(() => currentRoute.value.path) });
}
