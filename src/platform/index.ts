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

export { useCookie } from './cookies';
export type { UseCookieOptions } from './cookies';

export { defineBqueryConfig, getBqueryConfig } from './config';
export type {
  BqueryAnnouncerConfig,
  BqueryComponentLibraryConfig,
  BqueryConfig,
  BqueryCookieConfig,
  BqueryFetchConfig,
  BqueryFetchParseAs,
  BqueryPageMetaConfig,
  BqueryTransitionConfig,
} from './config';

export { notifications } from './notifications';
export type { NotificationOptions } from './notifications';

export { useAnnouncer } from './announcer';
export type { AnnounceOptions, AnnouncerHandle, UseAnnouncerOptions } from './announcer';

export { definePageMeta } from './meta';
export type { PageLinkTag, PageMetaCleanup, PageMetaDefinition, PageMetaTag } from './meta';

export { storage } from './storage';
export type { IndexedDBOptions, StorageAdapter } from './storage';
