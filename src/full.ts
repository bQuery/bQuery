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
  BqLinkElement,
  createRouter,
  currentRoute,
  forward,
  interceptLinks,
  isActive,
  isActiveSignal,
  link,
  navigate,
  registerBqLink,
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

// ============================================================================
// i18n Module: Internationalization, translations, formatting
// ============================================================================
export { createI18n, formatDate, formatNumber } from './i18n/index';
export type {
  DateFormatOptions,
  I18nConfig,
  I18nInstance,
  LocaleLoader,
  LocaleMessages,
  Messages,
  NumberFormatOptions,
  TranslateParams,
} from './i18n/index';

// ============================================================================
// a11y Module: Accessibility utilities
// ============================================================================
// Note: prefersReducedMotion is not re-exported here to avoid naming conflict
// with the motion module's prefersReducedMotion(). Use @bquery/bquery/a11y for
// the reactive signal version.
export {
  announceToScreenReader,
  auditA11y,
  clearAnnouncements,
  getFocusableElements,
  prefersColorScheme,
  prefersContrast,
  releaseFocus,
  rovingTabIndex,
  skipLink,
  trapFocus,
} from './a11y/index';
export type {
  AnnouncePriority,
  AuditFinding,
  AuditResult,
  AuditSeverity,
  ColorScheme,
  ContrastPreference,
  FocusTrapHandle,
  RovingTabIndexHandle,
  RovingTabIndexOptions,
  SkipLinkHandle,
  SkipLinkOptions,
  TrapFocusOptions,
} from './a11y/index';

// ============================================================================
// DnD Module: Drag-and-drop, drop zones, sortable lists
// ============================================================================
export { draggable } from './dnd/index';
export { droppable } from './dnd/index';
export { sortable } from './dnd/index';
export type {
  BoundsRect,
  DragAxis,
  DragBounds,
  DragEventData,
  DragPosition,
  DraggableHandle,
  DraggableOptions,
  DropEventData,
  DroppableHandle,
  DroppableOptions,
  SortEventData,
  SortableHandle,
  SortableOptions,
} from './dnd/index';

// ============================================================================
// Media Module: Reactive browser and device API signals
// ============================================================================
export { mediaQuery } from './media/index';
export { breakpoints } from './media/index';
export { useViewport } from './media/index';
export { useNetworkStatus } from './media/index';
export { useBattery } from './media/index';
export { useGeolocation } from './media/index';
export { useDeviceMotion, useDeviceOrientation } from './media/index';
export { clipboard } from './media/index';
export type {
  BatteryState,
  BreakpointMap,
  ClipboardAPI,
  DeviceMotionState,
  DeviceOrientationState,
  GeolocationOptions,
  GeolocationState,
  NetworkState,
  ViewportState,
} from './media/index';

// ---------------------------------------------------------------------------
// Plugin module
// ---------------------------------------------------------------------------
export { use, isInstalled, getInstalledPlugins, getCustomDirective, getCustomDirectives, resetPlugins } from './plugin/index';
export type { BQueryPlugin, CustomDirective, CustomDirectiveHandler, PluginInstallContext } from './plugin/index';

// ---------------------------------------------------------------------------
// DevTools module
// ---------------------------------------------------------------------------
export {
  enableDevtools,
  isDevtoolsEnabled,
  trackSignal,
  untrackSignal,
  generateSignalLabel,
  inspectSignals,
  inspectStores,
  inspectComponents,
  recordEvent,
  getTimeline,
  clearTimeline,
  getDevtoolsState,
  logSignals,
  logStores,
  logComponents,
  logTimeline,
} from './devtools/index';
export type {
  ComponentSnapshot,
  DevtoolsOptions,
  DevtoolsState,
  SignalSnapshot,
  StoreSnapshot,
  TimelineEntry,
  TimelineEventType,
} from './devtools/index';
