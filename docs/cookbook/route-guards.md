# Protected routes with guards

**Problem.** Redirect unauthenticated users away from `/account` to `/login`.

**Solution.** Register a router [guard](/guide/router) that inspects a session signal and returns a redirect.

```ts
import { createRouter } from '@bquery/bquery/router';
import { signal } from '@bquery/bquery/reactive';

export const session = signal<{ user: string } | null>(null);

export const router = createRouter({
  routes: [
    { path: '/', name: 'home' },
    { path: '/login', name: 'login' },
    {
      path: '/account',
      name: 'account',
      beforeEnter(to) {
        if (!session.value) return { name: 'login', query: { next: to.fullPath } };
      },
    },
  ],
});
```

**Why it works.** Guards run before navigation commits, so returning a redirect descriptor short-circuits without flicker. Use the 1.14.0 `NavigationResult` returned by `router.pushResult()` to know whether the navigation succeeded or was redirected.

## Related

- [Router guide](/guide/router)
- [Router — `pushResult` / `replaceResult`](/guide/router)
- Longer worked example: [Examples & Recipes — Protected routes](/guide/examples#protected-routes-with-guards)
