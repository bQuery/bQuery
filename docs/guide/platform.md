# Platform

The platform module provides consistent, promise-based wrappers for common web platform APIs: storage, caching, notifications, cookies, page metadata, ARIA announcements, and global configuration.

```ts
import {
  buckets,
  cache,
  defineBqueryConfig,
  definePageMeta,
  getBqueryConfig,
  notifications,
  storage,
  useAnnouncer,
  useCookie,
} from '@bquery/bquery/platform';
```

---

## Global Configuration

### `defineBqueryConfig()`

Sets shared defaults that are reused across the `platform`, `reactive`, `motion`, and `component` modules. Call once at the start of your application.

```ts
function defineBqueryConfig(config: BqueryConfig): BqueryConfig;
```

Returns the resolved configuration after merging.

#### `BqueryConfig`

```ts
interface BqueryConfig {
  /** Default fetch configuration. */
  fetch?: BqueryFetchConfig;
  /** Default cookie settings. */
  cookies?: BqueryCookieConfig;
  /** Default announcer settings. */
  announcer?: BqueryAnnouncerConfig;
  /** Default page metadata settings. */
  pageMeta?: BqueryPageMetaConfig;
  /** Default transition settings. */
  transitions?: BqueryTransitionConfig;
  /** Default component library settings. */
  components?: BqueryComponentLibraryConfig;
}
```

#### Sub-Configs

```ts
interface BqueryFetchConfig {
  /** Base URL for relative requests. */
  baseUrl?: string;
  /** Default request headers. */
  headers?: HeadersInit;
  /** Default response parser. Default: `'json'` */
  parseAs?: 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData' | 'response';
}

interface BqueryCookieConfig {
  /** Default cookie path. Default: `'/'` */
  path?: string;
  /** Default SameSite mode. Default: `'Lax'` */
  sameSite?: 'Strict' | 'Lax' | 'None';
  /** Whether cookies should be marked secure. Default: `false` */
  secure?: boolean;
}

interface BqueryAnnouncerConfig {
  /** Default politeness level. Default: `'polite'` */
  politeness?: 'polite' | 'assertive';
  /** Whether announcements are atomic. Default: `true` */
  atomic?: boolean;
  /** Message delay in milliseconds. Default: `16` */
  delay?: number;
  /** Auto-clear delay in milliseconds. Default: `1000` */
  clearDelay?: number;
}

interface BqueryPageMetaConfig {
  /** Optional title template function. */
  titleTemplate?: (title: string) => string;
}

interface BqueryTransitionConfig {
  /** Skip transitions when reduced motion is preferred. */
  skipOnReducedMotion?: boolean;
  /** CSS classes applied during transitions. */
  classes?: string[];
  /** Transition type identifiers. */
  types?: string[];
}

interface BqueryComponentLibraryConfig {
  /** Component name prefix. Default: `'bq'` */
  prefix?: string;
}
```

#### Example

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

### `getBqueryConfig()`

Returns a cloned snapshot of the current resolved configuration.

```ts
function getBqueryConfig(): BqueryConfig;
```

```ts
const config = getBqueryConfig();
console.log(config.fetch?.baseUrl); // 'https://api.example.com'
```

---

## Cookies

### `useCookie()`

Creates a reactive signal backed by `document.cookie`. Changes to the signal's `.value` are automatically persisted to the cookie.

```ts
function useCookie<T>(
  name: string,
  options?: UseCookieOptions<T>
): Signal<T | null>;
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Cookie name |
| `options` | `UseCookieOptions<T>` | Optional configuration |

#### `UseCookieOptions<T>`

```ts
interface UseCookieOptions<T> {
  /** Default value when the cookie doesn't exist. */
  defaultValue?: T;
  /** Cookie path. Default from config or `'/'` */
  path?: string;
  /** Cookie domain. */
  domain?: string;
  /** SameSite mode. Default from config or `'Lax'` */
  sameSite?: 'Strict' | 'Lax' | 'None';
  /** Whether the cookie requires HTTPS. Default from config or `false` */
  secure?: boolean;
  /** Expiration date. */
  expires?: Date;
  /** Max age in seconds. */
  maxAge?: number;
  /** Auto-persist on changes. Default: `true`. Set to `false` to manually control persistence. */
  watch?: boolean;
  /** Custom serialization function. */
  serialize?: (value: T) => string;
  /** Custom deserialization function. */
  deserialize?: (value: string) => T;
}
```

#### Examples

**Simple string cookie:**

```ts
const theme = useCookie('theme', { defaultValue: 'light' });

console.log(theme.value); // 'light' (from cookie or default)

theme.value = 'dark'; // Automatically persisted to document.cookie
```

**Cookie with expiration:**

```ts
const session = useCookie('session', {
  defaultValue: null,
  maxAge: 60 * 60 * 24, // 1 day
  sameSite: 'Strict',
  secure: true,
});
```

**Object cookie with custom serialization:**

```ts
const consent = useCookie<{ analytics: boolean; marketing: boolean }>('consent', {
  defaultValue: { analytics: false, marketing: false },
  maxAge: 60 * 60 * 24 * 365, // 1 year
});

consent.value = { analytics: true, marketing: false };
```

**Note on SameSite:** When `sameSite: 'None'` is used, bQuery automatically enforces `Secure` to comply with browser requirements.

---

## Page Metadata

### `definePageMeta()`

Updates the document title, meta tags, link tags, and temporary `html`/`body` attributes. Returns a cleanup function so route transitions or page swaps can revert state cleanly.

```ts
function definePageMeta(
  definition: PageMetaDefinition
): PageMetaCleanup;
```

#### `PageMetaDefinition`

```ts
interface PageMetaDefinition {
  /** Document title. Passed through `titleTemplate` if configured. */
  title?: string;
  /** `<meta name="description">` content. */
  description?: string;
  /** Additional `<meta>` tags to inject. */
  meta?: PageMetaTag[];
  /** Additional `<link>` tags to inject. */
  link?: PageLinkTag[];
  /** Temporary attributes on the `<html>` element. */
  htmlAttributes?: Record<string, string>;
  /** Temporary attributes on the `<body>` element. */
  bodyAttributes?: Record<string, string>;
}
```

#### `PageMetaTag`

```ts
interface PageMetaTag {
  name?: string;
  property?: string;
  httpEquiv?: string;
  content: string;
}
```

#### `PageLinkTag`

```ts
interface PageLinkTag {
  rel: string;
  href: string;
  type?: string;
  media?: string;
  crossOrigin?: 'anonymous' | 'use-credentials';
}
```

#### `PageMetaCleanup`

```ts
type PageMetaCleanup = () => void;
```

#### Examples

**Basic page metadata:**

```ts
const cleanup = definePageMeta({
  title: 'Dashboard',
  description: 'Overview of your account',
});

// Later: revert to previous title/description
cleanup();
```

**Full metadata with OG tags:**

```ts
const cleanup = definePageMeta({
  title: 'Blog Post Title',
  description: 'A great article about bQuery',
  meta: [
    { property: 'og:title', content: 'Blog Post Title' },
    { property: 'og:type', content: 'article' },
    { property: 'og:image', content: 'https://example.com/image.jpg' },
  ],
  link: [
    { rel: 'canonical', href: 'https://example.com/blog/post' },
  ],
  htmlAttributes: { lang: 'en' },
  bodyAttributes: { 'data-page': 'blog-post' },
});
```

**With title template (via config):**

```ts
defineBqueryConfig({
  pageMeta: {
    titleTemplate: (title) => `${title} — My App`,
  },
});

definePageMeta({ title: 'Settings' });
// document.title → 'Settings — My App'
```

---

## Accessible Announcements

### `useAnnouncer()`

Creates or reuses an ARIA live region for screen-reader-friendly announcements. Configuration defaults come from `defineBqueryConfig()`.

```ts
function useAnnouncer(
  options?: UseAnnouncerOptions
): AnnouncerHandle;
```

#### `UseAnnouncerOptions`

```ts
interface UseAnnouncerOptions {
  /** Politeness level. Default from config or `'polite'` */
  politeness?: 'polite' | 'assertive';
  /** Atomic announcements. Default from config or `true` */
  atomic?: boolean;
  /** Message delay in ms. Default from config or `16` */
  delay?: number;
  /** Auto-clear delay in ms. Default from config or `1000` */
  clearDelay?: number;
  /** Optional element ID for the live region. */
  id?: string;
  /** Optional CSS class. */
  className?: string;
  /** Optional custom container element. */
  container?: HTMLElement;
}
```

#### `AnnounceOptions`

Options for individual announcements that override instance defaults:

```ts
interface AnnounceOptions {
  /** Override politeness for this announcement. */
  politeness?: 'polite' | 'assertive';
  /** Override message delay. */
  delay?: number;
  /** Override auto-clear delay. */
  clearDelay?: number;
}
```

#### `AnnouncerHandle`

```ts
interface AnnouncerHandle {
  /** The live-region DOM element, or `null` if outside the DOM. */
  element: HTMLElement | null;
  /** Reactive signal containing the current announcement text. */
  message: Signal<string>;
  /** Announce a message. */
  announce: (value: string, options?: AnnounceOptions) => void;
  /** Clear the current announcement. */
  clear: () => void;
  /** Remove the live region from the DOM. */
  destroy: () => void;
}
```

#### Examples

**Basic announcer:**

```ts
const announcer = useAnnouncer();

announcer.announce('Profile saved');
announcer.announce('Form has errors', { politeness: 'assertive' });

announcer.clear();
announcer.destroy();
```

**Scoped announcer with custom container:**

```ts
const sidebar = document.querySelector('#sidebar')!;
const announcer = useAnnouncer({
  container: sidebar,
  id: 'sidebar-announcer',
  politeness: 'polite',
});

announcer.announce('Sidebar updated');
```

**Reactive message tracking:**

```ts
import { effect } from '@bquery/bquery/reactive';

const announcer = useAnnouncer();

effect(() => {
  if (announcer.message.value) {
    console.log('Current announcement:', announcer.message.value);
  }
});
```

---

## Storage

### `storage`

A singleton factory providing access to different storage adapters. All methods are asynchronous and return Promises.

```ts
const storage: {
  local(): StorageAdapter;
  session(): StorageAdapter;
  indexedDB(options: IndexedDBOptions): StorageAdapter;
};
```

#### `StorageAdapter`

```ts
interface StorageAdapter {
  /** Retrieve a value by key. Returns `null` if the key doesn't exist. */
  get<T>(key: string): Promise<T | null>;
  /** Store a value by key. */
  set<T>(key: string, value: T): Promise<void>;
  /** Remove a value by key. */
  remove(key: string): Promise<void>;
  /** Clear all stored values. */
  clear(): Promise<void>;
  /** List all stored keys. */
  keys(): Promise<string[]>;
}
```

#### `IndexedDBOptions`

```ts
interface IndexedDBOptions {
  /** Database name. */
  name: string;
  /** Object store name. */
  store: string;
  /** Database version. */
  version?: number;
}
```

#### Examples

**localStorage:**

```ts
const local = storage.local();

await local.set('theme', 'dark');
const theme = await local.get<string>('theme'); // 'dark'

await local.remove('theme');
await local.clear();
```

**sessionStorage:**

```ts
const session = storage.session();

await session.set('wizardStep', 2);
const step = await session.get<number>('wizardStep'); // 2
```

**IndexedDB:**

```ts
const db = storage.indexedDB({ name: 'bquery', store: 'kv' });

await db.set('user', { id: 1, name: 'Ada' });
const user = await db.get<{ id: number; name: string }>('user');
// { id: 1, name: 'Ada' }

const allKeys = await db.keys(); // ['user']
```

---

## Cache Storage

### `cache`

A singleton wrapper around the Cache Storage API.

```ts
const cache: {
  isSupported(): boolean;
  open(name: string): Promise<CacheHandle>;
  delete(name: string): Promise<boolean>;
  keys(): Promise<string[]>;
};
```

#### `CacheHandle`

```ts
interface CacheHandle {
  /** Fetch and cache a resource. */
  add(url: string): Promise<void>;
  /** Fetch and cache multiple resources. */
  addAll(urls: string[]): Promise<void>;
  /** Store a custom response. */
  put(url: string, response: Response): Promise<void>;
  /** Retrieve a cached response. */
  match(url: string): Promise<Response | undefined>;
  /** Remove a cached response. */
  remove(url: string): Promise<boolean>;
  /** List all cached URLs. */
  keys(): Promise<string[]>;
}
```

#### Examples

```ts
// Check support
if (cache.isSupported()) {
  // Open a named cache
  const assets = await cache.open('assets-v1');

  // Cache resources
  await assets.add('/styles.css');
  await assets.addAll(['/app.js', '/logo.svg']);

  // Retrieve cached responses
  const response = await assets.match('/styles.css');
  if (response) {
    const css = await response.text();
  }

  // Remove a cached entry
  await assets.remove('/logo.svg');

  // List all cached URLs
  const urls = await assets.keys();

  // Delete entire cache
  await cache.delete('assets-v1');
}
```

---

## Notifications

### `notifications`

A singleton wrapper around the Notifications API.

```ts
const notifications: {
  isSupported(): boolean;
  getPermission(): NotificationPermission;
  requestPermission(): Promise<NotificationPermission>;
  send(title: string, options?: NotificationOptions): Notification | null;
};
```

#### `NotificationOptions`

```ts
interface NotificationOptions {
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  vibrate?: number[];
  data?: unknown;
}
```

#### Examples

```ts
// Check support and permission
if (notifications.isSupported()) {
  const permission = await notifications.requestPermission();

  if (permission === 'granted') {
    notifications.send('Build Complete', {
      body: 'Your documentation is ready.',
      icon: '/icon.png',
    });
  }
}
```

**Check permission without requesting:**

```ts
const currentPermission = notifications.getPermission();
// 'default', 'granted', or 'denied'
```

---

## Buckets (Blob Storage)

### `buckets`

A Storage Buckets API wrapper with an IndexedDB fallback for storing binary data.

```ts
const buckets: {
  open(name: string): Promise<Bucket>;
};
```

#### `Bucket`

```ts
interface Bucket {
  /** Store a blob by key. */
  put(key: string, data: Blob): Promise<void>;
  /** Retrieve a blob by key. Returns `null` if not found. */
  get(key: string): Promise<Blob | null>;
  /** Remove a blob by key. */
  remove(key: string): Promise<void>;
  /** List all keys in the bucket. */
  keys(): Promise<string[]>;
}
```

#### Examples

```ts
const bucket = await buckets.open('user-uploads');

// Store a file
const file = new Blob(['Hello World'], { type: 'text/plain' });
await bucket.put('readme.txt', file);

// Retrieve
const retrieved = await bucket.get('readme.txt');
if (retrieved) {
  const text = await retrieved.text(); // 'Hello World'
}

// List all keys
const keys = await bucket.keys(); // ['readme.txt']

// Remove
await bucket.remove('readme.txt');
```

---

## Full Example

```ts
import {
  defineBqueryConfig,
  getBqueryConfig,
  storage,
  cache,
  notifications,
  useCookie,
  definePageMeta,
  useAnnouncer,
} from '@bquery/bquery/platform';

// 1. Configure globally
defineBqueryConfig({
  fetch: { baseUrl: 'https://api.example.com' },
  cookies: { sameSite: 'Lax' },
  pageMeta: { titleTemplate: (t) => `${t} — MyApp` },
});

// 2. Set page metadata
const cleanupMeta = definePageMeta({
  title: 'Dashboard',
  description: 'Your account overview',
});

// 3. Reactive cookie
const theme = useCookie('theme', { defaultValue: 'light' });
theme.value = 'dark';

// 4. Storage
const local = storage.local();
await local.set('lastVisit', new Date().toISOString());

// 5. Cache
if (cache.isSupported()) {
  const assets = await cache.open('v1');
  await assets.add('/app.js');
}

// 6. Notifications
if (notifications.isSupported()) {
  const perm = await notifications.requestPermission();
  if (perm === 'granted') {
    notifications.send('Ready', { body: 'Dashboard loaded' });
  }
}

// 7. Announcer
const announcer = useAnnouncer();
announcer.announce('Dashboard loaded');

// Cleanup on page exit
cleanupMeta();
announcer.destroy();
```

---

## Notes

- All storage adapters use a uniform async `StorageAdapter` interface.
- `useCookie()` automatically enforces `Secure` when `sameSite: 'None'` is set.
- `definePageMeta()` returns a cleanup function that restores previous document state.
- Announcer defaults can be configured globally via `defineBqueryConfig()`.
- The `cache` and `buckets` singletons gracefully handle environments where their underlying APIs are not available.
