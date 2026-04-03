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

defineBqueryConfig({ /* ... */ });
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
const items = signal([]);
const count = signal(0);
// Must remember to update count every time items change

// ✅ Prefer — computed derives automatically
const items = signal([]);
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
// ❌ Dangerous — even if you think the data is safe
element.raw.innerHTML = `<p>${userComment}</p>`;

// ✅ Use text for user content
$('#comment').text(userComment);

// ✅ Or use sanitized HTML
$('#comment').html(`<p>${userComment}</p>`);
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
    status: 'active' as 'active' | 'inactive' | 'pending',
    size: 'md',
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
component('live-counter', {
  render({ el }) {
    const count = useSignal(0);
    const doubled = useComputed(() => count.value * 2);

    useEffect(() => {
      el.querySelector('.count')!.textContent = String(count.value);
      el.querySelector('.doubled')!.textContent = String(doubled.value);
    });

    return html`
      <button onclick="this.getRootNode().host.increment()">+</button>
      <span class="count">0</span> (doubled: <span class="doubled">0</span>)
    `;
  },
  connected({ el }) {
    (el as any).increment = () => {
      // Access signal through closure
    };
  },
});
```

---

## Stores

### Use `createStore()` for shared state

```ts
import { createStore } from '@bquery/bquery/store';

export const authStore = createStore('auth', {
  state: {
    user: null as User | null,
    token: '',
  },
  getters: {
    isLoggedIn() { return this.user !== null; },
    displayName() { return this.user?.name ?? 'Guest'; },
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

const settings = createPersistedStore('settings', {
  state: { theme: 'light', language: 'en' },
  version: 1,
  migrate(state, oldVersion) {
    if (oldVersion < 1) state.language = 'en';
    return state;
  },
  actions: {
    setTheme(theme: string) { this.theme = theme; },
  },
});
```

---

## Router

### Use route guards for authentication

```ts
import { createRouter, navigate } from '@bquery/bquery/router';

createRouter({
  routes: [
    { path: '/', handler: () => renderHome() },
    {
      path: '/dashboard',
      handler: () => renderDashboard(),
      guard: () => {
        if (!authStore.state.isLoggedIn) {
          navigate('/login');
          return false;
        }
        return true;
      },
    },
  ],
});
```

### Use parameterized routes with constraints

```ts
createRouter({
  routes: [
    // Only matches numeric IDs
    { path: '/user/:id(\\d+)', handler: ({ params }) => showUser(params.id) },
    // Catches everything else
    { path: '/404', handler: () => show404() },
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
const results = signal([]);

effect(() => {
  const query = searchQuery.value;
  // Don't re-run this effect when `results` changes
  const currentResults = untrack(() => results.value);
  // ... expensive filtering
});
```

### Debounce reactive watchers

```ts
import { watchDebounce } from '@bquery/bquery/reactive';

const searchQuery = signal('');

watchDebounce(searchQuery, async (query) => {
  const results = await fetch(`/api/search?q=${query}`).then((r) => r.json());
  searchResults.value = results;
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
