# Platform

The platform module provides consistent, promise‑based wrappers for common web platform APIs.

```ts
import { storage, cache, notifications, buckets } from '@bquery/bquery/platform';
```

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
