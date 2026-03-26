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
export type { BQueryUtils } from './core/index';

// ============================================================================
// Reactive Module: Signals, computed values, effects, batching
// ============================================================================
export {
  Computed,
  Signal,
  batch,
  computed,
  createUseFetch,
  effect,
  isComputed,
  isSignal,
  linkedSignal,
  persistedSignal,
  readonly,
  signal,
  useAsyncData,
  useFetch,
  untrack,
  watch,
} from './reactive/index';
export type {
  AsyncDataState,
  AsyncDataStatus,
  AsyncWatchSource,
  CleanupFn,
  FetchInput,
  LinkedSignal,
  Observer,
  ReadonlySignal,
  UseAsyncDataOptions,
  UseFetchOptions,
} from './reactive/index';

// ============================================================================
// Component Module: Web Components helper with Shadow DOM
// ============================================================================
export {
  bool,
  component,
  defineComponent,
  html,
  registerDefaultComponents,
  safeHtml,
  useComputed,
  useEffect,
  useSignal,
} from './component/index';
export type {
  AttributeChange,
  ComponentDefinition,
  ComponentRenderContext,
  ComponentStateKey,
  ComponentSignalLike,
  ComponentSignals,
  DefaultComponentLibraryOptions,
  PropDefinition,
  RegisteredDefaultComponents,
  ShadowMode,
} from './component/index';

// ============================================================================
// Motion Module: View transitions, FLIP animations, springs
// ============================================================================
export {
  animate,
  capturePosition,
  easeInCubic,
  easeInOutCubic,
  easeInOutQuad,
  easeInQuad,
  easeOutBack,
  easeOutCubic,
  easeOutExpo,
  easeOutQuad,
  easingPresets,
  flip,
  flipElements,
  flipList,
  keyframePresets,
  linear,
  morphElement,
  parallax,
  prefersReducedMotion,
  scrollAnimate,
  sequence,
  setReducedMotion,
  spring,
  springPresets,
  stagger,
  timeline,
  transition,
  typewriter,
} from './motion/index';
export type {
  AnimateOptions,
  EasingFunction,
  ElementBounds,
  FlipGroupOptions,
  FlipOptions,
  MorphOptions,
  ParallaxCleanup,
  ParallaxOptions,
  ScrollAnimateCleanup,
  ScrollAnimateOptions,
  SequenceOptions,
  SequenceStep,
  Spring,
  SpringConfig,
  StaggerFunction,
  StaggerOptions,
  TimelineConfig,
  TimelineControls,
  TimelineStep,
  TransitionOptions,
  TypewriterControls,
  TypewriterOptions,
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
  trusted,
} from './security/index';
export type { SanitizedHtml, SanitizeOptions, TrustedHtml } from './security/index';

// ============================================================================
// Platform Module: Storage, buckets, notifications, cache
// ============================================================================
export {
  buckets,
  cache,
  defineBqueryConfig,
  definePageMeta,
  getBqueryConfig,
  notifications,
  storage,
  useAnnouncer,
  useCookie,
} from './platform/index';
export type {
  AnnounceOptions,
  AnnouncerHandle,
  Bucket,
  BqueryConfig,
  CacheHandle,
  IndexedDBOptions,
  NotificationOptions,
  PageMetaDefinition,
  StorageAdapter,
  UseAnnouncerOptions,
  UseCookieOptions,
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
  useRoute,
} from './router/index';
export type {
  NavigationGuard,
  Route,
  RouteDefinition,
  Router,
  RouterOptions,
  UseRouteReturn,
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
export type {
  ActionContext,
  OnActionCallback,
  PersistedStoreOptions,
  StateFactory,
  StorageBackend,
  Store,
  StoreDefinition,
  StorePlugin,
  StoreSerializer,
} from './store/index';

// ============================================================================
// View Module: Declarative DOM bindings without compiler
// ============================================================================
export { createTemplate, mount } from './view/index';
export type { BindingContext, MountOptions, View } from './view/index';

// ============================================================================
// Forms Module: Reactive form handling and validation
// ============================================================================
export {
  createForm,
  custom,
  customAsync,
  email,
  max,
  maxLength,
  min,
  minLength,
  pattern,
  required,
  url,
} from './forms/index';
export type {
  AsyncValidator,
  CrossFieldValidator,
  FieldConfig,
  Form,
  FormConfig,
  FormErrors,
  FormField,
  FormFields,
  SubmitHandler,
  SyncValidator,
  ValidationResult,
  Validator,
} from './forms/index';
