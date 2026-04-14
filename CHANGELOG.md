# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to Semantic Versioning.

## Releases

- [Changelog](#changelog)
  - [Releases](#releases)
  - [\[Unreleased\] - 2026-04-05](#unreleased---2026-04-05)
    - [Added (Unreleased)](#added-unreleased)
    - [Changed (Unreleased)](#changed-unreleased)
    - [Fixed (Unreleased)](#fixed-unreleased)
  - [\[1.9.0\] - 2026-04-05](#190---2026-04-05)
    - [Added (1.9.0)](#added-190)
    - [Changed (1.9.0)](#changed-190)
  - [\[1.8.2\] - 2026-04-01](#182---2026-04-01)
    - [Changed (1.8.2)](#changed-182)
  - [\[1.8.1\] - 2026-04-01](#181---2026-04-01)
    - [Fixed (1.8.1)](#fixed-181)
  - [\[1.8.0\] - 2026-04-01](#180---2026-04-01)
    - [Added (1.8.0)](#added-180)
    - [Changed (1.8.0)](#changed-180)
    - [Fixed (1.8.0)](#fixed-180)
  - [\[1.7.0\] - 2026-03-27](#170---2026-03-27)
    - [Added (1.7.0)](#added-170)
    - [Changed (1.7.0)](#changed-170)
    - [Fixed (1.7.0)](#fixed-170)
    - [Security (1.7.0)](#security-170)
  - [\[1.6.0\] - 2026-03-14](#160---2026-03-14)
    - [Added (1.6.0)](#added-160)
    - [Changed (1.6.0)](#changed-160)
    - [Fixed (1.6.0)](#fixed-160)
    - [Security (1.6.0)](#security-160)
  - [\[1.5.0\] - 2026-03-12](#150---2026-03-12)
    - [Added (1.5.0)](#added-150)
    - [Changed (1.5.0)](#changed-150)
    - [Fixed (1.5.0)](#fixed-150)
    - [Security (1.5.0)](#security-150)
  - [\[1.4.0\] - 2026-02-10](#140---2026-02-10)
    - [Added (1.4.0)](#added-140)
    - [Fixed (1.4.0)](#fixed-140)
    - [Security (1.4.0)](#security-140)
  - [\[1.3.0\] - 2026-01-26](#130---2026-01-26)
    - [Added (1.3.0)](#added-130)
    - [Changed (1.3.0)](#changed-130)
    - [Fixed (1.3.0)](#fixed-130)
  - [\[1.2.0\] - 2026-01-24](#120---2026-01-24)
    - [Added (1.2.0)](#added-120)
  - [\[1.1.2\] - 2026-01-24](#112---2026-01-24)
    - [Fixed (1.1.2)](#fixed-112)
    - [Security (1.1.2)](#security-112)
  - [\[1.1.1\] - 2026-01-24](#111---2026-01-24)
    - [Fixed (1.1.1)](#fixed-111)
  - [\[1.1.0\] - 2026-01-23](#110---2026-01-23)
    - [Added (1.1.0)](#added-110)
    - [Changed (1.1.0)](#changed-110)
    - [Security (1.1.0)](#security-110)
  - [\[1.0.2\] - 2026-01-23](#102---2026-01-23)
    - [Fixed (1.0.2)](#fixed-102)
  - [\[1.0.1\] - 2026-01-23](#101---2026-01-23)
    - [Fixed (1.0.1)](#fixed-101)
  - [\[1.0.0\] - 2026-01-21](#100---2026-01-21)
    - [Added (1.0.0)](#added-100)

## [Unreleased] - 2026-04-05

### Added (Unreleased)

- **Concurrency**: Expanded `@bquery/bquery/concurrency` with Milestone 2 RPC-style communication via `createRpcWorker()` and `callWorkerMethod()`, adding explicit named method dispatch on top of the existing zero-build worker task API.
- **Concurrency / Pools**: Added `createTaskPool()` and `createRpcPool()` for explicit browser-first worker pools with bounded concurrency, FIFO queueing, and backpressure via `maxQueue`.
- **Concurrency / High-level helpers**: Added `parallel()` for explicit task lists, `batchTasks()` as the adapted batched-task helper, and `map()` for chunked parallel array mapping on top of the existing worker-pool primitives.
- **Concurrency / Collection helpers**: Added `filter()`, `reduce()`, `some()`, `every()`, and `find()` as explicit ThreadTS-inspired collection helpers that preserve bQuery's browser-first, zero-build worker model without decorators or hidden runtimes.
- **Concurrency / Pipelines**: Added `pipeline()` as an optional immutable fluent layer over the existing collection helpers, keeping CSP and serialization limits explicit instead of introducing proxy-based worker magic.

### Changed (Unreleased)

- **Docs / Agent context**: Synced the README, guides, build/export metadata, and agent context files for the concurrency module's task + RPC + pool + collection-helper + pipeline scope, including an updated `threadts-universal` parity matrix and phased roadmap.

### Fixed (Unreleased)

- No changes yet.

## [1.9.0] - 2026-04-05

### Added (1.9.0)

- **Reactive / Watch**: Added `watchDebounce()` and `watchThrottle()` so signal watchers can smooth bursty updates with cleanup-safe debounce and throttle timing while keeping the same `(newValue, oldValue)` callback style as `watch()`.
- **View**: Added `bq-error` for reactive inline error output with sensible alert semantics, plus `bq-aria` for declarative ARIA attribute binding from object expressions or evaluated state.
- **Media**: Added `useIntersectionObserver()`, `useResizeObserver()`, and `useMutationObserver()` to expose DOM observer APIs as cleanup-friendly reactive signals in `@bquery/bquery/media`.

### Changed (1.9.0)

- **Docs**: Expanded the README and VitePress guides to cover the new watch helpers, view directives, media observer composables, and broader module API examples introduced after `1.8.2`.
- **Docs / Navigation**: Added onboarding-focused guide structure and reorganized the docs sidebar so feature documentation is easier to discover across beginner, intermediate, and advanced workflows.

## [1.8.2] - 2026-04-01

### Changed (1.8.2)

- **Tooling / Package metadata**: Raised the declared engine requirements to `Node.js >=24.0.0` and `Bun >=1.3.11`, and aligned `mise.toml` with Bun `1.3.11` so local development and publish validation use the same supported toolchain.
- **README / npm**: Switched the package logo in `README.md` to an absolute GitHub-hosted URL so npmjs can render the package README without relying on a local asset path that is not shipped in the published tarball.

## [1.8.1] - 2026-04-01

### Fixed (1.8.1)

- **Plugin / View**: Custom directives registered through `@bquery/bquery/plugin` now reattach their view-side resolver when plugins are installed or reset, so plugin-provided `bq-*` directives continue to run reliably after resolver teardown in isolated test runs and other reinitialized environments.

## [1.8.0] - 2026-04-01

### Added (1.8.0)

- **Reactive / HTTP**: Added `createHttp()`, the default `http` client, and `HttpError` with interceptors, structured responses, timeout / abort handling, retry configuration, and `onRetry` hooks.
- **Reactive / Data workflows**: Added `usePolling()`, `usePaginatedFetch()`, and `useInfiniteFetch()` for interval-driven, page-based, and cursor-based fetching patterns.
- **Reactive / Realtime**: Added `useWebSocket()`, `useWebSocketChannel()`, and `useEventSource()` for typed streaming state, heartbeat / reconnect handling, SSE, and channel-based messaging.
- **Reactive / REST**: Added `useResource()`, `useResourceList()`, `useSubmit()`, and `createRestClient()` for CRUD flows, optimistic mutations, collection syncing, and reactive form submissions.
- **Reactive / Coordination**: Added `createRequestQueue()` and `deduplicateRequest()` to cap concurrency and coalesce identical in-flight requests.

### Changed (1.8.0)

- **Docs**: README, getting-started, reactive, and agent-facing guides now document the network-ready reactive layer, including polling, pagination, realtime transports, REST helpers, and request coordination utilities.
- **Bundle exports**: The package version, `src/full.ts`, and agent context files now reflect the expanded Reactive / Store public surface so the full bundle, CDN entry, and AI tooling stay aligned with the module barrels.
- **Guidance**: Agent instruction files now explicitly call out the need to keep `src/full.ts` synchronized when public runtime exports change.

### Fixed (1.8.0)

- **Reactive / HTTP**: Retry handling now refuses to replay non-replayable `ReadableStream` bodies and consumed `Request` objects, treats parse failures separately from transport failures, and reports timeout / abort conditions more consistently across `useFetch()` and `createHttp()`.
- **Reactive / Realtime**: WebSocket and EventSource reconnect scheduling, heartbeat timers, latency tracking, and manual reopen flows now clean up more defensively and avoid stale reconnect / timeout state.
- **Reactive / REST**: `useResource()` and `useResourceList()` now reconcile optimistic mutations more predictably with server responses, preserve rollback behavior on failures, and keep mutation callbacks isolated from list-fetch callbacks.

## [1.7.0] - 2026-03-27

### Added (1.7.0)

- **New modules**: Added dedicated `@bquery/bquery/a11y`, `@bquery/bquery/forms`, `@bquery/bquery/i18n`, `@bquery/bquery/media`, `@bquery/bquery/dnd`, `@bquery/bquery/plugin`, `@bquery/bquery/devtools`, `@bquery/bquery/testing`, and `@bquery/bquery/ssr` entry points, all re-exported from the root bundle and documented as first-class modules.
- **Component**: Added `shadow` mode control (`true`, `false`, `'open'`, `'closed'`), `observeAttributes`, `onAttributeChanged()`, `onAdopted()`, component-scoped `useSignal()`, `useComputed()`, and `useEffect()` helpers, plus the exported `ComponentStateKey` type for strongly typed state access.
- **Core**: Added jQuery-style parity helpers on `BQueryElement` and `BQueryCollection`: `detach()`, `index()`, `contents()`, `offsetParent()`, `position()`, `outerWidth()`, and `outerHeight()`.
- **Motion**: Added `morphElement()`, `parallax()`, `typewriter()`, and `setReducedMotion()` for richer animation workflows and global reduced-motion overrides.
- **Router**: Added regex-constrained params (`/user/:id(\\d+)`), `redirectTo`, per-route `beforeEnter` guards, `useRoute()` for fine-grained route signals, optional scroll restoration, and the declarative `<bq-link>` / `registerBqLink()` API.
- **Store**: Added `$onAction()` lifecycle hooks and expanded `createPersistedStore()` with configurable `key`, `storage`, `serializer`, `version`, and `migrate` options while preserving backward compatibility with the legacy string-key signature.
- **Core / Types**: Added explicit type annotations for the `utils` namespace and exported `BQueryUtils` consistently for typed namespace-style utility access.

### Changed (1.7.0)

- **Bundle exports**: The package metadata, root entry point, and full bundle now expose all currently shipped modules, including accessibility, drag and drop, forms, i18n, media, plugins, devtools, testing, and SSR utilities.
- **Docs**: README, agent context files, and VitePress guides now describe the expanded modular surface area, new component/router/store APIs, and the new SSR/testing workflows.
- **Storybook**: Story template parsing and boolean-attribute handling were tightened so interpolated attributes are scanned more predictably while preserving authored custom-element markup.

### Fixed (1.7.0)

- **Component**: Tightened state/update semantics around deferred attribute changes, scoped resource setup, and lifecycle-driven rerenders so component-local reactive resources clean up more safely across disconnects and attribute updates.
- **Router**: `<bq-link>` active matching now respects path-segment boundaries, preserves user-authored active classes, and route matching / history-state handling behaves more defensively across redirects, wildcards, and scroll restoration.
- **Store**: Persisted stores now ignore invalid deserialization payloads more safely and surface warnings when migrated state or version metadata cannot be written back to storage.
- **Motion / DnD / Media / SSR**: Follow-up fixes improved teardown safety, ghost-offset handling, hydration guards, parallax cleanup, network/media listener cleanup, and other environment-specific edge cases.

### Security (1.7.0)

- **i18n / Router / View / SSR / Core**: Hardened deep merges, query parsing, object-expression evaluation, SSR state serialization, and form serialization against prototype pollution, malformed input, and DOM/XSS edge cases discovered during review and code scanning.

## [1.6.0] - 2026-03-14

### Added (1.6.0)

- **Component**: Added `bool()` for boolean attribute interpolation in `html` / `safeHtml` templates, making component markup more ergonomic for `disabled`, `checked`, and similar flags.
- **Component**: Added typed state-aware component definitions and element helpers so `component()` / `defineComponent()` preserve explicit state generics in `render()`, lifecycle hooks, `getState()`, and `setState()`.
- **Component**: Added explicit `signals` support for component renders plus exported `ComponentSignalLike` / `ComponentSignals` types for strongly typed external reactive inputs.
- **Component**: Added `AttributeChange` metadata for `updated()` hooks and previous props for `beforeUpdate(newProps, oldProps)`.
- **Security**: Added `trusted()` fragment composition for safely splicing previously sanitized markup into `safeHtml` templates without double-escaping.
- **Storybook**: Added the `@bquery/bquery/storybook` entry point with `storyHtml()` and `when()` helpers for authoring web-component stories with sanitization and boolean-attribute shorthand.

### Changed (1.6.0)

- **Docs**: Expanded the README and VitePress guides to document boolean template attributes, typed component state, trusted fragment composition, explicit component signals, and Storybook story helpers.
- **Bundle exports**: The package metadata, agent reference files, and public entry-point documentation now reflect the new `storybook` export and the expanded component/security surface.

### Fixed (1.6.0)

- **Component**: Components now reuse their Shadow DOM style element across re-renders instead of recreating styles on every update.
- **Component**: Default input and textarea components preserve stable native controls during value updates while still re-rendering correctly for structural prop changes.
- **Component**: Declared signal subscriptions are now restored correctly across disconnect/reconnect cycles and ignore undeclared reactive reads during render.

### Security (1.6.0)

- **Component / Storybook**: Story-authored and component-authored markup is sanitized while preserving explicitly authored custom-element tags and opted-in attributes, improving secure composition for design-system stories.

## [1.5.0] - 2026-03-12

### Added (1.5.0)

- **Reactive**: Added async composables `useAsyncData()`, `useFetch()`, and `createUseFetch()` for signal-driven request lifecycles with `data`, `error`, `status`, `pending`, `refresh()`, `clear()`, and `dispose()`.
- **Reactive**: Exported async helper types from `@bquery/bquery/reactive`, including `AsyncDataState`, `AsyncDataStatus`, `AsyncWatchSource`, `FetchInput`, `UseAsyncDataOptions`, and `UseFetchOptions`.
- **Platform**: Added global configuration helpers `defineBqueryConfig()` and `getBqueryConfig()` for fetch, cookies, announcers, page meta, transitions, and default component-library settings.
- **Platform**: Added `useCookie()` for reactive cookie state with typed serialization/deserialization, default config inheritance, and automatic persistence.
- **Platform**: Added `definePageMeta()` for document title, meta/link tags, and temporary `html` / `body` attribute management with cleanup support.
- **Platform**: Added `useAnnouncer()` for accessible ARIA live-region announcements with configurable politeness, timing, and teardown.
- **Component**: Added `registerDefaultComponents()` plus typed `DefaultComponentLibraryOptions` / `RegisteredDefaultComponents` exports to register a default native component library (`button`, `card`, `input`, `textarea`, `checkbox`) with configurable prefixes.
- **Motion**: Expanded `transition()` to support richer `TransitionOptions`, including root classes, transition types, reduced-motion skipping, and `onReady` / `onFinish` callbacks.

### Changed (1.5.0)

- **Tooling**: Replaced the legacy playground workflow with Storybook-based component development, preview styling, and first-party stories for the default component library.
- **Platform / Motion / Component**: Global defaults can now be shared across modules via `defineBqueryConfig()`, allowing centralized configuration for transitions, fetch requests, cookies, announcers, page metadata, and default component prefixes.
- **Bundle exports**: The full bundle and module entry points now expose the new reactive composables, platform helpers, default component library registration, and their associated public types.

### Fixed (1.5.0)

- **Reactive**: `useAsyncData()` now handles watcher-triggered refreshes, disposal, and concurrent execution races more safely so stale executions do not overwrite newer state.
- **Reactive / Platform**: `useFetch()` now preserves `Request` inputs and headers more reliably, merges configured/default headers safely, keeps factory typing intact in `createUseFetch()`, and rejects bodies on `GET` / `HEAD` requests.
- **Platform**: `useCookie()` now only auto-parses likely JSON values, avoids write-on-initialization side effects, and automatically enforces `Secure` when `SameSite=None` is used.
- **Platform**: `useAnnouncer()` now guards teardown and timer cleanup more defensively in edge cases and non-DOM environments.
- **Component**: Default form controls avoid duplicate custom events and unnecessary full Shadow DOM re-renders while users type into input and textarea controls.
- **Motion**: Transition class/type tokens are now sanitized before being applied, preventing empty or whitespace-only tokens from leaking into the document root or View Transitions API.

### Security (1.5.0)

- **Component**: Shadow DOM sanitization now preserves standard form-related attributes required by the default input, textarea, and checkbox components while still enforcing security-by-default rendering.

## [1.4.0] - 2026-02-10

### Added (1.4.0)

- **Core**: `css()` on `BQueryElement` and `BQueryCollection` now acts as a getter when called with a single property name, returning the computed style value via `getComputedStyle()`. TypeScript overload signatures distinguish getter (`string`) from setter (`this`).
- **Core**: `is(selector)` method on `BQueryElement` as a jQuery-style alias for `matches()`.
- **Core**: `find(selector)` method on `BQueryCollection` to query descendant elements matching a CSS selector across all elements, with automatic deduplication via `Set`.
- **Core**: `debounce()` and `throttle()` now return enhanced functions with a `.cancel()` method — `debounce.cancel()` clears the pending timeout, `throttle.cancel()` resets the throttle timer allowing immediate re-execution.
- **Core**: Exported `DebouncedFn<TArgs>` and `ThrottledFn<TArgs>` interfaces from `@bquery/bquery/core` for typed usage of cancellable debounced/throttled functions.
- **Reactive**: `Signal.dispose()` method to remove all subscribers from a signal, preventing memory leaks when a signal is no longer needed. Also cleans up observer dependency references bidirectionally.

### Fixed (1.4.0)

- **Reactive**: `effect()` now catches errors thrown inside the effect body and logs them via `console.error` instead of crashing the reactive system. Subsequent signal updates continue to trigger the effect.
- **Reactive**: Effect cleanup functions are now wrapped in try/catch — errors during cleanup are caught and logged rather than propagating and breaking the reactive graph.
- **Reactive**: Batch flush (`flushObservers()`) now catches errors thrown by individual observers and continues executing remaining pending observers, preventing a single failing observer from blocking others.
- **Reactive**: `endBatch()` now guards against underflow — calling `endBatch()` without a matching `beginBatch()` is a safe no-op instead of decrementing `batchDepth` below zero.
- **Platform**: `WebStorageAdapter.keys()` now uses the spec-compliant `Storage.key(index)` iteration API instead of `Object.keys()`, which is more reliable across environments (e.g., happy-dom, Safari).
- **View**: `parseObjectExpression()` now correctly handles escaped backslashes before quotes by counting consecutive backslashes — a double backslash (`\\`) before a quote no longer incorrectly treats the quote as escaped, fixing edge cases in `bq-class` and `bq-style` object expressions.

### Security (1.4.0)

- `srcset` attributes are now validated per-URL rather than as a single URL string, correctly catching `javascript:` URLs embedded in responsive image descriptors. If any entry is unsafe, the entire `srcset` attribute is removed (e.g., `"safe.jpg 1x, javascript:alert(1) 2x"` → attribute removed).
- `action` attribute on `<form>` elements is now validated as a URL attribute (like `href`/`src`), preventing `javascript:` protocol URLs in form actions.

## [1.3.0] - 2026-01-26

### Added (1.3.0)

- **Core**: Added attribute helpers `removeAttr()` and `toggleAttr()`, plus collection DOM helpers `append()`, `prepend()`, `before()`, `after()`, `wrap()`, `unwrap()`, and `replaceWith()`.
- **Core**: Expanded utilities with new array, function, number, and string helpers (e.g. `ensureArray()`, `unique()`, `chunk()`, `compact()`, `flatten()`, `once()`, `noop()`, `inRange()`, `toNumber()`, `truncate()`, `slugify()`, `escapeRegExp()`, `hasOwn()`, `isDate()`, `isPromise()`, `isObject()`).
- **Motion**: Modularized motion utilities with new single-purpose helpers and presets.
  - New helpers: `animate`, `sequence`, `timeline`, `scrollAnimate`, `stagger`, `flipElements`.
  - New presets: `easingPresets`, `keyframePresets`, plus individual easing exports.
  - Improved reduced-motion support via `prefersReducedMotion()`.
- **Component**: `defineComponent()` factory for manual class creation and custom registration.
- **Reactive**: `linkedSignal()` helper for writable computed values that bridge getters and setters.
- **Store**: New helpers `defineStore()`, `mapGetters()`, and `watchStore()` for ergonomic factories, getter mapping, and targeted subscriptions.

### Changed (1.3.0)

- **Core**: Internal DOM helpers extracted into focused utilities to improve core modularity (no breaking API changes).
- **Core**: Utilities modularized into focused helper modules and re-exported as named exports from `@bquery/bquery/core` (the `utils` namespace remains for compatibility).
- **Security**: Internals modularized (sanitize core, Trusted Types, CSP helpers, constants/types) with no API changes.
- **Router**: Internals modularized into focused submodules with no public API changes.
- **Component**: Internals modularized into focused submodules with no public API changes.
- **Reactive**: Internals modularized into focused submodules with no public API changes.
- **Store**: Internals modularized into focused submodules (types, registry, plugins, helpers) with no public API breaks.
- **View**: Internals modularized into focused submodules with no public API changes.

### Fixed (1.3.0)

- **Security**: `security/sanitize` now re-exports `generateNonce()` and `isTrustedTypesSupported()` for legacy deep imports.
- **Component**: Sanitize component render markup before writing to the Shadow DOM (security-by-default consistency).
- **Component**: `attributeChangedCallback` now only triggers re-renders after initial mount, preventing double renders.
- **Component**: Styles are now applied via `<style>` element with `textContent` instead of `innerHTML` to prevent markup injection.
- **Core**: `unwrap()` on collections now correctly de-duplicates parents to avoid removing the same parent multiple times.
- **Core**: `insertContent()` now maintains correct DOM order when inserting multiple elements for `beforebegin`, `afterbegin`, and `afterend` positions.
- **Core**: `once()` utility no longer caches failures; function is retried on subsequent calls after an exception.
- **Motion**: `timeline.seek()` now correctly calculates currentTime without double-subtracting delay offset.
- **Motion**: `timeline.duration()` now properly accounts for `iterations` option when calculating total duration.
- **Router**: `interceptLinks()` now skips middle-click, Ctrl+click, Cmd+click, Shift+click, Alt+click, and already-prevented events.
- **Router**: Hash-routing mode now correctly parses query parameters and hash fragments for route matching.
- **Router**: Navigation guards cancelling popstate now restore the full URL including query and hash.
- **Router**: Link interception now correctly strips base path and handles hash-routing links (`href="#/route"`).
- **Reactive**: `untrack()` now properly suppresses dependency tracking for computed values without breaking internal computed dependencies.
- **Reactive**: `persistedSignal()` now gracefully handles Safari private mode and environments without `localStorage`.
- **Store**: `defineStore()` now caches store instances properly and respects `destroyStore()` invalidation.
- **Store**: `$state` snapshot now uses `untrack()` to prevent accidental reactive dependencies inside effects.
- **Store**: Actions can now assign non-state properties without throwing `TypeError` in strict mode.
- **View**: `bq-class` now correctly distinguishes bracket property access (`obj['key']`) from array literals.
- **View**: `bq-style` now removes stale style properties when the style object changes.
- **View**: `bq-show` now correctly shows elements that start with `display: none`.
- **View**: `bq-for` now warns when duplicate keys are detected and falls back to index-based keying.
- **View**: `bq-ref` now correctly handles nested object property access (e.g., `refs.inputEl`) and cleans up object refs on destroy.
- **View**: `bq-on` now supports signal mutations in event expressions (e.g., `count.value++`).
- **View**: `createTemplate()` now rejects templates with multiple root elements or `bq-for`/`bq-if` on root.
- **View**: `mount()` now rejects mounting on elements with `bq-for` directive to prevent detached root issues.
- **Docs**: Corrected the event section heading in the Core API guide for `BQueryElement`.

## [1.2.0] - 2026-01-24

### Added (1.2.0)

- **Router**: New SPA client-side routing module with History API support.
  - `createRouter()` factory with routes, base path, and hash mode options.
  - `navigate()`, `back()`, `forward()` navigation functions.
  - `beforeEach` / `afterEach` navigation guards.
  - Route params (`:id`), query string parsing, and wildcard (`*`) routes.
  - `currentRoute` reactive signal for tracking current route state.
  - `link()` and `interceptLinks()` helpers for declarative navigation.
  - `resolve()` for named route URL generation.
  - `isActive()` and `isActiveSignal()` for active link styling.
- **Store**: New Pinia/Vuex-style state management module built on signals.
  - `createStore({ id, state, getters, actions })` for defining stores.
  - Reactive getters via `computed()` and state via `signal()`.
  - Actions with automatic `this` context binding.
  - `$reset()`, `$patch()`, `$subscribe()`, `$state` store utilities.
  - `createPersistedStore()` for localStorage persistence.
  - `registerPlugin()` for extending store functionality.
  - `mapState()` and `mapActions()` composition helpers.
  - `getStore()`, `listStores()`, `destroyStore()` for store registry.
  - Devtools integration via `window.__BQUERY_DEVTOOLS__`.
- **View**: New declarative DOM binding module (Vue/Alpine-style directives).
  - `bq-text` and `bq-html` for content binding.
  - `bq-if` and `bq-show` for conditional rendering.
  - `bq-class` and `bq-style` for class/style binding.
  - `bq-model` for two-way input binding.
  - `bq-bind:attr` for attribute binding.
  - `bq-on:event` for event binding.
  - `bq-for` for list rendering with `(item, index) in items` syntax.
  - `bq-ref` for element references.
  - `mount()` function to bind context to DOM.
  - `createTemplate()` for reusable template factories.
  - Custom directive prefix support.
  - Automatic HTML sanitization for security.

## [1.1.2] - 2026-01-24

### Fixed (1.1.2)

- **Docs**: Fixed import paths and added error handling in agents documentation.

### Security (1.1.2)

- Added `rel="noopener noreferrer"` to external links for improved security.

## [1.1.1] - 2026-01-24

### Fixed (1.1.1)

- Fixed a possibly dangerous HTML handling in the playground examples.

## [1.1.0] - 2026-01-23

### Added (1.1.0)

- **Core**: `delegate(event, selector, handler)` method for event delegation on dynamically added elements.
- **Core**: `wrap(wrapper)` method to wrap elements with a new parent container.
- **Core**: `unwrap()` method to remove parent element while keeping children.
- **Core**: `replaceWith(content)` method to replace an element with new content.
- **Core**: `scrollTo(options?)` method for smooth scrolling to elements.
- **Core**: `serialize()` method to serialize form data as an object.
- **Core**: `serializeString()` method to serialize form data as URL-encoded string.
- **Reactive**: `watch(signal, callback)` function to observe signal changes with old/new values.
- **Reactive**: `readonly(signal)` function to create immutable signal wrappers.
- **Reactive**: `untrack(fn)` function to read signals without creating dependencies.
- **Reactive**: `isSignal(value)` type guard to check if a value is a Signal.
- **Reactive**: `isComputed(value)` type guard to check if a value is a Computed.
- **Reactive**: `ReadonlySignal<T>` type for read-only signal interfaces.
- **Component**: `beforeMount()` lifecycle hook that runs before initial render.
- **Component**: `beforeUpdate(props)` lifecycle hook that can prevent updates by returning `false`.
- **Component**: `onError(error)` lifecycle hook for error handling in components.
- **Component**: `validator` property for prop definitions to validate prop values.
- **Security**: Extended dangerous tag list including `svg`, `math`, `template`, `slot`, `base`, `meta`.
- **Security**: DOM clobbering protection with reserved ID/name filtering.
- **Security**: Zero-width Unicode character stripping in URL normalization.

### Changed (1.1.0)

- **Reactive**: Optimized observer stack operations from O(n) array copy to O(1) push/pop (~40% performance improvement).
- **Security**: Added `file:` protocol to blocked URL schemes.
- **Security**: Extended dangerous attribute prefixes with `xlink:` and `xmlns:`.

### Security (1.1.0)

- Fixed prototype pollution vulnerability in `utils.merge()` by filtering `__proto__`, `constructor`, and `prototype` keys.
- Enhanced HTML sanitizer to block additional XSS vectors through SVG, MathML, and template elements.
- Added protection against DOM clobbering attacks by preventing reserved IDs like `document`, `cookie`, `location`.
- Improved URL sanitization to prevent Unicode bypass attacks using zero-width characters.

## [1.0.2] - 2026-01-23

### Fixed (1.0.2)

- Fixed broken documentation links in README.md.

## [1.0.1] - 2026-01-23

### Fixed (1.0.1)

- Corrected the package name in `package.json` to `@bquery/bquery` for proper npm publishing.
- Updated the author field in `package.json` to reflect the main maintainer.
- Revised the homepage URL in `package.json` to point to the official bQuery website.
- Added publish configuration in `package.json` to ensure public accessibility on npm registry.

## [1.0.0] - 2026-01-21

### Added (1.0.0)

- Core API with selectors (`$`, `$$`), `BQueryElement`/`BQueryCollection`, DOM operations, events, and utilities.
- Reactive module with `signal`, `computed`, `effect`, `batch`, plus `Signal`/`Computed` types.
- Component helper for Web Components including `component()` and the `html` template tag, prop definitions, and lifecycle hooks.
- Motion module with view transitions, FLIP animations (`capturePosition`, `flip`, `flipList`), and spring physics (`spring`, presets).
- Security module with sanitizing utilities, Trusted Types integration, and CSP helpers.
- Platform module with unified adapters for storage, buckets, cache, and notifications.
- VitePress documentation and Vite playground for quick demos.
- Test suite for Core, Reactive, Motion, Component, and Security.
