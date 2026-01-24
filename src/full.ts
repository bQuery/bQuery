/**
 * bQuery.js — Full Bundle
 *
 * This is the complete bundle containing all modules for CDN usage.
 * Use this when you want all features without tree-shaking concerns.
 *
 * @module bquery/full
 *
 * @example CDN Usage (ES Modules)
 * ```html
 * <script type="module">
 *   import { $, signal, component } from 'https://unpkg.com/bquery@1/dist/full.es.mjs';
 *
 *   const count = signal(0);
 *   $('#counter').text(count.value);
 * </script>
 * ```
 *
 * @example CDN Usage (UMD/Global)
 * ```html
 * <script src="https://unpkg.com/bquery@1/dist/full.umd.js"></script>
 * <script>
 *   const { $, signal } = bQuery;
 *   const count = signal(0);
 * </script>
 * ```
 *
 * @example CDN Usage (IIFE)
 * ```html
 * <script src="https://unpkg.com/bquery@1/dist/full.iife.js"></script>
 * <script>
 *   // bQuery is available as a global variable
 *   const { $, $$ } = bQuery;
 * </script>
 * ```
 */

// ============================================================================
// Core Module: Selectors, DOM operations, events, utilities
// ============================================================================
export { $, $$, BQueryCollection, BQueryElement, utils } from './core/index';

// ============================================================================
// Reactive Module: Signals, computed values, effects, batching
// ============================================================================
export {
  Computed,
  Signal,
  batch,
  computed,
  effect,
  isComputed,
  isSignal,
  persistedSignal,
  readonly,
  signal,
  untrack,
  watch,
} from './reactive/index';
export type { CleanupFn, Observer, ReadonlySignal } from './reactive/index';

// ============================================================================
// Component Module: Web Components helper with Shadow DOM
// ============================================================================
export { component, html, safeHtml } from './component/index';
export type { ComponentDefinition, PropDefinition } from './component/index';

// ============================================================================
// Motion Module: View transitions, FLIP animations, springs
// ============================================================================
export { capturePosition, flip, flipList, spring, springPresets, transition } from './motion/index';
export type {
  ElementBounds,
  FlipOptions,
  Spring,
  SpringConfig,
  TransitionOptions,
} from './motion/index';

// ============================================================================
// Security Module: Sanitization, CSP compatibility, Trusted Types
// ============================================================================
export {
  createTrustedHtml,
  escapeHtml,
  generateNonce,
  getTrustedTypesPolicy,
  hasCSPDirective,
  isTrustedTypesSupported,
  sanitize,
  sanitizeHtml,
  stripTags,
} from './security/index';
export type { SanitizeOptions } from './security/index';

// ============================================================================
// Platform Module: Storage, buckets, notifications, cache
// ============================================================================
export { buckets, cache, notifications, storage } from './platform/index';
export type {
  Bucket,
  CacheHandle,
  IndexedDBOptions,
  NotificationOptions,
  StorageAdapter,
} from './platform/index';

// ============================================================================
// Router Module: SPA routing, navigation guards, lazy loading
// ============================================================================
export {
  back,
  createRouter,
  currentRoute,
  forward,
  interceptLinks,
  isActive,
  isActiveSignal,
  link,
  navigate,
  resolve,
} from './router/index';
export type {
  NavigationGuard,
  Route,
  RouteDefinition,
  Router,
  RouterOptions,
} from './router/index';

// ============================================================================
// Store Module: Signal-based state management
// ============================================================================
export {
  createPersistedStore,
  createStore,
  destroyStore,
  getStore,
  listStores,
  mapActions,
  mapState,
  registerPlugin,
} from './store/index';
export type { StateFactory, Store, StoreDefinition, StorePlugin } from './store/index';

// ============================================================================
// View Module: Declarative DOM bindings without compiler
// ============================================================================
export { createTemplate, mount } from './view/index';
export type { BindingContext, MountOptions, View } from './view/index';
