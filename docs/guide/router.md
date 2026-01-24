---
title: Router
---

The router module provides SPA-style client-side routing built on the History API. It integrates seamlessly with bQuery's reactive system.

```ts
import { createRouter, navigate, currentRoute } from '@bquery/bquery/router';
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

## Query Params

Query strings are automatically parsed:

```ts
// URL: /search?q=hello&page=2
console.log(currentRoute.value.query); // { q: 'hello', page: '2' }
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
  query: Record<string, string>;
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
};

type NavigationGuard = (to: Route, from: Route) => boolean | void | Promise<boolean | void>;
```
