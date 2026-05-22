# Tutorial: build a notes app with bQuery

This tutorial walks through building a real, end-to-end **Notes** application using bQuery, one feature at a time. By the end you will have used:

- **Core** — `$` / `$$` selectors, DOM manipulation, events
- **Reactive** — signals, computed values, effects, `batch`
- **View** — declarative `bq-*` directives mounted on plain HTML
- **Store** — a Pinia-style notes store with persistence
- **Forms** — `createForm()` with synchronous and cross-field validation
- **Router** — multi-page SPA navigation with route params
- **Component** — a typed Web Component for a reusable note card
- **Platform** — `useCookie()` for user preferences, `storage` for persistence, `defineBqueryConfig()` for shared defaults
- **Motion** — `transition()` for animated page swaps
- **A11y** — `useAnnouncer()` for screen-reader announcements
- **Testing** — `renderComponent()` and `waitFor()` for the note card

We will start from the simplest possible bQuery script and grow it. Every section is additive — you can stop at any step and still have a working app.

> Everything in this tutorial uses APIs that are already covered in the other guides. When in doubt, follow the cross-reference links — they point at the canonical reference for each module.

## Prerequisites

You need a recent browser (Chrome 90+, Firefox 90+, Safari 15+, Edge 90+) and, for the build-based steps, **Node.js ≥ 24** or **Bun ≥ 1.3.13**.

You do not need React, Vue, Svelte, or any other framework. bQuery itself has zero runtime dependencies.

## Step 0 — Pick your setup

bQuery is happy in two very different worlds. Pick whichever matches your project today; the rest of this tutorial works the same way in both.

### A. Zero-build (CDN)

Drop a single `<script type="module">` into an HTML file. No bundler, no `package.json`, no install.

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Notes</title>
  </head>
  <body>
    <main id="app"></main>

    <script type="module">
      import { $ } from 'https://cdn.jsdelivr.net/npm/@bquery/bquery@1/+esm';
      $('#app').text('bQuery is working!');
    </script>
  </body>
</html>
```

Save it as `index.html`, open it in a browser, and you should see the text update.

> The `+esm` suffix on jsDelivr serves the ES module build. The unpkg equivalent is `https://unpkg.com/@bquery/bquery@1/dist/full.es.mjs` (see [Getting Started](./getting-started.md#zero-build-via-cdn)).

### B. Bundled (Vite + TypeScript)

If you prefer a build pipeline:

```bash
npm install @bquery/bquery
# or: bun add @bquery/bquery
# or: pnpm add @bquery/bquery
```

```ts
// src/main.ts
import { $ } from '@bquery/bquery';
$('#app').text('bQuery is working!');
```

All snippets in this tutorial work in both setups — only the import path changes.

## Step 1 — Reactive note list with `signal` + `effect`

We will start with the smallest possible reactive UI: an input box, an "Add" button, and a list of notes. No views, no stores yet — just signals.

```html
<main id="app">
  <h1>Notes</h1>
  <form id="composer">
    <input id="note-input" placeholder="Write a note…" autocomplete="off" />
    <button type="submit">Add</button>
  </form>
  <ul id="notes"></ul>
  <p id="count"></p>
</main>
```

```ts
import { $ } from '@bquery/bquery/core';
import { signal, computed, effect } from '@bquery/bquery/reactive';

interface Note {
  id: number;
  text: string;
}

const notes = signal<Note[]>([]);
const count = computed(() => notes.value.length);

effect(() => {
  // Re-render the list whenever notes changes.
  const ul = $('#notes');
  ul.empty();
  for (const note of notes.value) {
    ul.append(`<li data-id="${note.id}">${escapeText(note.text)}</li>`);
  }
});

effect(() => {
  $('#count').text(`${count.value} note(s)`);
});

$('#composer').on('submit', (event) => {
  event.preventDefault();
  const input = $('#note-input');
  const text = (input.val() ?? '').toString().trim();
  if (!text) return;
  notes.value = [...notes.value, { id: Date.now(), text }];
  input.val('');
});

function escapeText(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
```

Things to notice:

- `$('#composer').on('submit', …)` is the same chainable shape as jQuery, but the wrapper is bQuery's `BQueryElement`. `$` **throws** if no element matches, so use `$$` when an element is optional. See [Core API](./api-core.md).
- `signal()`, `computed()`, and `effect()` come from `@bquery/bquery/reactive`. The `.value` accessor is what makes a read **tracked**. Use `.peek()` to read without subscribing. See [Reactive](./reactive.md).
- We escape the note text by hand because we are setting `innerHTML` via `append()` with a string. In the next step we will switch to the **View module**, which sanitizes by default.

> Always pair a `signal()` mutation with a fresh array (`[...notes.value, …]`) rather than mutating in place. That is what triggers subscribers.

## Step 2 — Replace manual DOM with declarative `bq-*` directives

The view module lets you write templates with the same kind of `bq-*` directives Vue and Alpine use, then `mount()` them against a reactive context. Sanitization is on by default.

Replace the body of the page with:

```html
<main id="app">
  <h1>Notes</h1>

  <form bq-on:submit="$event.preventDefault(); addNote()">
    <input bq-model="draft" placeholder="Write a note…" autocomplete="off" />
    <button type="submit" bq-bind:disabled="!draft.trim()">Add</button>
  </form>

  <p bq-show="notes.length === 0">No notes yet — start typing above.</p>

  <ul>
    <li bq-for="note in notes" :key="note.id">
      <span bq-text="note.text"></span>
      <button bq-on:click="removeNote(note.id)" aria-label="Delete">×</button>
    </li>
  </ul>

  <p bq-text="`${notes.length} note(s)`"></p>
</main>
```

```ts
import { mount } from '@bquery/bquery/view';
import { signal } from '@bquery/bquery/reactive';

interface Note {
  id: number;
  text: string;
}

const draft = signal('');
const notes = signal<Note[]>([]);

function addNote() {
  const text = draft.value.trim();
  if (!text) return;
  notes.value = [...notes.value, { id: Date.now(), text }];
  draft.value = '';
}

function removeNote(id: number) {
  notes.value = notes.value.filter((n) => n.id !== id);
}

mount('#app', { draft, notes, addNote, removeNote });
```

What changed:

- `mount('#app', context)` walks the DOM under `#app` and wires up every `bq-*` directive against the context object.
- `bq-model` does two-way binding to a signal (no `.value` in the template — the view evaluates expressions in the context's scope).
- `bq-for="note in notes"` with `:key="note.id"` enables **keyed reconciliation** so reordering or removing items moves existing DOM nodes instead of recreating them.
- Inline expressions like `bq-bind:disabled="!draft.trim()"` are first-class — the view re-evaluates them whenever any signal they read changes.
- `bq-text` writes to `textContent`, so user input is never interpreted as HTML.

See [View](./view.md) for the full directive catalog (`bq-if`, `bq-show`, `bq-class`, `bq-style`, `bq-html` with sanitization, `bq-error`, `bq-aria`, `bq-bind:*`, `bq-on:*`, `bq-for`).

## Step 3 — Persist with a store

Right now, refreshing the page wipes all notes. Move state into a **store** so we can centralize logic and persist it.

```ts
// src/stores/notes-store.ts
import { createStore } from '@bquery/bquery/store';

export interface Note {
  id: number;
  text: string;
  pinned: boolean;
  createdAt: number;
}

export const notesStore = createStore({
  id: 'notes',
  state: () => ({
    notes: [] as Note[],
  }),
  getters: {
    count: (state) => state.notes.length,
    pinned: (state) => state.notes.filter((n) => n.pinned),
    sorted: (state) =>
      [...state.notes].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.createdAt - a.createdAt;
      }),
  },
  actions: {
    add(text: string) {
      const trimmed = text.trim();
      if (!trimmed) return;
      this.notes = [
        ...this.notes,
        { id: Date.now(), text: trimmed, pinned: false, createdAt: Date.now() },
      ];
    },
    remove(id: number) {
      this.notes = this.notes.filter((n) => n.id !== id);
    },
    togglePinned(id: number) {
      this.notes = this.notes.map((n) =>
        n.id === id ? { ...n, pinned: !n.pinned } : n,
      );
    },
    clear() {
      this.notes = [];
    },
  },
});
```

Wire the store into the view by passing it as context:

```ts
import { mount } from '@bquery/bquery/view';
import { signal } from '@bquery/bquery/reactive';
import { notesStore } from './stores/notes-store';

const draft = signal('');

mount('#app', {
  draft,
  store: notesStore,
  addNote: () => {
    notesStore.add(draft.value);
    draft.value = '';
  },
});
```

```html
<ul>
  <li bq-for="note in store.sorted" :key="note.id">
    <button bq-on:click="store.togglePinned(note.id)" bq-text="note.pinned ? '★' : '☆'"></button>
    <span bq-text="note.text"></span>
    <button bq-on:click="store.remove(note.id)" aria-label="Delete">×</button>
  </li>
</ul>
<p bq-text="`${store.count} note(s)`"></p>
```

::: warning Shallow reactivity
Store state is **shallow-reactive**. Always replace arrays/objects (`this.notes = [...]`, not `this.notes.push(…)`) so subscribers fire. See [Store › Shallow Reactivity](./store.md#state).
:::

### Persisting to `localStorage`

The platform module exposes a promise-based wrapper around `localStorage` that we can pair with the store's reactive state.

```ts
import { storage } from '@bquery/bquery/platform';
import { effect } from '@bquery/bquery/reactive';
import { notesStore, type Note } from './stores/notes-store';

const STORAGE_KEY = 'bquery-tutorial:notes';
const local = storage.local();

// Restore on boot.
const persisted = await local.get<Note[]>(STORAGE_KEY);
if (Array.isArray(persisted)) {
  notesStore.notes = persisted;
}

// Save on every change.
effect(() => {
  void local.set(STORAGE_KEY, notesStore.notes);
});
```

`storage.local()` returns a `StorageAdapter` with promise-based `get` / `set` / `remove` / `clear` / `keys`. The platform module also exposes `storage.session()` and `storage.indexedDB({ name, store })` if you outgrow `localStorage`. See [Platform › storage](./platform.md#storage).

## Step 4 — Validate the composer with `createForm()`

The free-text input is fine, but a real app should validate length and reject duplicates. Promote the composer to a real form.

```ts
import { createForm, required, minLength, maxLength } from '@bquery/bquery/forms';
import { mount } from '@bquery/bquery/view';
import { notesStore } from './stores/notes-store';

const composer = createForm({
  fields: {
    text: {
      initialValue: '',
      validators: [required('Please write something'), minLength(2), maxLength(280)],
    },
  },
  crossValidators: [
    (values) => {
      const exists = notesStore.notes.some(
        (n) => n.text.toLowerCase() === values.text.trim().toLowerCase(),
      );
      return exists ? { text: 'You already wrote that note' } : undefined;
    },
  ],
  onSubmit: (values) => {
    notesStore.add(values.text);
    composer.reset();
  },
});

mount('#app', { composer, store: notesStore });
```

```html
<form bq-on:submit="$event.preventDefault(); composer.handleSubmit()">
  <input bq-model="composer.fields.text.value" placeholder="Write a note…" />
  <p bq-error="composer.fields.text" class="error-text"></p>

  <button
    type="submit"
    bq-bind:disabled="composer.isSubmitting.value || !composer.isValid.value"
  >
    Add
  </button>
</form>
```

What is happening:

- Each field exposes `value`, `error`, `isTouched`, `isDirty` signals (see [Forms › Field state](./forms.md#field-state)).
- `bq-error="composer.fields.text"` renders the field's error message, hides itself when empty, and sets accessible defaults (`role="alert"`, `aria-live="assertive"`). See [View › bq-error](./view.md#bq-error).
- `crossValidators` runs after individual validators and can return per-field error messages.
- `handleSubmit()` runs validation, awaits `onSubmit`, and exposes `isSubmitting` as a signal so the button can disable itself reactively.

For async validators, validation strategies (`'manual' | 'change' | 'blur' | 'both'`), validator combinators, and dynamic field arrays via `createFieldArray()`, see [Forms](./forms.md).

If you use the forms-specific `compose()` combinator, import it from `@bquery/bquery/forms`. The root and `/full` entries intentionally keep `core.compose` as the unqualified `compose` export.

## Step 5 — A reusable Web Component

Let's extract the rendering of a single note into a typed Web Component. Components in bQuery are plain custom elements with typed props, optional state, lifecycle hooks, and a `render()` returning a tagged-template string.

```ts
import { bool, component, safeHtml } from '@bquery/bquery/component';

component('note-card', {
  props: {
    text: { type: String, required: true },
    pinned: { type: Boolean, default: false },
  },
  styles: `
    :host { display: block; }
    article {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
      background: var(--note-bg, #f5f5f7);
    }
    article.pinned { background: var(--note-pinned-bg, #fff7d6); }
    button { background: none; border: 0; cursor: pointer; }
  `,
  render({ props }) {
    return safeHtml`
      <article class="${props.pinned ? 'pinned' : ''}">
        <button
          type="button"
          ${bool('aria-pressed', props.pinned)}
          data-action="toggle-pin"
          aria-label="${props.pinned ? 'Unpin note' : 'Pin note'}"
        >${props.pinned ? '★' : '☆'}</button>
        <span>${props.text}</span>
        <button type="button" data-action="delete" aria-label="Delete note">×</button>
      </article>
    `;
  },
});
```

`safeHtml` (from `@bquery/bquery/component`) and `bool()` (boolean-attribute shorthand) keep the template both safe and ergonomic. `props.text` is escaped automatically because we interpolate it into a tagged template literal that goes through sanitization.

Use it from the view template — Web Components are just HTML elements, so directives still work:

```html
<ul>
  <li bq-for="note in store.sorted" :key="note.id">
    <note-card
      bq-bind:text="note.text"
      bq-bind:pinned="note.pinned"
      bq-on:click="handleNoteClick($event, note)"
    ></note-card>
  </li>
</ul>
```

```ts
function handleNoteClick(event: MouseEvent, note: { id: number }) {
  const action = (event.target as HTMLElement | null)?.closest<HTMLElement>(
    '[data-action]',
  )?.dataset.action;
  if (action === 'toggle-pin') notesStore.togglePinned(note.id);
  if (action === 'delete') notesStore.remove(note.id);
}
```

For props that are objects/arrays, the v1.13 `setProp` / `getProp` instance helpers let you set non-string props directly (see [Components › Props](./components.md#props)).

## Step 6 — Multi-page SPA with the router

Split the app into three routes: `/`, `/notes/:id`, and `/settings`.

```ts
// src/router.ts
import { createRouter, navigate, currentRoute } from '@bquery/bquery/router';

export const router = createRouter({
  routes: [
    { path: '/', component: () => import('./pages/Home') },
    { path: '/notes/:id', component: () => import('./pages/NoteDetail') },
    { path: '/settings', component: () => import('./pages/Settings') },
    { path: '*', component: () => import('./pages/NotFound') },
  ],
});

export { navigate, currentRoute };
```

Bind the current route into a single `<main>` slot using `effect()`:

```ts
import { effect } from '@bquery/bquery/reactive';
import { $ } from '@bquery/bquery/core';
import { currentRoute } from './router';

effect(() => {
  const route = currentRoute.value;
  const matched = route.matched;
  if (!matched) return;

  void (async () => {
    const mod = await (matched.component as () => Promise<{ render: (el: HTMLElement) => void }>)();
    const host = $('#view').empty().get(0);
    if (host) mod.render(host);
  })();
});
```

Read params from `currentRoute.value.params` in `NoteDetail`:

```ts
// src/pages/NoteDetail.ts
import { mount } from '@bquery/bquery/view';
import { computed } from '@bquery/bquery/reactive';
import { currentRoute, navigate } from '../router';
import { notesStore } from '../stores/notes-store';

export function render(host: HTMLElement) {
  const note = computed(() => {
    const id = Number(currentRoute.value.params.id);
    return notesStore.notes.find((n) => n.id === id) ?? null;
  });

  host.innerHTML = `
    <article bq-if="note">
      <h2 bq-text="note.text"></h2>
      <button bq-on:click="goBack()">Back</button>
    </article>
    <p bq-if="!note">Note not found.</p>
  `;

  mount(host, { note, goBack: () => navigate('/') });
}
```

For declarative `<a is="bq-link">` links, guards (`beforeEach`, `beforeEnter`), and the new `isNavigating` signal, see [Router](./router.md).

## Step 7 — Animate page transitions with `transition()`

Wrap each route swap in a View Transitions call so the browser can crossfade the change automatically, and fall back gracefully when the user prefers reduced motion.

```ts
import { effect } from '@bquery/bquery/reactive';
import { transition } from '@bquery/bquery/motion';
import { $ } from '@bquery/bquery/core';
import { currentRoute } from './router';

effect(() => {
  const route = currentRoute.value;
  const matched = route.matched;
  if (!matched) return;

  void (async () => {
    const mod = await (matched.component as () => Promise<{ render: (el: HTMLElement) => void }>)();

    await transition({
      classes: ['route-swap'],
      skipOnReducedMotion: true,
      update: () => {
        const host = $('#view').empty().get(0);
        if (host) mod.render(host);
      },
    });
  })();
});
```

Add a CSS rule for the `.route-swap` class to customize the View Transitions pseudo-elements. See [Motion › View transitions](./motion.md#view-transitions).

`transition()` automatically falls back to running `update` synchronously when the browser does not support the View Transitions API, so you do not have to feature-detect.

## Step 8 — Remember user preferences with `useCookie()`

We'll add a "compact mode" toggle that survives reloads via a cookie.

```ts
import { useCookie, defineBqueryConfig } from '@bquery/bquery/platform';

defineBqueryConfig({
  cookies: { sameSite: 'Lax', secure: location.protocol === 'https:' },
});

export const compact = useCookie<boolean>('notes.compact', {
  defaultValue: false,
  maxAge: 60 * 60 * 24 * 365, // 1 year
  serialize: (v) => (v ? '1' : '0'),
  deserialize: (raw) => raw === '1',
});
```

```html
<label>
  <input type="checkbox" bq-model="compact" />
  Compact mode
</label>

<main bq-class="{ compact: compact }">…</main>
```

`useCookie()` returns a writable signal, so you can drop it directly into `bq-model` and `bq-class`. See [Platform › useCookie](./platform.md#usecookie).

## Step 9 — Announce changes for assistive tech

Screen-reader users will not see a new `<li>` appear visually. Use `useAnnouncer()` from the platform module to post live-region messages.

```ts
import { useAnnouncer } from '@bquery/bquery/platform';

const announcer = useAnnouncer({ politeness: 'polite' });

// After a successful add:
announcer.announce(`Note added: ${text}`);

// After a delete:
announcer.announce('Note deleted', { politeness: 'assertive' });
```

For focus management, focus traps, and skip links, see [Accessibility](./a11y.md). The `bq-aria` directive can bind ARIA attributes from a reactive object — handy for compound widgets like menus and tabs.

## Step 10 — Test the note card

bQuery ships a `testing` module that mounts components inside `happy-dom` (or your test runner of choice) and exposes `fireEvent` / `waitFor`.

```ts
// tests/note-card.test.ts
import { describe, it, expect } from 'bun:test';
import { renderComponent, fireEvent, waitFor } from '@bquery/bquery/testing';
import '../src/components/note-card';

describe('<note-card>', () => {
  it('renders pinned state', async () => {
    const mounted = renderComponent('note-card', {
      props: { text: 'Hello', pinned: true },
    });

    await waitFor(() => mounted.el.shadowRoot?.querySelector('article.pinned'));

    expect(
      mounted.el.shadowRoot?.querySelector('article')?.classList.contains('pinned'),
    ).toBe(true);

    mounted.unmount();
  });

  it('emits click events from the pin button', async () => {
    const mounted = renderComponent('note-card', {
      props: { text: 'Hello', pinned: false },
    });

    let clicks = 0;
    mounted.el.addEventListener('click', () => clicks++);

    const pinButton = mounted.el.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-action="toggle-pin"]',
    );
    fireEvent(pinButton!, 'click');

    await waitFor(() => clicks === 1);
    expect(clicks).toBe(1);
    mounted.unmount();
  });
});
```

Run with `bun test`. The repo-wide convention is to create DOM inline, assert behavior, and clean up with `mounted.unmount()` / `.remove()` (see [Testing](./testing.md) and `AGENT.md`).

## Step 11 — (Optional) Render the first page on the server

You can stop here and ship the client app. For an SSR build, replace the static `index.html` with a small server that renders the template into a `Response` using the same view bindings.

```ts
// server.ts
import { createSSRContext, renderToResponse } from '@bquery/bquery/ssr';
import { createServer } from '@bquery/bquery/server';
import { notesStore } from './src/stores/notes-store';

const TEMPLATE = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title bq-text="title">Notes</title>
  </head>
  <body>
    <main id="app">
      <h1 bq-text="title"></h1>
      <ul>
        <li bq-for="note in notes" :key="note.id" bq-text="note.text"></li>
      </ul>
    </main>
    <script type="module" src="/client.js"></script>
  </body>
</html>`;

const app = createServer();
app.get('/', (ctx) => {
  const ssr = createSSRContext({ request: ctx.request });
  return renderToResponse(
    TEMPLATE,
    { title: 'My Notes', notes: notesStore.notes },
    { context: ssr, etag: true, cacheControl: 'public, max-age=0, must-revalidate' },
  );
});

export default app;
```

This same handler runs on Bun, Deno, and Node ≥ 24 — see the runnable example servers under [`examples/`](https://github.com/bQuery/bQuery/tree/main/examples) and the [SSR](./ssr.md) and [Server](./server.md) guides for hydration, streaming (`renderToStream`), `renderToStringAsync`, runtime adapters, and dependency-free WebSocket sessions.

## Where to go next

You have now used 11 modules of the framework in a single app. From here:

- **Forms expansion** — wire the v1.13 `bindForm`/`bindField` two-way bindings, dynamic field arrays via `createFieldArray()`, and SSR hydration via `serializeFormState()` / `hydrateForm()`. See [Forms](./forms.md).
- **Background work** — move heavy parsing or markdown rendering off the main thread with [Concurrency](./concurrency.md) (`runTask`, `createTaskPool`, RPC workers).
- **Realtime data** — connect to a live source with `useWebSocket()` / `useEventSource()` or sync via `useResource()` from [Reactive](./reactive.md).
- **i18n** — replace hard-coded strings with `createI18n()` and the `t()` reactive translator. See [i18n](./i18n.md).
- **Drag-and-drop** — make the note list re-orderable with `sortable()`. See [Drag & Drop](./dnd.md).
- **Devtools** — inspect signals, stores, and components at runtime with [Devtools](./devtools.md).
- **Best practices** — read [Best Practices](./best-practices.md) for patterns that scale from this app to a much larger codebase.

For the complete recipe cookbook (counter, chat, infinite scroll, dialogs, file uploads, etc.), see [Examples & Recipes](./examples.md).
