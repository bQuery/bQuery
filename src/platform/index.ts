/**
 * Platform module providing unified endpoints for web platform APIs.
 * Offers consistent, promise-based interfaces with predictable errors.
 *
 * @module bquery/platform
 */

export { buckets } from './buckets';
export type { Bucket } from './buckets';

export { cache } from './cache';
export type { CacheHandle } from './cache';

export { notifications } from './notifications';
export type { NotificationOptions } from './notifications';

export { storage } from './storage';
export type { IndexedDBOptions, StorageAdapter } from './storage';
