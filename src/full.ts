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
  batch,
  Computed,
  computed,
  createHttp,
  createRequestQueue,
  createRestClient,
  createUseFetch,
  deduplicateRequest,
  effect,
  effectScope,
  getCurrentScope,
  http,
  HttpError,
  isComputed,
  isSignal,
  linkedSignal,
  onScopeDispose,
  persistedSignal,
  readonly,
  Signal,
  signal,
  toValue,
  untrack,
  useAsyncData,
  useEventSource,
  useFetch,
  useInfiniteFetch,
  usePaginatedFetch,
  usePolling,
  useResource,
  useResourceList,
  useSubmit,
  useWebSocket,
  useWebSocketChannel,
  watch,
  watchDebounce,
  watchThrottle,
} from './reactive/index';
export type {
  AsyncDataState,
  AsyncDataStatus,
  AsyncWatchSource,
  ChannelMessage,
  ChannelSubscription,
  CleanupFn,
  EffectScope,
  EventSourceStatus,
  FetchInput,
  HttpClient,
  HttpProgressEvent,
  HttpRequestConfig,
  HttpResponse,
  IdExtractor,
  InfiniteState,
  Interceptor,
  InterceptorManager,
  LinkedSignal,
  MaybeSignal,
  Observer,
  PaginatedState,
  PollingState,
  ReadonlySignal,
  ReadonlySignalHandle,
  RequestQueue,
  RequestQueueOptions,
  ResourceListActions,
  RestClient,
  RetryConfig,
  UseAsyncDataOptions,
  UseEventSourceOptions,
  UseEventSourceReturn,
  UseFetchOptions,
  UseFetchRetryConfig,
  UseInfiniteFetchOptions,
  UsePaginatedFetchOptions,
  UsePollingOptions,
  UseResourceListOptions,
  UseResourceListReturn,
  UseResourceOptions,
  UseResourceReturn,
  UseSubmitOptions,
  UseSubmitReturn,
  UseWebSocketChannelOptions,
  UseWebSocketChannelReturn,
  UseWebSocketOptions,
  UseWebSocketReturn,
  WatchOptions,
  WebSocketHeartbeatConfig,
  WebSocketReconnectConfig,
  WebSocketSerializer,
  WebSocketStatus,
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
  ComponentSignalLike,
  ComponentSignals,
  ComponentStateKey,
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
  BqueryConfig,
  Bucket,
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
  isNavigating,
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
  defineStore,
  destroyStore,
  getStore,
  listStores,
  mapActions,
  mapGetters,
  mapState,
  registerPlugin,
  watchStore,
} from './store/index';
export type {
  ActionContext,
  Actions,
  Getters,
  OnActionCallback,
  PersistedStoreOptions,
  StateFactory,
  StorageBackend,
  Store,
  StoreDefinition,
  StorePatch,
  StorePlugin,
  StoreSerializer,
  StoreSubscriber,
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
  matchField,
  max,
  maxLength,
  min,
  minLength,
  pattern,
  required,
  url,
  useFormField,
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
  FormFieldValidationMode,
  SubmitHandler,
  SyncValidator,
  UseFormFieldOptions,
  UseFormFieldReturn,
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
export { draggable, droppable, sortable } from './dnd/index';
export type {
  BoundsRect,
  DragAxis,
  DragBounds,
  DragEventData,
  DraggableHandle,
  DraggableOptions,
  DragPosition,
  DropEventData,
  DroppableHandle,
  DroppableOptions,
  SortableHandle,
  SortableOptions,
  SortEventData,
} from './dnd/index';

// ============================================================================
// Media Module: Reactive browser and device API signals
// ============================================================================
export {
  breakpoints,
  clipboard,
  mediaQuery,
  useBattery,
  useDeviceMotion,
  useDeviceOrientation,
  useGeolocation,
  useIntersectionObserver,
  useMutationObserver,
  useNetworkStatus,
  useResizeObserver,
  useViewport,
} from './media/index';
export type {
  BatteryState,
  BreakpointMap,
  ClipboardAPI,
  DeviceMotionState,
  DeviceOrientationState,
  GeolocationOptions,
  GeolocationState,
  IntersectionObserverOptions,
  IntersectionObserverState,
  MutationObserverOptions,
  MutationObserverState,
  NetworkState,
  ResizeObserverOptions,
  ResizeObserverState,
  ViewportState,
} from './media/index';

// ---------------------------------------------------------------------------
// Plugin module
// ---------------------------------------------------------------------------
export {
  getCustomDirective,
  getCustomDirectives,
  getInstalledPlugins,
  isInstalled,
  resetPlugins,
  use,
} from './plugin/index';
export type {
  BQueryPlugin,
  CustomDirective,
  CustomDirectiveHandler,
  PluginInstallContext,
} from './plugin/index';

// ---------------------------------------------------------------------------
// DevTools module
// ---------------------------------------------------------------------------
export {
  clearTimeline,
  enableDevtools,
  generateSignalLabel,
  getDevtoolsState,
  getTimeline,
  inspectComponents,
  inspectSignals,
  inspectStores,
  isDevtoolsEnabled,
  logComponents,
  logSignals,
  logStores,
  logTimeline,
  recordEvent,
  trackSignal,
  untrackSignal,
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

// ---------------------------------------------------------------------------
// Testing module
// ---------------------------------------------------------------------------
export {
  fireEvent,
  flushEffects,
  mockRouter,
  mockSignal,
  renderComponent,
  waitFor,
} from './testing/index';
export type {
  FireEventOptions,
  MockRouter,
  MockRouterOptions,
  MockSignal,
  RenderComponentOptions,
  RenderResult,
  TestRoute,
  WaitForOptions,
} from './testing/index';

// ---------------------------------------------------------------------------
// SSR module
// ---------------------------------------------------------------------------
export {
  deserializeStoreState,
  hydrateMount,
  hydrateStore,
  hydrateStores,
  renderToString,
  serializeStoreState,
} from './ssr/index';
export type {
  DeserializedStoreState,
  HydrateMountOptions,
  HydrationOptions,
  RenderOptions,
  SerializeOptions,
  SerializeResult,
  SSRResult,
} from './ssr/index';
