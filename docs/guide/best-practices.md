# Best Practices

Patterns and recommendations for writing clean, performant, and maintainable bQuery applications — from small scripts to large-scale projects.

## Project Structure

### Organize by feature, not by type

For applications beyond a single script, group related code by feature:

```
src/
├── auth/
│   ├── login-form.ts      # form logic
│   ├── auth-store.ts       # auth state
│   └── auth-guard.ts       # route guard
├── dashboard/
│   ├── dashboard.ts        # page logic
│   ├── stats-card.ts       # component
│   └── dashboard-store.ts  # feature state
├── shared/
│   ├── components/         # reusable components
│   ├── stores/             # global stores
│   └── utils/              # helper functions
└── main.ts                 # entry point
```

### Keep entry points minimal

```ts
// main.ts — wire things together, don't implement features here
import { createRouter } from '@bquery/bquery/router';
import { defineBqueryConfig } from '@bquery/bquery/platform';
import { setupAuth } from './auth/auth-guard';

defineBqueryConfig({
  transitions: { skipOnReducedMotion: true },
});
setupAuth();
createRouter({ routes: [/* ... */] });
```

---

## Reactive State

### Prefer signals for shared state

Use signals as the single source of truth. Avoid duplicating state in the DOM:

```ts
// ❌ Avoid — reading state from the DOM
const isOpen = $('#modal').hasClass('open');

// ✅ Prefer — signal as source of truth
const isOpen = signal(false);
effect(() => {
  $('#modal').toggleClass('open', isOpen.value);
});
```

### Use `computed()` for derived values

Never store values that can be derived:

```ts
// ❌ Avoid — manually syncing derived state
const syncedItems = signal<string[]>([]);
const manualCount = signal(0);
// Must remember to update manualCount every time syncedItems change

// ✅ Prefer — computed derives automatically
const items = signal<string[]>([]);
const count = computed(() => items.value.length);
```

### Use `batch()` for multiple updates

Batch related updates to prevent intermediate re-renders:

```ts
import { batch, signal, effect } from '@bquery/bquery/reactive';

const user = signal({ name: '', email: '' });
const isLoggedIn = signal(false);

// ❌ Triggers effects twice
user.value = { name: 'Ada', email: 'ada@example.com' };
isLoggedIn.value = true;

// ✅ Triggers effects once
batch(() => {
  user.value = { name: 'Ada', email: 'ada@example.com' };
  isLoggedIn.value = true;
});
```

### Use `.peek()` to read without subscribing

When you need a value inside an effect but don't want to re-run when it changes:

```ts
effect(() => {
  const current = count.value;        // tracks changes
  const config = appConfig.peek();     // reads once, no tracking
  console.log(`Count is ${current}, config: ${config.theme}`);
});
```

### Clean up effects

Always dispose effects when their UI context is removed:

```ts
// Option 1: Manual disposal
const dispose = effect(() => { /* ... */ });
// Later:
dispose();

// Option 2: Effect scopes (better for groups)
import { effectScope } from '@bquery/bquery/reactive';

const scope = effectScope();
scope.run(() => {
  effect(() => { /* effect A */ });
  effect(() => { /* effect B */ });
});
// Clean up everything at once:
scope.stop();
```

---

## DOM Operations

### Use `$()` for required elements, `$$()` for optional

```ts
// Element MUST exist — throw early if missing
const header = $('#app-header');

// Elements MAY exist — handle gracefully
const tooltips = $$('.tooltip');
tooltips.addClass('initialized');
```

### Chain methods for readability

```ts
// ❌ Verbose
const card = $('#card');
card.addClass('active');
card.css('opacity', '1');
card.attr('aria-expanded', 'true');

// ✅ Chained
$('#card')
  .addClass('active')
  .css('opacity', '1')
  .attr('aria-expanded', 'true');
```

### Minimize DOM reads inside effects

DOM reads are expensive. Read once and store values:

```ts
// ❌ Reads DOM on every signal change
effect(() => {
  const width = document.querySelector('#sidebar')!.offsetWidth;
  const count = items.value.length;
  // ...
});

// ✅ Cache DOM reference outside the effect
const sidebar = $('#sidebar');
effect(() => {
  const count = items.value.length;
  // sidebar reference is stable
  sidebar.text(`${count} items`);
});
```

---

## Security

### Trust the defaults

bQuery sanitizes HTML by default. Don't bypass this unless you have a specific reason:

```ts
// ✅ Safe — sanitized automatically
$('#content').html(userInput);

// ⚠️ Only for content you fully control
$('#content').raw.innerHTML = myGeneratedHtml;
```

### Never interpolate user input into raw HTML

```ts
import { escapeHtml } from '@bquery/bquery/security';

// ❌ Dangerous — even if you think the data is safe
$('#comment').raw.innerHTML = `<p>${userComment}</p>`;

// ✅ Use text for user content
$('#comment').text(userComment);

// ✅ If you need HTML structure, escape the user content first
$('#comment').html(`<p>${escapeHtml(userComment)}</p>`);
```

### Use `escapeHtml()` for explicit escaping

```ts
import { escapeHtml } from '@bquery/bquery/security';

const safe = escapeHtml(userInput);
```

---

## Components

### Keep components small and focused

Each component should do one thing well:

```ts
// ❌ Mega-component
component('user-dashboard', {
  // 200 lines of mixed concerns
});

// ✅ Composed small components
component('user-avatar', { /* avatar rendering */ });
component('user-stats', { /* stats display */ });
component('user-activity', { /* activity feed */ });
```

### Use typed props

Always declare prop types for documentation and safety:

```ts
component('status-badge', {
  props: {
    status: { type: String, default: 'active' },
    size: { type: String, default: 'md' },
  },
  render({ props }) {
    return html`<span class="badge badge-${props.status} badge-${props.size}">
      ${props.status}
    </span>`;
  },
});
```

### Use composition hooks for reactive state

```ts
import { component, html, useComputed, useEffect, useSignal } from '@bquery/bquery/component';

component('live-counter', {
  shadow: false,
  state: { count: 0, doubled: 0 },
  render({ state }) {
    return html`
      <button type="button" class="increment">+</button>
      <span class="count">${state.count}</span> (doubled: <span class="doubled">${state.doubled}</span>)
    `;
  },
  connected() {
    const count = useSignal(0);
    const doubled = useComputed(() => count.value * 2);

    useEffect(() => {
      this.setState('count', count.value);
      this.setState('doubled', doubled.value);
    });

    this.onclick = (event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.increment')) count.value += 1;
    };
  },
  disconnected() {
    this.onclick = null;
  },
});
```

---

## Stores

### Use `createStore()` for shared state

```ts
import { createStore } from '@bquery/bquery/store';

export const authStore = createStore({
  id: 'auth',
  state: () => ({
    user: null as User | null,
    token: '',
  }),
  getters: {
    isLoggedIn: (state) => state.user !== null,
    displayName: (state) => state.user?.name ?? 'Guest',
  },
  actions: {
    login(user: User, token: string) {
      this.user = user;
      this.token = token;
    },
    logout() {
      this.user = null;
      this.token = '';
    },
  },
});
```

### Don't use arrow functions for store actions

Store actions use `this` to access state. Arrow functions break this:

```ts
// ❌ Arrow function loses `this` context
actions: {
  increment: () => { this.count++; }, // `this` is wrong
}

// ✅ Regular function preserves `this`
actions: {
  increment() { this.count++; },
}
```

### Use persisted stores for settings

```ts
import { createPersistedStore } from '@bquery/bquery/store';

const settings = createPersistedStore(
  {
    id: 'settings',
    state: () => ({ theme: 'light', language: 'en' }),
    actions: {
      setTheme(theme: string) {
        this.theme = theme;
      },
    },
  },
  {
    version: 1,
    migrate: (state, oldVersion) =>
      oldVersion < 1 ? { ...state, language: 'en' } : state,
  }
);
```

---

## Router

### Use route guards for authentication

```ts
import { effect } from '@bquery/bquery/reactive';
import { createRouter, currentRoute, navigate } from '@bquery/bquery/router';

createRouter({
  routes: [
    { path: '/', component: () => renderHome() },
    {
      path: '/dashboard',
      component: () => renderDashboard(),
      beforeEnter: () => {
        if (!authStore.isLoggedIn) {
          navigate('/login');
          return false;
        }
        return true;
      },
    },
  ],
});

// Keep rendering explicit: react to route changes and run the matched component safely.
effect(() => {
  const component = currentRoute.value.matched?.component;
  if (!component) return;

  const result = component();
  if (result instanceof Promise) {
    void result.catch((error) => console.error('Route render failed', error));
  }
});
```

### Use parameterized routes with constraints

```ts
import { createRouter, currentRoute } from '@bquery/bquery/router';

createRouter({
  routes: [
    // Only matches numeric IDs
    { path: '/user/:id(\\d+)', component: () => showUser(currentRoute.value.params.id) },
    // Catches everything else
    { path: '/404', component: () => show404() },
  ],
});
```

---

## Testing

### Test reactive behavior, not DOM details

```ts
import { renderComponent, fireEvent, waitFor } from '@bquery/bquery/testing';

test('counter increments', async () => {
  const { el, unmount } = renderComponent('my-counter');

  fireEvent(el.querySelector('button')!, 'click');

  await waitFor(() => {
    expect(el.textContent).toContain('1');
  });

  unmount();
});
```

### Always clean up after tests

```ts
test('shows notification', () => {
  const { el, unmount } = renderComponent('my-notification', {
    props: { message: 'Hello' },
  });

  expect(el.textContent).toContain('Hello');

  unmount(); // prevents test pollution
});
```

---

## Performance Tips

### Import only what you need

```ts
// ❌ Imports the entire library
import { $, signal, createForm, animate } from '@bquery/bquery';

// ✅ Tree-shakeable granular imports
import { $ } from '@bquery/bquery/core';
import { signal } from '@bquery/bquery/reactive';
import { createForm } from '@bquery/bquery/forms';
import { animate } from '@bquery/bquery/motion';
```

### Use `untrack()` for expensive computations

```ts
import { untrack, effect, signal } from '@bquery/bquery/reactive';

const searchQuery = signal('');
const results = signal<string[]>([]);

effect(() => {
  const query = searchQuery.value;
  // Don't re-run this effect when `results` changes
  const currentResults = untrack(() => results.value);
  // ... expensive filtering
});
```

### Debounce reactive watchers

```ts
import { signal, watchDebounce } from '@bquery/bquery/reactive';

const searchQuery = signal('');
const debouncedSearchResults = signal<string[]>([]);

watchDebounce(searchQuery, async (query) => {
  const results = await fetch(`/api/search?q=${query}`).then((r) => r.json());
  debouncedSearchResults.value = results;
}, 300);
```

### Lazy-load modules

```ts
// Load heavy modules only when needed
const showEditor = async () => {
  const { component } = await import('@bquery/bquery/component');
  const { animate } = await import('@bquery/bquery/motion');
  // ... setup editor
};
```

---

## Common Mistakes to Avoid

| Mistake | Fix |
| --- | --- |
| Using `$()` for elements that may not exist | Use `$$()` instead |
| Reading `.value` where `.peek()` is intended | Use `.peek()` when you don't need tracking |
| Using arrow functions in store actions | Use regular functions to preserve `this` |
| Forgetting to dispose effects | Use `effectScope()` or save the dispose function |
| Bypassing sanitization for user content | Trust the default sanitized `.html()` |
| Using `new Function()` without CSP consideration | Note that the view module requires `'unsafe-eval'` |
| Not batching multiple signal updates | Wrap related updates in `batch()` |
