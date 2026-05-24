# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to Semantic Versioning.

## Releases

- [Changelog](#changelog)
  - [Releases](#releases)
  - [Unreleased](#unreleased)
    - [Added (Unreleased)](#added-unreleased)
    - [Fixed (Unreleased)](#fixed-unreleased)
  - [\[1.14.0\] - 2026-05-24](#1140---2026-05-24)
    - [Added (1.14.0)](#added-1140)
    - [Changed (1.14.0)](#changed-1140)
  - [\[1.13.0\] - 2026-05-21](#1130---2026-05-21)
    - [Added (1.13.0)](#added-1130)
    - [Changed (1.13.0)](#changed-1130)
  - [\[1.12.0\] - 2026-05-16](#1120---2026-05-16)
    - [Added (1.12.0)](#added-1120)
    - [Changed (1.12.0)](#changed-1120)
    - [Fixed (1.12.0)](#fixed-1120)
  - [\[1.11.1\] - 2026-05-12](#1111---2026-05-12)
    - [Changed (1.11.1)](#changed-1111)
  - [\[1.11.0\] - 2026-04-30](#1110---2026-04-30)
    - [Added (1.11.0)](#added-1110)
    - [Changed (1.11.0)](#changed-1110)
    - [Fixed (1.11.0)](#fixed-1110)
  - [\[1.10.0\] - 2026-04-15](#1100---2026-04-15)
    - [Added (1.10.0)](#added-1100)
    - [Changed (1.10.0)](#changed-1100)
    - [Fixed (1.10.0)](#fixed-1100)
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

## [Unreleased]

### Added (Unreleased)

### Fixed (Unreleased)

## [1.14.0] - 2026-05-24

### Added (1.14.0)

- **Media / Preference signals**: Added `usePreferredColorScheme()`, `usePreferredContrast()`, `usePreferredReducedTransparency()`, `usePreferredLanguage()`, and `usePreferredLanguages()` reactive composables to `@bquery/bquery/media` that wrap `prefers-color-scheme`, `prefers-contrast`, `prefers-reduced-transparency`, and `navigator.language(s)` with deterministic SSR defaults.
- **Media / Page state**: Added `useOnlineStatus()` (slim boolean variant of `useNetworkStatus()`), `usePageVisibility()`, `useDocumentFocus()`, `useWindowFocus()`, and `useIdle(timeoutMs, opts?)` to track top-level user-activity state.
- **Media / Element observers**: Added `useElementSize(target, opts?)`, `useElementBounding(target, opts?)`, `useElementVisibility(target, opts?)`, `useHover(target)`, `useFocus(target)`, `useFocusWithin(target)`, and `useActiveElement()` — ergonomic wrappers over `ResizeObserver` / `IntersectionObserver` and DOM focus events. Targets accept a `Signal<Element | null>` in addition to plain elements.
- **Media / Pointer & scroll**: Added `usePointer()` (`{ x, y, pressure, type, isInside }`) and `useScroll(target?)` (`{ x, y, directionX, directionY, isScrolling, arrived }`).
- **Media / Platform integrations**: Added `usePermission(name)` (`'granted' | 'denied' | 'prompt' | 'unsupported'`), `useWakeLock()` (`isActive`, `request()`, `release()`), `useShare()` / `useShareSupported()`, `useBroadcastChannel<T>(name)` (`{ data, post, close }`), `useEventListener(target, event, opts?)`, `useMediaDevices()`, and `useStorage<T>(key, defaultValue, opts?)` with cross-tab `storage` event sync.
- **Media / Clipboard**: Added `clipboard.isSupported`, `clipboard.isImageSupported`, `clipboard.readImage()`, `clipboard.writeImage()`, and `clipboard.clipboardText()` reactive accessor.
- **Media / Composables**: Every new composable accepts an optional `{ signal: AbortSignal }` for auto-teardown matching the `motion` 1.13 convention, and an internal shared `createMediaSignal` helper standardises SSR safety + idempotent teardown.
- **Plugin / Hooks**: Added a synchronous filter pipeline (`addFilter`, `applyFilters`, `removeFilter`, `listFilters`) and a fire-and-forget action bus (`addAction`, `doAction`, `removeAction`, `listActions`) exposed both on the install context (`ctx.addFilter`, `ctx.addAction`) and as standalone exports for app-level consumers.
- **Plugin / DI**: Added container-level dependency injection — `createInjectionKey<T>()`, `provide(key, value)`, `inject(key)`, `hasProvided(key)`, `resetDi()` — and a matching `ctx.provide` / `ctx.inject`. Plugins can register `ctx.onCleanup(fn)` callbacks that fire when the plugin is uninstalled.
- **Plugin / Lifecycle**: Added `unuse(name)` and `uninstall(name)` to detach every directive, filter, action, and DI binding owned by a plugin and run its registered cleanups. `install()` may now return `void | Promise<void>`; concurrent installs of the same name are serialised.
- **Plugin / Metadata**: `BQueryPlugin` now accepts optional `version`, `description`, and `dependencies: string[]`. `use()` enforces dependencies via `dependencyMode: 'throw' | 'warn'`. New `getPluginInfo(name)` and `getInstalledPlugins({ withMetadata: true })` overloads expose plugin metadata.
- **Plugin / Directives**: Directives may now register lifecycle objects `{ mounted, updated, unmounted }` and use plugin-namespaced names like `tooltip:arrow`.
- **Devtools / Timeline**: Timeline gained a ring buffer (`maxTimelineEntries`, default 1000) and `TimelineEntry` now carries optional `payload`, `source`, and `duration`. New event types: `signal:create`, `signal:dispose`, `effect:dispose`, `component:mount`, `component:unmount`, `component:render`, `route:guard`, `error:caught`, `measure`, `mark`.
- **Devtools / Querying**: Added `filterTimeline({ types, since, until, search })` and `subscribeTimeline(listener)` for live consumers.
- **Devtools / Inspection**: Added privacy-aware `inspectSignals({ includeValues: false })`, structural `diffSignals(prev, next)` / `diffStores(prev, next)`, `traceSignal(label)` / `untraceSignal(label)`, and `inspectEffects()`.
- **Devtools / Snapshots**: Added `exportDevtoolsSnapshot()` and `importDevtoolsSnapshot(json)` for offline inspection and bug reports.
- **Devtools / Bridge**: Added `installBrowserBridge()` that mirrors timeline events to `window.__BQUERY_DEVTOOLS__.events` for future browser-extension panels (no-op outside a DOM).
- **Devtools / Performance**: Added `time(label, fn)`, `measureRender(tagName, fn)`, and `getPerformanceSummary()` aggregating event counts and average durations per type.
- **Testing / Cleanup**: Added `cleanup()` to unmount any tracked render results from the current test, plus `autoCleanup(beforeEach, afterEach)` to wire it into `bun:test`.
- **Testing / Events**: Attached shortcut methods to the existing `fireEvent` — `fireEvent.click`, `fireEvent.dblClick`, `fireEvent.input(el, value)`, `fireEvent.change(el, value)`, `fireEvent.submit`, `fireEvent.focus`, `fireEvent.blur`, `fireEvent.keyDown`, `fireEvent.keyUp` — and added a `userEvent` namespace (`click`, `dblClick`, `hover`, `unhover`, `type(el, text, { delay? })`, `clear`, `selectOptions`, `tab`, `paste`) that flushes effects + microtasks before returning.
- **Testing / Queries**: Added a shadow-DOM-aware query layer — `screen.getByRole`/`getByText`/`getByLabelText`/`getByPlaceholderText`/`getByTestId` with `query*` and `find*` variants — and a `within(root)` factory that produces the same scoped query API.
- **Testing / Reactive helpers**: Added `mockComputed(fn)` (with `recomputeCount`), `mockEffect(fn)` (`{ runs, dispose }`), `tick()` / `nextTick()`, `flushPromises()`, and `runScheduled()`.
- **Testing / Mocks**: Added `mockStore<T>(initialState)`, `mockI18n({ locale, messages })`, `mockForm<T>(initialValues)`, `mockFetch(routes)`, and `mockWebSocket()` for isolated module testing.
- **Testing / Snapshots & a11y**: Added `prettyDOM(el, { maxLength, includeShadow })`, `getReactiveSummary(el)`, and `expectAccessible(el)` returning a structured `AccessibilityResult` for image-alt / button-name / label-input rules.

### Changed (1.14.0)

- **Devtools**: `inspectSignals()` accepts a new `{ includeValues?: boolean }` option. `enableDevtools()` accepts `maxTimelineEntries` and now flushes any active timeline subscribers on disable.
- **Plugin**: `BQueryPlugin.install` may now return `void | Promise<void>`; `use()` returns a `Promise<boolean>` whenever any registered plugin installs asynchronously.
- **Media**: `clipboard` re-uses a shared SSR-safe initialisation helper; existing `readText` / `writeText` signatures are unchanged.

## [1.13.0] - 2026-05-21

### Added (1.13.0)

- **Forms / Validators**: Added a batteries-included set of tree-shakeable validators to `@bquery/bquery/forms` — `integer`, `numeric`, `between`, `length`, `oneOf`, `notOneOf`, `arrayOf`, `requiredIf`, `requiredUnless`, `dateAfter`, `dateBefore`, `validDate`, `fileSize`, `fileType` — plus combinators `compose`, `all`, `not`, and `withMessage`. (`validDate` is exported under that name to avoid collision with the existing `isDate` type guard in `@bquery/bquery/core`.)
- **Forms / Field state**: Lifted `isValidating`, `isFocused`, and `dirtySince` signals onto every `FormField`. Added per-field helpers `focus()`, `blur()`, `setValue(value, { touch, validate, silent })`, `setError(message)`, `clearError()`, a `disabled` signal that excludes the field from validation, and per-field `validateOn` / `debounceMs` parity with `useFormField`. `FieldConfig` now accepts `parse` and `format` for programmatic inbound/outbound value normalization.
- **Forms / Form state**: Added `submitCount`, `lastSubmittedAt`, `submitError`, aggregated `isValidating` and `isPristine`, and helpers `touchAll()`, `untouchAll()`, `resetField(name)`, `resetErrors()`, `getDirtyValues()`, and `subscribe(listener)`. `FormConfig` now accepts `onSubmitError`, `onSubmitSuccess`, `validationStrategy`, and `mode: 'all' | 'first'`.
- **Forms / Field arrays**: Added `createFieldArray({ initial, factory, validators })` with `add`, `remove`, `move`, `insert`, `clear`, `items`, and `length` for dynamic repeating field groups.
- **Forms / Schema**: Added a fluent `schema({ name: field<string>().required().minLength(2), … })` helper that composes existing validator factories into a `FieldConfig` map.
- **Forms / DOM bindings**: Added `bindField(field, element, options?)` and `bindForm(form, formElement, options?)` to bridge `Form` and `FormField` instances to standard inputs, selects, textareas, checkboxes, radios, file inputs, and `[contenteditable]` elements; both return cleanup functions. `bindForm` auto-discovers `[name]` inputs, marks `aria-invalid`, and supports a configurable error slot mapper.
- **Forms / Composables**: Added scope-aware `useForm`, `useField`, and `useFieldArray` wrappers that auto-dispose with the owning component.
- **Forms / SSR**: Added `serializeFormState(id, form.snapshot())`, `readSerializedFormState(id)`, and `hydrateForm(form, id)` helpers (built on `src/ssr/escape.ts`) so server-rendered form state can resume on the client.
- **Component / Refs**: Added `useRef<T>()` that auto-clears on disconnect.
- **Component / Slots**: Added `useSlot(host, name?)` (reactive `Signal<Element[]>`), `hasSlot(host, name?)`, and `slotText(host, name?)`.
- **Component / Events**: Added sanitizer-safe delegated event helpers `on(event, handler)`, `onClick`, `onInput`, `onChange`, `onSubmit`, and `bindDelegatedEvents(host)`. Handlers are stored in a module-level map keyed by opaque IDs; templates only carry `data-bq-on-<event>="<id>"` attributes.
- **Component / DI**: Added `provide(host, key, value)`, `inject(host, key, fallback?)`, `injectionKey<T>(description)`, and the `formContextKey` for letting inputs auto-bind to an enclosing `<bq-form>` without globals.
- **Component / Lifecycle**: Added `beforeUnmount` and `errorBoundary(error, info)` hooks on `ComponentDefinition`, plus a scope-tracked `whenIdle(fn)` helper.
- **Component / Async**: Added `useAsync(fn)` returning `{ data, error, loading, refresh }` signals with `AbortController`-aware cancellation.
- **Component / Props**: Added imperative `setProp(name, value)` and `getProp(name)` methods on every component instance for non-string objects (arrays, callbacks) that bypass attribute serialization.
- **Component / Styles**: Added a `css` tagged template literal that produces a `ComponentStyles` payload. When Constructable Stylesheets are available the styles are shared via `document.adoptedStyleSheets`; otherwise the existing `<style>` element pathway is used. Interpolated values are CSS-escaped.
- **Component / Lists**: Added `keyedList(items, keyFn, renderItem)` and `reconcileKeyed(container)` for keyed list rendering inside shadow DOM.
- **Motion / Easing**: Full Penner easing family — `easeIn`/`easeOut`/`easeInOut` variants of `Quart`, `Quint`, `Sine`, `Expo`, `Circ`, `Back`, `Elastic`, and `Bounce` are now exported and mirrored in `easingPresets`. Added the `cubicBezier(x1, y1, x2, y2)` factory (Newton-Raphson refinement matching CSS `cubic-bezier()`), `steps(count, position?)` factory mirroring CSS `steps()`, and the `mix(a, b, weight)` / `chain(...easings)` composers.
- **Motion / Tweens**: New `animateValue<T>()` and `tween<T>()` interpolate numbers, number arrays, or `Record<string, number>` between `from` and `to` using `requestAnimationFrame`. `tween()` returns full imperative controls (`pause`/`resume`/`reverse`/`seek`/`stop`/`progress`) with a `finished` promise, supports an `AbortSignal`, and respects `prefers-reduced-motion`.
- **Motion / `animate()` controls**: `animate()` now accepts a `signal: AbortSignal` to cancel mid-flight and a `playbackRate` override. New `animateTo(element, styles, opts)` ergonomic wrapper turns a CSS property record (or `[from, to]` tuples) into keyframes.
- **Motion / Springs**: `spring()` instances now expose `.velocity(v?)` and `.set(v)` for gesture-driven workflows. New `springVector(dims, config)` drives coordinated multi-dimensional motion. `springPresets` expands with `wobbly`, `slow`, and `molasses` presets.
- **Motion / Timeline**: Timelines now support labels (`addLabel(name, at?)` + label-relative `at` strings like `'label+=200'`), `reverse()`, `playbackRate(n)`, `repeat(count|'infinite')`, `yoyo(boolean)`, `onUpdate(time)` subscriptions, and a `progress()` getter in `[0, 1]`.
- **Motion / New primitives**: `scrollProgress(element, opts)` exposes a 0..1 scroll-linked stream; `inView(element, opts)` resolves a thenable on enter (with an optional reactive `onChange` callback); `magnetic(element, opts)`, `tilt(element, opts)`, `shake(element, opts)`, `pulse(element, opts)`, and `countUp(element, from, to, opts)` cover the micro-interaction toolkit. All effects honor `prefers-reduced-motion` by default.
- **Motion / Stagger**: `stagger()` gains `grid: [cols, rows]` + `from: { x, y }` 2D origins, an `axis: 'x' | 'y'` distance restriction, and a deterministic `random` option (with optional `randomSeed`).
- **Motion / Reduced motion**: `onReducedMotionChange(callback)` subscribes to changes (system preference *or* `setReducedMotion()` override) and returns an unsubscribe; `reducedMotionSignal()` exposes the same value as a reactive `ReadonlySignal<boolean>` for `view`/components.
- **Utils / Array** (`@bquery/bquery/core`): Added `groupBy`, `keyBy`, `partition`, `zip`, `range`, `first`, `last`, `take`, `drop`, `sample`, `shuffle` (Fisher–Yates), `uniqueBy`, `sortBy` (single or multi-selector), `intersection`, `difference`, `flattenDeep`, `move`, and `chunkBy`.
- **Utils / Function**: Added `memoize(fn, keyFn?)` (`.clear()` / `.delete(key)`), `compose(...fns)` / `pipe(...fns)`, `curry(fn)`, `partial(fn, ...preset)`, and `retry(fn, opts?)` with exponential backoff, jitter, `shouldRetry`, `onRetry`, and `AbortSignal` support. `debounce()` gained an optional `{ leading?, trailing?, maxWait? }` option bag plus a `.flush()` method; `throttle()` gained `{ leading?, trailing? }` plus `.flush()`. Existing `(fn, ms)` signatures remain fully backward-compatible.
- **Utils / Object**: Added prototype-pollution-safe deep accessors `get(obj, path, default?)`, `set(obj, path, value)`, and `has(obj, path)` with dot/bracket path syntax; `mapValues`, `mapKeys`, `invert`, `deepEqual` (with `isEqual` alias), `freeze` (deep), `defaults(target, ...sources)`, and typed wrappers `entriesTyped` / `keysTyped`.
- **Utils / String**: Added `toSnakeCase`, `toPascalCase`, `toTitleCase`, `pad`, `padStart`, `padEnd`, `wordCount`, safe `template(str, vars)` (`${name}` interpolation with no `eval`), DOM-free `stripHtml`, crypto-backed `randomString(length, charset?)`, and universal-terminator `lines(str)`.
- **Utils / Number**: Added `round(value, precision?)`, `roundTo(value, step)`, `lerp`, `inverseLerp`, `mapRange`, locale-aware `formatBytes(bytes, opts?)` (decimal & binary units), `randomFloat`, `sum`, `average`, `median`, `degToRad`, and `radToDeg`.
- **Utils / Misc**: Added RFC 4122 v4 `uuid()` (uses `crypto.randomUUID()` / `getRandomValues()` when available, with a `Math.random()` fallback), Go-style sync/async `tryCatch(fn)`, `times(n, fn)`, `pollUntil(predicate, opts?)`, `nextFrame()`, and `nextTick()`.
- **Utils / Type guards**: Added `isError`, `isMap`, `isSet`, `isRegExp`, `isSymbol`, `isBigInt`, `isAsyncFunction`, `isIterable`, `isAsyncIterable`, `isNullish`, and `isDefined`.
- The `utils` namespace and `BQueryUtils` interface include every new entry alongside the existing helpers.

### Changed (1.13.0)

- **Full bundle**: `src/full.ts` re-exports every new public forms, component, and motion runtime/type surface alongside the new core utility helpers; `bun run check:full-bundle` continues to enforce drift detection.
- **AI guidance**: AGENT.md, llms.txt, copilot-instructions, Cursor / Cline rules, README, and CHANGELOG were refreshed for the 1.13.0 baseline. `bun run check:ai-guidance` passes.

## [1.12.0] - 2026-05-16

### Added (1.12.0)

- **Reactive / WebSocket**: Promoted `WebSocketSendData` to a public type-only export from `@bquery/bquery/reactive`. The alias was previously `@internal` even though it already surfaced through `UseWebSocketReturn.sendRaw`, `WebSocketSerializer.serialize`, and `WebSocketHeartbeatConfig.message`. Consumers can now `import type { WebSocketSendData } from '@bquery/bquery/reactive'` to reuse the union, matching the existing `ServerWebSocketData` export from `@bquery/bquery/server`.
- **Store / Plugins**: Added `unregisterPlugin(plugin)` and `clearPlugins()` to `@bquery/bquery/store`. `unregisterPlugin()` removes the first matching registration by identity and returns whether one was found; `clearPlugins()` empties the registry in one call. Already-created stores keep extensions that were applied before unregister; subsequent `defineStore()` / `createStore()` calls no longer receive the removed plugins. The previously global, append-only plugin registry now has a proper teardown path for test isolation and runtime plugin reloads.

### Changed (1.12.0)

- **Docs / Server**: Expanded the server guide with a public-surface reference, commonly used server types, null-prototype `params` / `query` details, route-scoped middleware examples, custom error handling, and WebSocket middleware short-circuit behavior. Added server module export tests for the barrel, root entry point, and full bundle.

### Fixed (1.12.0)

- **Full bundle / Tooling**: `src/full.ts` now re-exports all public type-only module exports from the platform, a11y, and media barrels, and `bun run check:full-bundle` now validates runtime and type exports statically so `/full` declaration drift is caught before release.

## [1.11.1] - 2026-05-12

### Changed (1.11.1)

- **Tooling / Dev dependencies**: Bumped `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser` from `8.59.1` to `8.59.3`, `eslint` from `10.2.1` to `10.3.0`, `globals` from `17.5.0` to `17.6.0`, and `vite` from `8.0.10` to `8.0.12`. The `vite` update brings in the stable `rolldown@1.0.0` release (previously `1.0.0-rc.17`) and `postcss@8.5.14`.

## [1.11.0] - 2026-04-30

### Added (1.11.0)

- **Server**: Added `@bquery/bquery/server`, a lightweight Express-inspired backend entry point with dependency-free routing, middleware composition, route params, query parsing, safe JSON/HTML response helpers, redirects, SSR-aware request rendering via `createServer()`, and runtime-agnostic WebSocket routing via `ws()` + `handleWebSocket()`.
- **Tooling / AI guidance**: Added `scripts/check-ai-guidance.mjs` plus `bun run check:ai-guidance` to validate version and engine sync across the repo's shared AI-facing guidance files.
- **SSR / Runtime-agnostic pipeline**: Massive expansion of `@bquery/bquery/ssr` so it now runs seamlessly on Node.js ≥ 24, Deno and Bun ≥ 1.3.13 with zero external dependencies. New DOM-free renderer activates automatically when no `DOMParser` is available; existing public APIs (`renderToString`, `hydrateMount`, `serializeStoreState`, `deserializeStoreState`, `hydrateStore(s)`) are unchanged.
- **SSR / Async render**: New `renderToStringAsync(template, data, ctx?)` awaits Promise- and `defer()`-valued binding context entries before rendering and respects `SSRContext.signal` cancellation.
- **SSR / Streaming**: New `renderToStream(template, data, ctx?)` returns a Web `ReadableStream<Uint8Array>` honouring abort signals.
- **SSR / Response**: New `renderToResponse(template, data, ctx?)` returns a `Response` with content-type, optional weak ETag (with `If-None-Match` 304 short-circuit), `Cache-Control`, and automatic head/asset/store-state injection.
- **SSR / Context**: New `createSSRContext()` exposing `request`, `url`, `headers`, `cookies`, `locale`, `userAgent`, `signal`, `nonce`, `head`, `assets`, `responseHeaders`, `status` and `reportError()`.
- **SSR / Head & Assets**: New `createHeadManager()` / `createAssetManager()` collect `<title>`, `<meta>`, `<link>`, `<script>`, preload, modulepreload and stylesheet entries; CSP nonces from `SSRContext.nonce` are auto-propagated.
- **SSR / Async helpers**: New `defer(promise, fallback?)` and `defineLoader(fn)` utilities consumed by `renderToStringAsync()`.
- **SSR / Hydration strategies**: New `hydrateOnVisible()`, `hydrateOnIdle()`, `hydrateOnInteraction()`, `hydrateOnMedia()` and `hydrateIsland()` for progressive island hydration. Each returns a `HydrationHandle` with `cancel()` and a `ready` Promise.
- **SSR / Configuration**: New `configureSSR({ backend, documentImpl })` and `getSSRConfig()` to pick between `'auto'`, `'pure'` (DOM-free) and `'dom'` backends or inject a custom `DOMParser` (e.g. `linkedom`/`happy-dom`/`jsdom`).
- **SSR / Runtime detection**: New `detectRuntime()`, `isServerRuntime()`, `isBrowserRuntime()`, `getSSRRuntimeFeatures()`.
- **SSR / Runtime adapters**: New `createWebHandler`, `createBunHandler`, `createDenoHandler`, `createNodeHandler` (translates `node:http` IncomingMessage/ServerResponse into Web `Request`/`Response`), and `createSSRHandler` auto-picking the right adapter.
- **SSR / Security**: Pure renderer is fully CSP-safe — its expression evaluator is a tightly-scoped Pratt parser with no `eval` or `new Function()`. Inline event handlers, `javascript:` URLs and `<script>` tags are stripped on both backends. Head-injected `<script>` bodies escape `</script>`, `<!--`, `\u2028` and `\u2029`.
- **SSR / Hydration mismatch dev-warnings**: New `RenderOptions.annotateHydration` flag emits a `data-bq-h="<hash>"` attribute on every directive element (both backends, in lock-step). New `verifyHydration(root, options?)` walks `[data-bq-h]` on the client, recomputes the directive signature, and reports/​warns on divergences via `HydrationMismatch` entries. Public `HYDRATION_HASH_ATTR` constant is exported for tooling.
- **SSR / Suspense streaming**: New `renderToStreamSuspense(template, data, options?)` flushes the synchronous shell with `defer(...)` fallbacks wrapped in `<bq-slot id="bq-s-N">…</bq-slot>` (using `bq-defer="key"` markers), then streams `<template id="bq-r-N">…</template>` + a CSP-nonce-aware patch script per resolved promise. Honours `AbortSignal` and reports loader errors via `SSRContext.onError` without aborting the stream.
- **SSR / Router bridge**: New `resolveSSRRoute({ url, routes, base? })`, `runRouteLoaders(route, ctx)` (recognises `meta.loader`), and `createSSRRouterContext({ url, routes, ctx, base? })` for matching URLs and running data loaders before render. Reports redirects + 404 cleanly.
- **SSR / Versioned store snapshots**: New `serializeStoreSnapshot({ version, storeIds?, nonce? })` returns `{ snapshot, json, scriptTag }`; new `hydrateStoreSnapshot(snapshot, { strict?, expectedVersion? })` returns a structured `{ applied, reason, appliedIds, unknownIds }` and warns on version drift / unknown IDs in strict mode. New `readStoreSnapshot()` reads and cleans up the published snapshot. Public `SSRStoreSnapshot` type.
- **SSR / Resumability hooks**: New `createResumableState({ initial? })` server-side collector with `set`/`get`/`entries`/`render({ nonce })`; new `resumeState(globalKey?, scriptId?)` client-side reader. CSP-nonce-aware, `</script>`-safe escaping.
- **SSR / Cross-runtime CI**: New `.github/workflows/ssr-cross-runtime.yml` builds the library once with Bun and runs `tests/cross-runtime/run.mjs` against Node 24, Bun 1.3 and Deno 2 to guard the runtime-agnostic surface.
- **SSR / Examples**: New `examples/ssr-bun/`, `examples/ssr-deno/` and `examples/ssr-node/` minimal HTTP servers all sharing `examples/shared/app.ts`.

### Changed (1.11.0)

- **Docs / AI guidance**: Refreshed `AGENT.md`, `llms.txt`, `.github/copilot-instructions.md`, `.cursorrules`, `.clinerules`, `README.md`, and `CONTRIBUTING.md` to the `1.11.0` SSR / server baseline, clarified their roles, and documented the AI-guidance sync workflow.
- `renderToString()` now falls back to the DOM-free pure renderer when no `DOMParser` is available, instead of throwing. Existing tests using `happy-dom` keep using the DOM backend.

### Fixed (1.11.0)

- No changes yet.

## [1.10.0] - 2026-04-15

### Added (1.10.0)

- **Concurrency**: Expanded `@bquery/bquery/concurrency` with Milestone 2 RPC-style communication via `createRpcWorker()` and `callWorkerMethod()`, adding explicit named method dispatch on top of the existing zero-build worker task API.
- **Concurrency / Pools**: Added `createTaskPool()` and `createRpcPool()` for explicit browser-first worker pools with bounded concurrency, FIFO queueing, and backpressure via `maxQueue`.
- **Concurrency / Reactive bindings**: Added `createReactiveTaskWorker()`, `createReactiveRpcWorker()`, `createReactiveTaskPool()`, and `createReactiveRpcPool()` so reusable workers and pools can expose readonly signal mirrors such as `state$`, `busy$`, `pending$`, and `size$` for UI monitoring.
- **Concurrency / High-level helpers**: Added `parallel()` for explicit task lists, `batchTasks()` as the adapted batched-task helper, and `map()` for chunked parallel array mapping on top of the existing worker-pool primitives.
- **Concurrency / Collection helpers**: Added `filter()`, `reduce()`, `some()`, `every()`, and `find()` as explicit ThreadTS-inspired collection helpers that preserve bQuery's browser-first, zero-build worker model without decorators or hidden runtimes.
- **Concurrency / Pipelines**: Added `pipeline()` as an optional immutable fluent layer over the existing collection helpers, keeping CSP and serialization limits explicit instead of introducing proxy-based worker magic.

### Changed (1.10.0)

- **Docs / Agent context**: Synced the README, guides, build/export metadata, and agent context files for the concurrency module's task + RPC + pool + collection-helper + pipeline scope, including an updated `threadts-universal` parity matrix and phased roadmap.

### Fixed (1.10.0)

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
