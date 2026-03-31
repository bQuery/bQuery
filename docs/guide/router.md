---
title: Router
---

The router module provides SPA-style client-side routing built on the History API. It integrates seamlessly with bQuery's reactive system.

Internally, the router is now split into focused submodules (matching, navigation, state, links, utilities). The public API remains unchanged.

```ts
import { createRouter, navigate, currentRoute, isNavigating } from '@bquery/bquery/router';
import { effect } from '@bquery/bquery/reactive';
```

## Basic Setup

```ts
const router = createRouter({
  routes: [
    { path: '/', component: () => import('./pages/Home') },
    { path: '/about', component: () => import('./pages/About') },
    { path: '/user/:id', component: () => import('./pages/User') },
    { path: '*', component: () => import('./pages/NotFound') },
  ],
});

// React to route changes
effect(() => {
  const route = currentRoute.value;
  console.log('Current path:', route.path);
  console.log('Params:', route.params);
});
```

## Navigation

```ts
import { navigate, back, forward } from '@bquery/bquery/router';

// Push to history
await navigate('/dashboard');

// Replace current entry
await navigate('/login', { replace: true });

// Browser history
back();
forward();
```

## Route Params

Dynamic segments are defined with `:paramName`:

```ts
const router = createRouter({
  routes: [
    { path: '/user/:id', component: () => import('./User') },
    { path: '/post/:slug/comment/:commentId', component: () => import('./Comment') },
  ],
});

// Navigating to /user/42
console.log(currentRoute.value.params); // { id: '42' }
```

Regex constraints let you validate params directly in the route pattern:

```ts
const router = createRouter({
  routes: [
    { path: '/user/:id(\\d+)', component: () => import('./User') },
    { path: '/docs/:slug([a-z0-9-]+)', component: () => import('./DocPage') },
  ],
});
```

## Query Params

Query strings are automatically parsed:

```ts
// URL: /search?q=hello&page=2
console.log(currentRoute.value.query); // { q: 'hello', page: '2' }

// Repeated keys become arrays
// URL: /search?tag=js&tag=ts
console.log(currentRoute.value.query); // { tag: ['js', 'ts'] }
```

## Navigation Guards

### beforeEach

Run logic before every navigation. Return `false` to cancel:

```ts
router.beforeEach((to, from) => {
  if (to.path === '/admin' && !isAuthenticated()) {
    navigate('/login');
    return false;
  }
});
```

### afterEach

Run logic after successful navigation:

```ts
router.afterEach((to, from) => {
  analytics.track('pageview', { path: to.path });
});
```

### Removing Guards

Both methods return a cleanup function:

```ts
const removeGuard = router.beforeEach((to, from) => {
  // ...
});

// Later
removeGuard();
```

### beforeEnter

Individual routes can enforce route-local guards before global `beforeEach` logic finishes navigation.

```ts
const router = createRouter({
  routes: [
    {
      path: '/admin',
      beforeEnter: () => isAuthenticated() || false,
      component: () => import('./Admin'),
    },
  ],
});
```

## Redirect routes

Use `redirectTo` when a route exists only to forward users elsewhere.

```ts
const router = createRouter({
  routes: [
    { path: '/docs', redirectTo: '/guide/getting-started' },
    { path: '/guide/getting-started', component: () => import('./DocsHome') },
  ],
});
```

## Named Routes

Define route names for easier programmatic navigation:

```ts
const router = createRouter({
  routes: [
    { path: '/', name: 'home', component: () => import('./Home') },
    { path: '/user/:id', name: 'user', component: () => import('./User') },
  ],
});

// Resolve by name
import { resolve } from '@bquery/bquery/router';

const path = resolve('user', { id: '42' });
// Returns '/user/42'
```

## Navigation State

Use `isNavigating` to reactively track in-flight navigation, including async guards and redirect resolution.

```ts
import { isNavigating } from '@bquery/bquery/router';
import { effect } from '@bquery/bquery/reactive';

effect(() => {
  document.body.toggleAttribute('data-route-loading', isNavigating.value);
});
```

This is useful for global loading indicators, disabling route-changing controls, or preventing duplicate navigation triggers while guards are still resolving.

## Active Link Detection

```ts
import { isActive, isActiveSignal } from '@bquery/bquery/router';

// Immediate check
if (isActive('/dashboard')) {
  navItem.classList.add('active');
}

// Reactive check
const dashboardActive = isActiveSignal('/dashboard');
effect(() => {
  navItem.classList.toggle('active', dashboardActive.value);
});

// Exact matching
isActive('/dashboard', true); // Only matches exactly '/dashboard'
```

## `useRoute()` composable

`useRoute()` exposes focused readonly signals for the current route, path, params, query, hash, and matched definition.

```ts
import { useRoute } from '@bquery/bquery/router';

const { path, params, query, hash, matched } = useRoute();

effect(() => {
  console.log(path.value, params.value, query.value, hash.value, matched.value);
});
```

## Link Helpers

### Manual Link Handler

```ts
import { link } from '@bquery/bquery/router';
import { $ } from '@bquery/bquery/core';

$('#nav-home').on('click', link('/'));
$('#nav-about').on('click', link('/about'));
```

### Automatic Link Interception

Intercept all internal links in a container:

```ts
import { interceptLinks } from '@bquery/bquery/router';

// Intercept all links in document
const cleanup = interceptLinks(document.body);

// Links with target, download, or external URLs are ignored
```

### Declarative `<bq-link>`

Register the custom element once, then use it directly in templates or static HTML.

```ts
import { registerBqLink } from '@bquery/bquery/router';

registerBqLink();
```

```html
<bq-link to="/" exact>Home</bq-link>
<bq-link to="/docs" active-class="selected current">Docs</bq-link>
<bq-link to="/settings" replace>Settings</bq-link>
```

`<bq-link>` applies `aria-current="page"` when active and respects modifier-key clicks so users can still open destinations in a new tab when appropriate.

## Hash Mode

Use hash-based routing for static hosting:

```ts
const router = createRouter({
  routes: [...],
  hash: true, // URLs like /#/about
});
```

## Base Path

Prefix all routes with a base path:

```ts
const router = createRouter({
  routes: [...],
  base: '/app', // Routes are relative to /app
});
```

## Scroll restoration

Restore the user's previous scroll position on back/forward navigation by enabling `scrollRestoration`.

```ts
const router = createRouter({
  routes: [...],
  scrollRestoration: true,
});
```

## Lazy Loading

Components can be loaded lazily:

```ts
const router = createRouter({
  routes: [
    {
      path: '/dashboard',
      component: async () => {
        const module = await import('./pages/Dashboard');
        return module.default;
      },
    },
  ],
});
```

## Nested Routes

Define child routes for complex layouts:

```ts
const router = createRouter({
  routes: [
    {
      path: '/dashboard',
      component: () => import('./Dashboard'),
      children: [
        { path: '/settings', component: () => import('./Settings') },
        { path: '/profile', component: () => import('./Profile') },
      ],
    },
  ],
});

// Results in:
// /dashboard -> Dashboard
// /dashboard/settings -> Settings
// /dashboard/profile -> Profile
```

## Cleanup

Destroy the router when no longer needed:

```ts
router.destroy();
```

## Type Reference

```ts
type Route = {
  path: string;
  params: Record<string, string>;
  query: Record<string, string | string[]>;
  matched: RouteDefinition | null;
  hash: string;
};

type RouteDefinition = {
  path: string;
  component: () => unknown | Promise<unknown>;
  name?: string;
  meta?: Record<string, unknown>;
  children?: RouteDefinition[];
};

type RouterOptions = {
  routes: RouteDefinition[];
  base?: string;
  hash?: boolean;
  scrollRestoration?: boolean;
};

type NavigationGuard = (to: Route, from: Route) => boolean | void | Promise<boolean | void>;
```
