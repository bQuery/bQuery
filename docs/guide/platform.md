# Platform

The platform module provides consistent, promise‑based wrappers for common web platform APIs.

```ts
import {
  storage,
  cache,
  notifications,
  buckets,
  defineBqueryConfig,
  useCookie,
  definePageMeta,
  useAnnouncer,
} from '@bquery/bquery/platform';
```

## Global configuration

`defineBqueryConfig()` lets you set shared defaults once and reuse them across the `platform`, `reactive`, `motion`, and `component` modules.

```ts
defineBqueryConfig({
  fetch: {
    baseUrl: 'https://api.example.com',
    headers: { 'x-client': 'bquery-docs' },
    parseAs: 'json',
  },
  cookies: {
    path: '/',
    sameSite: 'Lax',
  },
  announcer: {
    politeness: 'polite',
    clearDelay: 1200,
  },
  pageMeta: {
    titleTemplate: (title) => `${title} · bQuery`,
  },
  transitions: {
    skipOnReducedMotion: true,
    classes: ['page-transition'],
  },
  components: {
    prefix: 'ui',
  },
});
```

Use `getBqueryConfig()` when you need a cloned snapshot of the current resolved config.

## Cookies

`useCookie()` creates a reactive signal backed by `document.cookie`.

```ts
const consent = useCookie<{ analytics: boolean }>('consent', {
  defaultValue: { analytics: false },
  maxAge: 60 * 60 * 24 * 365,
});

consent.value = { analytics: true };
```

### Cookie options

- `defaultValue`
- `path`, `domain`, `sameSite`, `secure`, `expires`, `maxAge`
- `watch` – disable auto-persistence when set to `false`
- `serialize` / `deserialize` – customize how values are stored

When `sameSite: 'None'` is used, bQuery automatically enforces `Secure`.

## Page metadata

`definePageMeta()` updates document title, meta/link tags, and temporary `html` / `body` attributes. It returns a cleanup function so route transitions or page swaps can revert state cleanly.

```ts
const cleanupMeta = definePageMeta({
  title: 'Dashboard',
  description: 'Overview of your account',
  meta: [{ property: 'og:type', content: 'website' }],
  link: [{ rel: 'canonical', href: 'https://example.com/dashboard' }],
  htmlAttributes: { lang: 'en' },
  bodyAttributes: { 'data-page': 'dashboard' },
});

// later
cleanupMeta();
```

## Accessible announcements

`useAnnouncer()` manages an ARIA live region for screen-reader friendly feedback.

```ts
const announcer = useAnnouncer({
  politeness: 'assertive',
  id: 'global-announcer',
});

announcer.announce('Saved successfully');
announcer.clear();
announcer.destroy();
```

### Announcer API

- `element` – the live-region element or `null`
- `message` – reactive signal containing the current announcement
- `announce(value, options?)`
- `clear()`
- `destroy()`

## Storage

Adapters for `localStorage`, `sessionStorage`, and a key‑value wrapper for `IndexedDB`.

```ts
const local = storage.local();
await local.set('theme', 'dark');
const theme = await local.get<string>('theme');

const session = storage.session();
await session.set('wizardStep', 2);

const db = storage.indexedDB({ name: 'bquery', store: 'kv' });
await db.set('user', { id: 1, name: 'Ada' });
```

### StorageAdapter interface

```ts
type StorageAdapter = {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
};
```

## Cache Storage

```ts
const assets = await cache.open('assets');
await assets.add('/styles.css');
const response = await assets.match('/styles.css');
await assets.remove('/styles.css');
```

### Cache handle

```ts
type CacheHandle = {
  add(url: string): Promise<void>;
  addAll(urls: string[]): Promise<void>;
  put(url: string, response: Response): Promise<void>;
  match(url: string): Promise<Response | undefined>;
  remove(url: string): Promise<boolean>;
  keys(): Promise<string[]>;
};
```

## Notifications

```ts
const permission = await notifications.requestPermission();
if (permission === 'granted') {
  notifications.send('Build complete', { body: 'Your docs are ready.' });
}
```

### Notifications API

- `isSupported()`
- `getPermission()`
- `requestPermission()`
- `send(title, options?)`

## Buckets

Storage buckets provide a blob store with an IndexedDB fallback.

```ts
const bucket = await buckets.open('assets');
await bucket.put('avatar', new Blob(['...']));
const avatar = await bucket.get('avatar');
await bucket.remove('avatar');
```

### Bucket API

- `put(key, data)`
- `get(key)`
- `remove(key)`
- `keys()`
