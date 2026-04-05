# Migrating from jQuery

This guide helps you transition from jQuery to bQuery.js. The mental model is similar — query elements, chain methods, handle events — but bQuery adds reactivity, type safety, and modern APIs.

## Quick comparison

```js
// jQuery
$('#name').text('Ada');
$('.items').addClass('active');
$('#btn').on('click', () => alert('clicked'));

// bQuery
$('#name').text('Ada');
$$('.items').addClass('active');
$('#btn').on('click', () => alert('clicked'));
```

The syntax is intentionally familiar. The key differences:

- `$()` returns a **single element** wrapper (`BQueryElement`) and **throws** if not found
- `$$()` returns a **collection** wrapper (`BQueryCollection`) and never throws
- Everything is **TypeScript-first** with full type inference
- HTML-writing methods **sanitize content** by default

---

## Selectors

### Single element: `$()`

jQuery's `$()` returns a collection that may be empty. bQuery's `$()` returns exactly one element or throws.

```js
// jQuery — silently returns empty collection
const maybeEl = $('#maybe-exists'); // maybeEl.length might be 0

// bQuery — throws if not found
const mustEl = $('#must-exist'); // guaranteed to exist

// bQuery — safe alternative for optional elements
const els = $$('#maybe-exists'); // empty collection if not found
```

### Multiple elements: `$$()`

```js
// jQuery
$('.card').each(function () {
  $(this).addClass('visible');
});

// bQuery — operates on the whole collection without a callback
$$('.card').addClass('visible');
```

### Context-scoped queries

```js
// jQuery
$('.item', '#container');

// bQuery
$('#container').find('.item');
$$('#container .item');
```

---

## DOM Manipulation

### Getting and setting text

```js
// jQuery
$('#title').text('Hello');
const title = $('#title').text();

// bQuery — identical API
$('#title').text('Hello');
const title = $('#title').text();
```

### Getting and setting HTML

```js
// jQuery — no sanitization
$('#content').html('<b>Bold</b>');

// bQuery — sanitized by default (strips dangerous tags)
$('#content').html('<b>Bold</b>');

// bQuery — raw HTML when you trust the source
$('#content').raw.innerHTML = trustedHtml;
```

### Adding and removing classes

```js
// jQuery
$('#el').addClass('active');
$('#el').removeClass('hidden');
$('#el').toggleClass('open');
$('#el').hasClass('active');

// bQuery — same API
$('#el').addClass('active');
$('#el').removeClass('hidden');
$('#el').toggleClass('open');
$('#el').hasClass('active');
```

### CSS styles

```js
// jQuery
$('#el').css('color', 'red');
$('#el').css({ color: 'red', fontSize: '18px' });

// bQuery — same API
$('#el').css('color', 'red');
$('#el').css({ color: 'red', fontSize: '18px' });
```

### Attributes and data

```js
// jQuery
$('#el').attr('aria-label', 'Close');
$('#el').data('id', 42);

// bQuery
$('#el').attr('aria-label', 'Close');
$('#el').data('id', 42);
```

### Append, prepend, and remove

```js
// jQuery
$('#list').append('<li>New item</li>');
$('#list').prepend('<li>First item</li>');
$('#item').remove();

// bQuery — same API, with automatic sanitization
$('#list').append('<li>New item</li>');
$('#list').prepend('<li>First item</li>');
$('#item').remove();
```

---

## Events

### Basic event handling

```js
// jQuery
const handleClick = (e) => console.log('clicked');
$('#btn').on('click', handleClick);
$('#btn').off('click', handleClick);

// bQuery — keep a reference to the handler you want to remove
const handleBqClick = (e) => console.log('clicked');
$('#btn').on('click', handleBqClick);
$('#btn').off('click', handleBqClick);
```

### Event delegation

```js
// jQuery
$(document).on('click', '.dynamic-btn', handler);

// bQuery
$('#container').delegate('click', '.dynamic-btn', handler);
```

### Keyboard and input events

```js
// jQuery
$('#input').on('keydown', (e) => {
  if (e.key === 'Enter') submit();
});

// bQuery — same API
$('#input').on('keydown', (e) => {
  if (e.key === 'Enter') submit();
});
```

---

## AJAX → Reactive Data

This is where bQuery diverges most from jQuery. Instead of callback-based AJAX, bQuery provides **signal-based async primitives**.

### Simple fetch

```js
// jQuery
$.ajax({
  url: '/api/users',
  success: (data) => renderUsers(data),
  error: (xhr) => showError(xhr.statusText),
});

// bQuery
import { effect, useFetch } from '@bquery/bquery/reactive';

const { data, error, pending } = useFetch('/api/users');

effect(() => {
  if (pending.value) showSpinner();
  else if (error.value) showError(error.value.message);
  else renderUsers(data.value);
});
```

### POST requests

```js
// jQuery
$.post('/api/users', { name: 'Ada' }, (response) => {
  console.log(response);
});

// bQuery
import { http } from '@bquery/bquery/reactive';

const response = await http.post('/api/users', {
  body: JSON.stringify({ name: 'Ada' }),
});
```

### Polling

```js
// jQuery — manual setInterval
const timer = setInterval(async () => {
  const data = await $.get('/api/status');
  $('#status').text(data.message);
}, 5000);

// bQuery — declarative polling
import { $ } from '@bquery/bquery/core';
import { effect, usePolling } from '@bquery/bquery/reactive';

const { data } = usePolling('/api/status', { interval: 5000 });

effect(() => {
  if (data.value) $('#status').text(data.value.message);
});
```

### WebSocket

```js
// jQuery — manual WebSocket management
const ws = new WebSocket('wss://example.com/chat');
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  $('#messages').append(`<p>${msg.text}</p>`);
};

// bQuery — reactive WebSocket
import { $ } from '@bquery/bquery/core';
import { effect, useWebSocket } from '@bquery/bquery/reactive';

type ChatMessage = { text: string };

const { data, send } = useWebSocket<ChatMessage, ChatMessage>('wss://example.com/chat');

effect(() => {
  if (data.value) {
    $('#messages').append(`<p>${data.value.text}</p>`);
  }
});

send({ text: 'Hello!' });
```

---

## Animations

### Basic animations

```js
// jQuery
$('#card').fadeIn(200);
$('#card').slideUp(300);

// bQuery — Web Animations API
import { animate, keyframePresets } from '@bquery/bquery/motion';

const card = document.querySelector('#card')!;

await animate(card, {
  keyframes: keyframePresets.fadeIn(),
  options: { duration: 200 },
});
```

### View transitions (no jQuery equivalent)

```ts
import { $ } from '@bquery/bquery/core';
import { transition } from '@bquery/bquery/motion';

await transition(() => {
  $('#content').html(newContent);
});
```

---

## What bQuery adds beyond jQuery

These features have no jQuery equivalent:

### Reactive state

```ts
import { $ } from '@bquery/bquery/core';
import { signal, computed, effect } from '@bquery/bquery/reactive';

const count = signal(0);
const doubled = computed(() => count.value * 2);

effect(() => {
  $('#output').text(`${count.value} × 2 = ${doubled.value}`);
});
```

### Declarative view bindings

```html
<div id="app">
  <input bq-model="name" />
  <p bq-text="'Hello, ' + name + '!'"></p>
</div>
```

```ts
import { mount, signal } from '@bquery/bquery/view';
mount('#app', { name: signal('World') });
```

### Web Components

```ts
import { component, html } from '@bquery/bquery/component';

component('user-card', {
  props: {
    name: { type: String, default: '' },
    avatar: { type: String, default: '' },
  },
  render({ props }) {
    return html`
      <img src="${props.avatar}" alt="${props.name}" />
      <h3>${props.name}</h3>
    `;
  },
});
```

### Reactive forms

```ts
import { createForm, required, email } from '@bquery/bquery/forms';

const form = createForm({
  fields: {
    email: { initialValue: '', validators: [required(), email()] },
  },
  onSubmit: async (values) => {
    await fetch('/api/register', { method: 'POST', body: JSON.stringify(values) });
  },
});
```

### Client-side routing

```ts
import { effect } from '@bquery/bquery/reactive';
import { createRouter, currentRoute, navigate } from '@bquery/bquery/router';

createRouter({
  routes: [
    { path: '/', component: () => showHome() },
    { path: '/about', component: () => showAbout() },
  ],
});

// bQuery keeps routing and rendering separate, so render the matched view reactively.
effect(() => {
  const component = currentRoute.value.matched?.component;
  if (!component) return;

  const result = component();
  if (result instanceof Promise) {
    void result.catch((error) => console.error('Route render failed', error));
  }
});
```

### State management

```ts
import { createStore } from '@bquery/bquery/store';

const counter = createStore({
  id: 'counter',
  state: () => ({ count: 0 }),
  getters: {
    doubled: (state) => state.count * 2,
  },
  actions: {
    increment() { this.count++; },
  },
});
```

---

## Migration checklist

Use this as a step-by-step migration plan:

- [ ] **Replace `<script src="jquery.js">`** with `<script type="module">` and bQuery CDN import
- [ ] **Replace `$()` selector calls** — use `$()` for required elements, `$$()` for optional/collections
- [ ] **Replace `$.ajax()`** calls with `useFetch()`, `http`, or `useSubmit()`
- [ ] **Replace `$.each()`** with native `for...of`, `$$().each(...)`, or iteration over `$$().elements`
- [ ] **Replace jQuery animations** with `animate()`, `transition()`, or CSS transitions
- [ ] **Replace `$(document).ready()`** — ES modules run deferred by default, no wrapper needed
- [ ] **Add reactive state** where you previously had manual DOM updates
- [ ] **Add TypeScript** for better autocompletion and error checking (optional but recommended)

### `$(document).ready()` is not needed

ES modules (`type="module"`) are deferred by default, so your code already runs after the DOM is ready:

```html
<!-- jQuery -->
<script>
  $(document).ready(function () {
    // DOM is ready
  });
</script>

<!-- bQuery — just write your code -->
<script type="module">
  import { $ } from 'https://cdn.jsdelivr.net/npm/@bquery/bquery@1/+esm';
  // DOM is already ready
  $('#app').text('Hello!');
</script>
```

---

## Need help?

- [Getting Started](/guide/getting-started) — full setup instructions
- [Core API](/guide/api-core) — complete DOM API reference
- [Reactive](/guide/reactive) — signals, effects, and async data
- [FAQ & Troubleshooting](/guide/faq) — common issues and solutions
