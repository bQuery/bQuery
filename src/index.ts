/**
 * bQuery.js — The full-stack web framework that speaks jQuery.
 *
 * A zero-build, TypeScript-first framework that bridges vanilla JavaScript
 * and build-step frameworks with modern features.
 *
 * @module bquery
 * @see https://github.com/bquery/bquery
 */

// Core module: selectors, DOM ops, events, utils
export * from './core/index';

// Reactive module: signals, computed, effects, binding
export * from './reactive/index';

// Concurrency module: zero-build worker task helpers
export * from './concurrency/index';

// Component module: Web Components helper
export * from './component/index';

// Motion module: view transitions, FLIP, springs
export * from './motion/index';

// Security module: sanitizer, CSP, Trusted Types
export * from './security/index';

// Platform module: storage, buckets, notifications, cache
export * from './platform/index';

// Router module: SPA routing, navigation guards
export * from './router/index';

// Store module: state management with signals
export * from './store/index';

// View module: declarative DOM bindings
export * from './view/index';

// Forms module: reactive form handling and validation
// Note: compose is not re-exported here to avoid naming conflict with
// the core utility compose(). Use @bquery/bquery/forms for the validator
// combinator.
export {
  all,
  arrayOf,
  between,
  bindField,
  bindForm,
  createFieldArray,
  createForm,
  custom,
  customAsync,
  dateAfter,
  dateBefore,
  email,
  field,
  fileSize,
  fileType,
  hydrateForm,
  integer,
  length,
  matchField,
  max,
  maxLength,
  min,
  minLength,
  not,
  notOneOf,
  numeric,
  oneOf,
  pattern,
  readSerializedFormState,
  required,
  requiredIf,
  requiredUnless,
  schema,
  serializeFormState,
  url,
  useField,
  useFieldArray,
  useForm,
  useFormField,
  validDate,
  withMessage,
} from './forms/index';
export type {
  AsyncValidator,
  BindFieldOptions,
  BindFormOptions,
  CrossFieldValidator,
  FieldArrayConfig,
  FieldConfig,
  FieldSchema,
  Form,
  FormChangeListener,
  FormConfig,
  FormErrors,
  FormField,
  FormFieldArray,
  FormFields,
  FormFieldValidationMode,
  FormSnapshot,
  FormValidationMode,
  FormValidationStrategy,
  SchemaEntry,
  SetFieldValueOptions,
  SubmitHandler,
  SyncValidator,
  UseFormFieldOptions,
  UseFormFieldReturn,
  UseFormFieldSetValueOptions,
  ValidationResult,
  Validator,
} from './forms/index';

// i18n module: internationalization, translations, formatting
export * from './i18n/index';

// a11y module: accessibility utilities
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

// DnD module: drag-and-drop, drop zones, sortable lists
export * from './dnd/index';

// Media module: reactive browser and device API signals
export * from './media/index';

// Plugin module: global plugin registration system
// Note: provide / inject / InjectionKey are not re-exported here because
// they collide with the component module's component-scoped versions.
// Use @bquery/bquery/plugin for the global DI helpers.
export {
  addAction,
  addFilter,
  applyFilters,
  createInjectionKey,
  doAction,
  getCustomDirective,
  getCustomDirectives,
  getInstalledPlugins,
  getPluginInfo,
  hasProvided,
  isInstalled,
  listActions,
  listFilters,
  removeAction,
  removeFilter,
  resetDi,
  resetHooks,
  resetPlugins,
  uninstall,
  unuse,
  use,
} from './plugin/index';
export type {
  BQueryPlugin,
  CustomDirective,
  CustomDirectiveHandler,
  CustomDirectiveLifecycle,
  CustomDirectiveValue,
  PluginInfo,
  PluginInstallContext,
} from './plugin/index';

// DevTools module: runtime debugging utilities
export * from './devtools/index';

// Testing module: test helpers for signals, components, router, and events
export {
  renderComponent,
  flushEffects,
  mockSignal,
  mockRouter,
  fireEvent,
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

// SSR module: server-side rendering, hydration, store state serialization
export * from './ssr/index';

// Server module: lightweight backend routing and middleware helpers
export * from './server/index';
