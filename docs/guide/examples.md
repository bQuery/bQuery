# Examples & Recipes

Practical, copy-paste-ready examples for common web development tasks. Each recipe is self-contained and can be adapted for your project.

## Getting Started Recipes

### Hello World

The simplest bQuery program:

```html
<p id="greeting"></p>

<script type="module">
  import { $ } from 'https://cdn.jsdelivr.net/npm/@bquery/bquery/+esm';
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
  import { $, signal, effect } from 'https://cdn.jsdelivr.net/npm/@bquery/bquery/+esm';

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
  import { mount, signal } from '@bquery/bquery/view';

  const newTodo = signal('');
  const todos = signal([]);

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
import { $, signal, effect } from '@bquery/bquery';
import { useFetch } from '@bquery/bquery/reactive';

const { data, error, loading } = useFetch('/api/users');

effect(() => {
  if (loading.value) {
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
import { signal, effect } from '@bquery/bquery/reactive';
import { watchDebounce } from '@bquery/bquery/reactive';
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
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    results.value = await res.json();
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
    $('#active-users').text(data.value.activeUsers);
    $('#total-orders').text(data.value.totalOrders);
  }
});
```

### Paginated data loading

```ts
import { usePaginatedFetch } from '@bquery/bquery/reactive';
import { $, effect } from '@bquery/bquery';

const { data, page, next, prev, loading } = usePaginatedFetch(
  (p) => `/api/posts?page=${p}&limit=10`,
);

effect(() => {
  if (data.value) {
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
<form id="login-form" bq-on:submit.prevent="form.handleSubmit()">
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
import { createForm, required, email, minLength, matchField } from '@bquery/bquery/forms';
import { signal } from '@bquery/bquery/reactive';

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
import { component, html, useSignal, useEffect } from '@bquery/bquery/component';

component('toast-message', {
  props: { message: '', type: 'info', duration: '3000' },
  render({ props, el }) {
    const visible = useSignal(true);

    useEffect(() => {
      const timer = setTimeout(() => {
        visible.value = false;
        setTimeout(() => el.remove(), 300);
      }, Number(props.duration));
      return () => clearTimeout(timer);
    });

    return html`
      <div class="toast toast-${props.type}" style="opacity: ${visible.value ? 1 : 0}; transition: opacity 0.3s">
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
import { component, html, bool } from '@bquery/bquery/component';
import { signal, effect } from '@bquery/bquery/reactive';

component('modal-dialog', {
  props: { open: false, title: '' },
  render({ props }) {
    return html`
      <div class="modal-backdrop" style="display: ${props.open ? 'flex' : 'none'}">
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
<modal-dialog title="Confirm Action" ?open="${isOpen}">
  <p>Are you sure you want to continue?</p>
</modal-dialog>
```

---

## Routing

### Multi-page app with route transitions

```ts
import { createRouter, navigate, currentRoute } from '@bquery/bquery/router';
import { transition } from '@bquery/bquery/motion';
import { effect } from '@bquery/bquery/reactive';
import { $ } from '@bquery/bquery/core';

const pages: Record<string, string> = {
  home: '<h1>Home</h1><p>Welcome to our site!</p>',
  about: '<h1>About</h1><p>We build great things.</p>',
  contact: '<h1>Contact</h1><p>Get in touch at hello@example.com</p>',
};

createRouter({
  routes: [
    {
      path: '/',
      handler: () => transition(() => $('#content').html(pages.home)),
    },
    {
      path: '/about',
      handler: () => transition(() => $('#content').html(pages.about)),
    },
    {
      path: '/contact',
      handler: () => transition(() => $('#content').html(pages.contact)),
    },
  ],
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

const auth = createStore('auth', {
  state: { token: '' },
  getters: { isLoggedIn() { return this.token !== ''; } },
});

createRouter({
  routes: [
    { path: '/login', handler: () => showLogin() },
    {
      path: '/dashboard',
      handler: () => showDashboard(),
      guard: () => {
        if (!auth.state.isLoggedIn) {
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

const counter = createStore('counter', {
  state: { count: 0 },
  getters: {
    doubled() { return this.count * 2; },
    isPositive() { return this.count > 0; },
  },
  actions: {
    increment() { this.count++; },
    decrement() { this.count--; },
    reset() { this.count = 0; },
  },
});

effect(() => {
  $('#count').text(String(counter.state.count));
  $('#doubled').text(String(counter.state.doubled));
});

$('#inc-btn').on('click', () => counter.actions.increment());
$('#dec-btn').on('click', () => counter.actions.decrement());
$('#reset-btn').on('click', () => counter.actions.reset());
```

### Persisted theme store

```ts
import { createPersistedStore } from '@bquery/bquery/store';

const themeStore = createPersistedStore('theme', {
  state: { mode: 'light' as 'light' | 'dark', accentColor: '#3b82f6' },
  version: 1,
  actions: {
    toggleMode() {
      this.mode = this.mode === 'light' ? 'dark' : 'light';
    },
    setAccentColor(color: string) {
      this.accentColor = color;
    },
  },
});

// Apply theme reactively
effect(() => {
  document.documentElement.setAttribute('data-theme', themeStore.state.mode);
  document.documentElement.style.setProperty('--accent', themeStore.state.accentColor);
});
```

---

## Platform APIs

### Dark mode toggle with storage

```ts
import { storage } from '@bquery/bquery/platform';
import { signal, effect } from '@bquery/bquery/reactive';
import { $ } from '@bquery/bquery/core';

const isDark = signal(storage.get('dark-mode') === 'true');

effect(() => {
  document.documentElement.classList.toggle('dark', isDark.value);
  storage.set('dark-mode', String(isDark.value));
});

$('#theme-toggle').on('click', () => {
  isDark.value = !isDark.value;
});
```

### Browser notifications

```ts
import { notifications } from '@bquery/bquery/platform';

async function notifyUser(title: string, body: string) {
  const permission = await notifications.request();
  if (permission === 'granted') {
    notifications.show(title, { body });
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
import { trapFocus, releaseFocus } from '@bquery/bquery/a11y';

function openModal(modalEl: HTMLElement) {
  modalEl.hidden = false;
  trapFocus(modalEl);
}

function closeModal(modalEl: HTMLElement) {
  releaseFocus(modalEl);
  modalEl.hidden = true;
}
```

### Skip navigation link

```ts
import { skipLink } from '@bquery/bquery/a11y';

skipLink({ target: '#main-content', text: 'Skip to main content' });
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

const messages = signal<Array<{ user: string; text: string }>>([]);
const { data, send, status } = useWebSocket('wss://chat.example.com/ws');

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
  send(JSON.stringify({ text: input.attr('value') }));
  input.attr('value', '');
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

$('#lang-en').on('click', () => i18n.locale.value = 'en');
$('#lang-de').on('click', () => i18n.locale.value = 'de');
```

---

## Drag and Drop

### Sortable list

```ts
import { sortable } from '@bquery/bquery/dnd';

const cleanup = sortable('#task-list', {
  items: '.task-item',
  onSort: (items) => {
    console.log('New order:', items.map((el) => el.dataset.id));
  },
});
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
const taskStore = createStore('tasks', {
  state: { tasks: [] as Array<{ id: number; title: string; done: boolean }> },
  getters: {
    pending() { return this.tasks.filter((t) => !t.done); },
    completed() { return this.tasks.filter((t) => t.done); },
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
    taskStore.actions.add(values.title);
    form.reset();
  },
});

// ── Router ──
createRouter({
  routes: [
    {
      path: '/',
      handler: () => transition(() => showTaskList()),
    },
    {
      path: '/completed',
      handler: () => transition(() => showCompleted()),
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
