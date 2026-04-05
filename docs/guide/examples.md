# Examples & Recipes

Practical, copy-paste-ready examples for common web development tasks. Each recipe is self-contained and can be adapted for your project.

## Getting Started Recipes

### Hello World

The simplest bQuery program:

```html
<p id="greeting"></p>

<script type="module">
  import { $ } from 'https://cdn.jsdelivr.net/npm/@bquery/bquery@1/+esm';
  $('#greeting').text('Hello, World!');
</script>
```

### Reactive counter

A counter with signal-based state:

```html
<div id="app">
  <p id="count">0</p>
  <button id="increment">+</button>
  <button id="decrement">−</button>
</div>

<script type="module">
  import { $, signal, effect } from 'https://cdn.jsdelivr.net/npm/@bquery/bquery@1/+esm';

  const count = signal(0);

  effect(() => {
    $('#count').text(String(count.value));
  });

  $('#increment').on('click', () => count.value++);
  $('#decrement').on('click', () => count.value--);
</script>
```

### Todo list with view bindings

A simple todo list using the view module's declarative directives:

```html
<div id="app">
  <input bq-model="newTodo" placeholder="Add a todo..." />
  <button bq-on:click="addTodo()">Add</button>

  <ul>
    <li bq-for="todo in todos" bq-text="todo"></li>
  </ul>

  <p bq-show="todos.length === 0">No todos yet. Add one above!</p>
</div>

<script type="module">
  import { mount, signal } from 'https://cdn.jsdelivr.net/npm/@bquery/bquery@1/view/+esm';

  const newTodo = signal('');
  const todos = signal<string[]>([]);

  function addTodo() {
    const text = newTodo.value.trim();
    if (text) {
      todos.value = [...todos.value, text];
      newTodo.value = '';
    }
  }

  mount('#app', { newTodo, todos, addTodo });
</script>
```

---

## Data Fetching

### Fetch and display a user list

```ts
import { $, effect } from '@bquery/bquery';
import { useFetch } from '@bquery/bquery/reactive';

const { data, error, pending } = useFetch('/api/users');

effect(() => {
  if (pending.value) {
    $('#users').html('<p>Loading...</p>');
  } else if (error.value) {
    $('#users').html(`<p class="error">Failed to load users</p>`);
  } else {
    const users = data.value as Array<{ name: string; email: string }>;
    const html = users
      .map((u) => `<li>${u.name} — ${u.email}</li>`)
      .join('');
    $('#users').html(`<ul>${html}</ul>`);
  }
});
```

### Search with debounced input

```ts
import { signal, effect, watchDebounce } from '@bquery/bquery/reactive';
import { $ } from '@bquery/bquery/core';

const query = signal('');
const results = signal<string[]>([]);

$('#search-input').on('input', (e) => {
  query.value = (e.target as HTMLInputElement).value;
});

watchDebounce(
  query,
  async (q) => {
    if (!q) {
      results.value = [];
      return;
    }
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      results.value = await res.json();
    } catch (error) {
      console.error('Search request failed:', error);
      results.value = [];
    }
  },
  300,
);

effect(() => {
  const items = results.value;
  if (items.length === 0) {
    $('#results').html('<p>No results</p>');
  } else {
    $('#results').html(
      `<ul>${items.map((r) => `<li>${r}</li>`).join('')}</ul>`,
    );
  }
});
```

### Polling for live data

```ts
import { usePolling } from '@bquery/bquery/reactive';
import { $, effect } from '@bquery/bquery';

const { data, error } = usePolling('/api/dashboard/stats', {
  interval: 10000, // every 10 seconds
});

effect(() => {
  if (data.value) {
    $('#active-users').text(String(data.value.activeUsers));
    $('#total-orders').text(String(data.value.totalOrders));
  }
});
```

### Paginated data loading

```ts
import { usePaginatedFetch } from '@bquery/bquery/reactive';
import { $, effect } from '@bquery/bquery';

const { data, page, next, prev, pending } = usePaginatedFetch(
  (p) => `/api/posts?page=${p}&limit=10`,
);

effect(() => {
  if (pending.value) {
    $('#posts').html('<p>Loading...</p>');
  } else if (data.value) {
    const posts = data.value as Array<{ title: string }>;
    $('#posts').html(
      posts.map((p) => `<article><h3>${p.title}</h3></article>`).join(''),
    );
    $('#page-num').text(`Page ${page.value}`);
  }
});

$('#prev-btn').on('click', () => prev());
$('#next-btn').on('click', () => next());
```

---

## Forms & Validation

### Login form with validation

```ts
import { createForm, required, email } from '@bquery/bquery/forms';
import { mount } from '@bquery/bquery/view';

const form = createForm({
  fields: {
    email: { initialValue: '', validators: [required(), email()] },
    password: { initialValue: '', validators: [required()] },
  },
  onSubmit: async (values) => {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      const data = await res.json();
      form.setErrors(data.errors);
    }
  },
});

mount('#login-form', { form });
```

```html
<form id="login-form" bq-on:submit="$event.preventDefault(); void form.handleSubmit().catch((error) => console.error('Login submission failed', error))">
  <div>
    <label>Email</label>
    <input type="email" bq-model="form.fields.email.value" />
    <p bq-error="form.fields.email"></p>
  </div>

  <div>
    <label>Password</label>
    <input type="password" bq-model="form.fields.password.value" />
    <p bq-error="form.fields.password"></p>
  </div>

  <button type="submit" bq-bind:disabled="form.isSubmitting.value">
    <span bq-show="!form.isSubmitting.value">Log in</span>
    <span bq-show="form.isSubmitting.value">Logging in...</span>
  </button>
</form>
```

### Registration with password confirmation

```ts
import { createForm, required, email, minLength } from '@bquery/bquery/forms';

const form = createForm({
  fields: {
    name: { initialValue: '', validators: [required()] },
    email: { initialValue: '', validators: [required(), email()] },
    password: { initialValue: '', validators: [required(), minLength(8)] },
    confirmPassword: { initialValue: '', validators: [required()] },
  },
  crossValidators: [
    (values) =>
      values.password === values.confirmPassword
        ? undefined
        : { confirmPassword: 'Passwords must match' },
  ],
  onSubmit: async (values) => {
    await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
  },
});
```

### Standalone field validation

Use `useFormField()` when you need a single validated input without a full form:

```ts
import { $ } from '@bquery/bquery/core';
import { effect } from '@bquery/bquery/reactive';
import { useFormField, required, email } from '@bquery/bquery/forms';

const emailField = useFormField('', {
  validators: [required(), email()],
  validateOn: 'blur',
});

// Wire it up
$('#email-input').on('input', (e) => {
  emailField.value.value = (e.target as HTMLInputElement).value;
});

$('#email-input').on('blur', () => emailField.touch());

effect(() => {
  const error = emailField.error.value;
  $('#email-error').text(error ?? '');
});
```

---

## Components

### A notification toast

```ts
import { component, html } from '@bquery/bquery/component';

component('toast-message', {
  props: {
    message: { type: String, default: '' },
    type: { type: String, default: 'info' },
    duration: { type: Number, default: 3000 },
  },
  connected() {
    const duration = Number(this.getAttribute('duration') ?? '3000');
    window.setTimeout(() => this.remove(), duration);
  },
  render({ props }) {
    return html`
      <div class="toast toast-${props.type}">
        ${props.message}
      </div>
    `;
  },
});

// Usage
function showToast(message: string, type = 'info') {
  const toast = document.createElement('toast-message');
  toast.setAttribute('message', message);
  toast.setAttribute('type', type);
  document.body.appendChild(toast);
}
```

### Reusable modal dialog

```ts
import { bool, component, html } from '@bquery/bquery/component';

component('modal-dialog', {
  props: {
    open: { type: Boolean, default: false },
    title: { type: String, default: '' },
  },
  render({ props }) {
    return html`
      <div class="modal-backdrop" ${bool('hidden', !props.open)}>
        <div class="modal-content" role="dialog" aria-modal="true">
          <header>
            <h2>${props.title}</h2>
            <button class="close-btn" aria-label="Close">×</button>
          </header>
          <div class="modal-body">
            <slot></slot>
          </div>
        </div>
      </div>
    `;
  },
});
```

```html
<modal-dialog id="confirmDialog" title="Confirm Action">
  <p>Are you sure you want to continue?</p>
</modal-dialog>

<script type="module">
  const dialog = document.getElementById('confirmDialog');
  const isOpen = true;

  if (isOpen) {
    dialog?.setAttribute('open', '');
  } else {
    dialog?.removeAttribute('open');
  }
</script>
```

---

## Routing

### Multi-page app with route transitions

```ts
import { $, $$ } from '@bquery/bquery/core';
import { transition } from '@bquery/bquery/motion';
import { effect } from '@bquery/bquery/reactive';
import { createRouter, navigate, currentRoute } from '@bquery/bquery/router';

const pages: Record<string, string> = {
  home: '<h1>Home</h1><p>Welcome to our site!</p>',
  about: '<h1>About</h1><p>We build great things.</p>',
  contact: '<h1>Contact</h1><p>Get in touch at hello@example.com</p>',
};

createRouter({
  routes: [
    {
      path: '/',
      component: () => transition(() => $('#content').html(pages.home)),
    },
    {
      path: '/about',
      component: () => transition(() => $('#content').html(pages.about)),
    },
    {
      path: '/contact',
      component: () => transition(() => $('#content').html(pages.contact)),
    },
  ],
});

// The router updates currentRoute for you; this effect renders the matched view.
effect(() => {
  const component = currentRoute.value.matched?.component;
  if (!component) return;

  const result = component();
  if (result instanceof Promise) {
    void result.catch((error) => console.error('Route render failed', error));
  }
});

// Highlight active navigation link
effect(() => {
  $$('.nav-link').removeClass('active');
  const path = currentRoute.value.path;
  $$(`[href="${path}"]`).addClass('active');
});
```

### Protected routes with guards

```ts
import { createRouter, navigate } from '@bquery/bquery/router';
import { createStore } from '@bquery/bquery/store';

const auth = createStore({
  id: 'auth',
  state: () => ({ token: '' }),
  getters: {
    isLoggedIn: (state) => state.token !== '',
  },
});

createRouter({
  routes: [
    { path: '/login', component: () => showLogin() },
    {
      path: '/dashboard',
      component: () => showDashboard(),
      beforeEnter: () => {
        if (!auth.isLoggedIn) {
          navigate('/login');
          return false;
        }
        return true;
      },
    },
  ],
});
```

---

## Motion & Animation

### Fade-in elements on scroll

```ts
import { scrollAnimate, keyframePresets } from '@bquery/bquery/motion';

const cleanup = scrollAnimate(document.querySelectorAll('.fade-on-scroll'), {
  keyframes: keyframePresets.fadeIn(),
  options: { duration: 400, easing: 'ease-out' },
  rootMargin: '0px 0px -15% 0px',
});
```

```html
<div class="fade-on-scroll">This fades in when scrolled into view</div>
<div class="fade-on-scroll">So does this</div>
```

### Card flip animation

```ts
import { capturePosition, flip } from '@bquery/bquery/motion';

async function swapCards(cardA: HTMLElement, cardB: HTMLElement) {
  const posA = capturePosition(cardA);
  const posB = capturePosition(cardB);

  // Swap DOM positions
  const parent = cardA.parentElement!;
  const placeholder = document.createElement('div');
  parent.insertBefore(placeholder, cardA);
  parent.insertBefore(cardA, cardB);
  parent.insertBefore(cardB, placeholder);
  placeholder.remove();

  // Animate smoothly to new positions
  await Promise.all([
    flip(cardA, posA, { duration: 300, easing: 'ease-out' }),
    flip(cardB, posB, { duration: 300, easing: 'ease-out' }),
  ]);
}
```

### Staggered list entrance

```ts
import { animate, stagger, keyframePresets } from '@bquery/bquery/motion';

const items = document.querySelectorAll('.list-item');
const delay = stagger(50);

items.forEach((item, i) => {
  animate(item, {
    keyframes: keyframePresets.fadeIn(),
    options: {
      duration: 300,
      easing: 'ease-out',
      delay: delay(i, items.length),
    },
  });
});
```

### Spring-based drag

```ts
import { spring, springPresets } from '@bquery/bquery/motion';

const x = spring(0, springPresets.snappy);
const y = spring(0, springPresets.snappy);
const box = document.querySelector('#draggable')!;

x.onChange((val) => (box.style.transform = `translate(${val}px, ${y.current()}px)`));
y.onChange((val) => (box.style.transform = `translate(${x.current()}px, ${val}px)`));

box.addEventListener('pointerdown', (e) => {
  const startX = e.clientX - x.current();
  const startY = e.clientY - y.current();

  const onMove = (e: PointerEvent) => {
    x.to(e.clientX - startX);
    y.to(e.clientY - startY);
  };

  const onUp = () => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    // Snap back to origin
    x.to(0);
    y.to(0);
  };

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
});
```

---

## State Management

### Global counter store

```ts
import { createStore } from '@bquery/bquery/store';
import { effect } from '@bquery/bquery/reactive';
import { $ } from '@bquery/bquery/core';

const counter = createStore({
  id: 'counter',
  state: () => ({ count: 0 }),
  getters: {
    doubled: (state) => state.count * 2,
    isPositive: (state) => state.count > 0,
  },
  actions: {
    increment() { this.count++; },
    decrement() { this.count--; },
    reset() { this.count = 0; },
  },
});

effect(() => {
  $('#count').text(String(counter.count));
  $('#doubled').text(String(counter.doubled));
});

$('#inc-btn').on('click', () => counter.increment());
$('#dec-btn').on('click', () => counter.decrement());
$('#reset-btn').on('click', () => counter.reset());
```

### Persisted theme store

```ts
import { effect } from '@bquery/bquery/reactive';
import { createPersistedStore } from '@bquery/bquery/store';

const themeStore = createPersistedStore(
  {
    id: 'theme',
    state: () => ({ mode: 'light' as 'light' | 'dark', accentColor: '#3b82f6' }),
    actions: {
      toggleMode() {
        this.mode = this.mode === 'light' ? 'dark' : 'light';
      },
      setAccentColor(color: string) {
        this.accentColor = color;
      },
    },
  },
  { version: 1 }
);

// Apply theme reactively
effect(() => {
  document.documentElement.setAttribute('data-theme', themeStore.mode);
  document.documentElement.style.setProperty('--accent', themeStore.accentColor);
});
```

---

## Platform APIs

### Dark mode toggle with storage

```ts
import { storage } from '@bquery/bquery/platform';
import { signal, effect } from '@bquery/bquery/reactive';
import { $ } from '@bquery/bquery/core';

const local = storage.local();
const isDark = signal(false);

// Storage operations are async, so initialize from persisted state after setup.
async function initTheme() {
  isDark.value = (await local.get('dark-mode')) === 'true';
}

initTheme().catch((error) => {
  console.error('Failed to load theme preference:', error);
});

effect(() => {
  document.documentElement.classList.toggle('dark', isDark.value);
  local.set('dark-mode', String(isDark.value)).catch((error) => {
    console.error('Failed to save theme preference:', error);
  });
});

$('#theme-toggle').on('click', () => {
  isDark.value = !isDark.value;
});
```

### Browser notifications

```ts
import { $ } from '@bquery/bquery/core';
import { notifications } from '@bquery/bquery/platform';

async function notifyUser(title: string, body: string) {
  const permission = await notifications.requestPermission();
  if (permission === 'granted') {
    notifications.send(title, { body });
  }
}

$('#notify-btn').on('click', () => {
  notifyUser('New message', 'You have a new notification!');
});
```

---

## Accessibility

### Focus trap in a modal

```ts
import { trapFocus } from '@bquery/bquery/a11y';

// trapFocus() returns a handle you can release later.
let focusTrapHandle: ReturnType<typeof trapFocus> | null = null;

function openModal(modalEl: HTMLElement) {
  focusTrapHandle?.release();
  modalEl.hidden = false;
  focusTrapHandle = trapFocus(modalEl);
}

function closeModal(modalEl: HTMLElement) {
  focusTrapHandle?.release();
  focusTrapHandle = null;
  modalEl.hidden = true;
}
```

### Skip navigation link

```ts
import { skipLink } from '@bquery/bquery/a11y';

skipLink('#main-content', { text: 'Skip to main content' });
```

### Screen reader announcements

```ts
import { announceToScreenReader } from '@bquery/bquery/a11y';

// Announce form submission result
async function submitForm() {
  try {
    await saveData();
    announceToScreenReader('Form saved successfully', 'polite');
  } catch {
    announceToScreenReader('Error saving form. Please try again.', 'assertive');
  }
}
```

---

## Real-time Communication

### Live chat with WebSocket

```ts
import { useWebSocket } from '@bquery/bquery/reactive';
import { signal, effect } from '@bquery/bquery/reactive';
import { $ } from '@bquery/bquery/core';

type ChatMessage = { user: string; text: string };
type OutgoingChatMessage = { text: string };

const messages = signal<ChatMessage[]>([]);
const { data, send, status } = useWebSocket<OutgoingChatMessage, ChatMessage>(
  'wss://chat.example.com/ws',
);

// Update messages when new data arrives
effect(() => {
  if (data.value) {
    messages.value = [...messages.value, data.value];
  }
});

// Render messages
effect(() => {
  const html = messages.value
    .map((m) => `<div class="message"><b>${m.user}:</b> ${m.text}</div>`)
    .join('');
  $('#chat-messages').html(html);
});

// Send a message
$('#send-btn').on('click', () => {
  const input = $('#message-input');
  send({ text: (input.raw as HTMLInputElement).value });
  (input.raw as HTMLInputElement).value = '';
});

// Show connection status
effect(() => {
  $('#connection-status').text(status.value);
});
```

### Server-Sent Events for live updates

```ts
import { useEventSource } from '@bquery/bquery/reactive';
import { effect } from '@bquery/bquery/reactive';
import { $ } from '@bquery/bquery/core';

const { data, status } = useEventSource('/api/events');

effect(() => {
  if (data.value) {
    $('#live-feed').prepend(`<div class="event">${data.value}</div>`);
  }
});
```

---

## Internationalization

### Multi-language app

```ts
import { createI18n } from '@bquery/bquery/i18n';
import { effect } from '@bquery/bquery/reactive';
import { $ } from '@bquery/bquery/core';

const i18n = createI18n({
  locale: 'en',
  messages: {
    en: {
      greeting: 'Hello, {name}!',
      items: '{count} item | {count} items',
    },
    de: {
      greeting: 'Hallo, {name}!',
      items: '{count} Artikel | {count} Artikel',
    },
  },
});

effect(() => {
  $('#greeting').text(i18n.t('greeting', { name: 'World' }));
  $('#item-count').text(i18n.t('items', { count: 5 }));
});

$('#lang-en').on('click', () => i18n.$locale.value = 'en');
$('#lang-de').on('click', () => i18n.$locale.value = 'de');
```

---

## Drag and Drop

### Sortable list

```ts
import { sortable } from '@bquery/bquery/dnd';
import { $ } from '@bquery/bquery/core';

const taskList = $('#task-list').raw;

const handle = sortable(taskList, {
  items: '.task-item',
  onSortEnd: ({ oldIndex, newIndex }) => {
    const items = Array.from(taskList.querySelectorAll<HTMLElement>('.task-item'));
    console.log('Moved:', { oldIndex, newIndex });
    console.log('New order:', items.map((el) => el.dataset.id));
  },
});

// Later, when you no longer need sorting:
handle.destroy();
```

```html
<ul id="task-list">
  <li class="task-item" data-id="1">Task 1</li>
  <li class="task-item" data-id="2">Task 2</li>
  <li class="task-item" data-id="3">Task 3</li>
</ul>
```

---

## Testing

### Test a component

```ts
import { describe, test, expect } from 'bun:test';
import { renderComponent, fireEvent, waitFor } from '@bquery/bquery/testing';

describe('my-counter', () => {
  test('increments on click', async () => {
    const { el, unmount } = renderComponent('my-counter');

    const button = el.querySelector('button')!;
    fireEvent(button, 'click');

    await waitFor(() => {
      expect(el.textContent).toContain('1');
    });

    unmount();
  });

  test('starts at zero', () => {
    const { el, unmount } = renderComponent('my-counter');
    expect(el.textContent).toContain('0');
    unmount();
  });
});
```

### Mock signals in tests

```ts
import { expect, test } from 'bun:test';
import { effect } from '@bquery/bquery/reactive';
import { mockSignal } from '@bquery/bquery/testing';

test('displays user name', () => {
  const userName = mockSignal('Ada Lovelace');

  effect(() => {
    expect(userName.value).toBe('Ada Lovelace');
  });

  userName.value = 'Grace Hopper';
  // effect re-runs automatically
});
```

---

## Full Application: Task Manager

A complete mini-application combining several modules:

```ts
import { createStore } from '@bquery/bquery/store';
import { createForm, required } from '@bquery/bquery/forms';
import { createRouter, navigate } from '@bquery/bquery/router';
import { mount, signal } from '@bquery/bquery/view';
import { transition } from '@bquery/bquery/motion';

// ── Store ──
const taskStore = createStore({
  id: 'tasks',
  state: () => ({ tasks: [] as Array<{ id: number; title: string; done: boolean }> }),
  getters: {
    pending: (state) => state.tasks.filter((t) => !t.done),
    completed: (state) => state.tasks.filter((t) => t.done),
  },
  actions: {
    add(title: string) {
      this.tasks = [...this.tasks, { id: Date.now(), title, done: false }];
    },
    toggle(id: number) {
      this.tasks = this.tasks.map((t) =>
        t.id === id ? { ...t, done: !t.done } : t,
      );
    },
    remove(id: number) {
      this.tasks = this.tasks.filter((t) => t.id !== id);
    },
  },
});

// ── Form ──
const form = createForm({
  fields: {
    title: { initialValue: '', validators: [required()] },
  },
  onSubmit: async (values) => {
    taskStore.add(values.title);
    form.reset();
  },
});

// ── Router ──
createRouter({
  routes: [
    {
      path: '/',
      component: () => transition(() => showTaskList()),
    },
    {
      path: '/completed',
      component: () => transition(() => showCompleted()),
    },
  ],
});
```

---

## Next steps

- [Getting Started](/guide/getting-started) — installation and setup
- [Core API](/guide/api-core) — full DOM API reference
- [Reactive](/guide/reactive) — signals, effects, async data
- [Best Practices](/guide/best-practices) — patterns and recommendations
- [FAQ](/guide/faq) — common questions and troubleshooting
