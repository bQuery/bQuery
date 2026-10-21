import { effect } from '@bquery/bquery/reactive';
import {
  createRouter,
  currentRoute,
  registerBqLink,
  type RouteDefinition,
  type Router,
} from '@bquery/bquery/router';
import type { View } from '@bquery/bquery/view';

/** What every module in `pages/` exports. */
export interface Page {
  title: string;
  render(host: HTMLElement): View;
}

/** Pages load lazily: each one becomes its own chunk in the production build. */
const routes: RouteDefinition[] = [
  { path: '/', name: 'home', component: () => import('./pages/home') },
  { path: '/about', name: 'about', component: () => import('./pages/about') },
  { path: '*', component: () => import('./pages/not-found') },
];

// `<bq-link>` navigates without a page load and marks itself active.
const layout = `
  <header>
    <nav aria-label="Main">
      <bq-link to="/" exact>Todos</bq-link>
      <bq-link to="/about">About</bq-link>
    </nav>
  </header>
  <main id="page"></main>`;

export interface App {
  router: Router;
  /** Stops rendering, destroys the current page and the router. */
  destroy(): void;
}

/** Starts the app inside `root`. */
export function createApp(root: HTMLElement): App {
  registerBqLink();
  root.innerHTML = layout;
  const outlet = root.querySelector<HTMLElement>('#page')!;
  const router = createRouter({ routes });

  let view: View | undefined;
  let renders = 0;
  // Re-runs whenever the route changes and swaps in the matching page.
  const stop = effect(() => {
    const load = currentRoute.value.matched?.component;
    if (!load) return;
    const id = ++renders;
    void (async () => {
      const page = (await load()) as Page;
      if (id !== renders) return; // a newer navigation won
      view?.destroy();
      view = page.render(outlet);
      document.title = page.title;
    })();
  });

  return {
    router,
    destroy() {
      stop();
      renders += 1;
      view?.destroy();
      router.destroy();
      root.replaceChildren();
    },
  };
}
