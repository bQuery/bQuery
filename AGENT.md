# AGENT.md — AI Coding Agent Guide for bQuery.js

> This file helps AI coding agents (Copilot, Cursor, Cline, Aider, etc.)
> understand, navigate, and modify this codebase effectively.

**Maintenance note:** `package.json` and `src/*/index.ts` are the authoritative sources for the current version, engine floor, and public exports. If release metadata or the public runtime surface changes, sync `AGENT.md`, `llms.txt`, `.github/copilot-instructions.md`, `.cursorrules`, `.clinerules`, `README.md`, and run `bun run check:ai-guidance`.

## Identity

| Field       | Value                                                                                                                                                                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name        | bQuery.js                                                                                                                                                                                                                                                                             |
| Package     | `@bquery/bquery`                                                                                                                                                                                                                                                                      |
| Version     | 1.11.0                                                                                                                                                                                                                                                                                |
| License     | MIT                                                                                                                                                                                                                                                                                   |
| Language    | TypeScript (strict)                                                                                                                                                                                                                                                                   |
| Runtime     | Browser (ESM, UMD, IIFE) — tests run via Bun                                                                                                                                                                                                                                          |
| Toolchain   | Node.js `>=24.0.0`, Bun `>=1.3.13`                                                                                                                                                                                                                                                    |
| Repository  | <https://github.com/bQuery/bQuery>                                                                                                                                                                                                                                                    |
| Homepage    | <https://bQuery.flausch-code.de>                                                                                                                                                                                                                                                      |
| Description | jQuery-style DOM library with reactivity, zero-build worker tasks, async data, HTTP clients, polling / pagination, realtime transports, REST helpers, Web Components, motion, routing, stores, declarative views, and shared runtime config — zero-build capable, security-by-default |

---

## Quick Start for Agents

```bash
bun install           # Install deps (Bun required)
bun test              # Run all tests
bun run build         # Build ESM + UMD + types → dist/
bun run lint          # ESLint with auto-fix
bun run lint:types    # TypeScript type check only
bun run check:ai-guidance # Verify AI guidance + release metadata sync
bun run storybook     # Storybook dev server
bun run dev           # VitePress docs server
```

## Workspace Prompt Pack

Project-specific starter prompts live in [`.github/prompts/`](.github/prompts/) for common workflows such as starting a task, fixing a bug, extending a public API, adding a module, working on SSR/server features, and refreshing AI guidance.

## Version 1.11.0 Highlights

- `@bquery/bquery/server` is now a first-class public entry point for dependency-free backend routing, SSR-aware `render()` responses, repeated-query parsing, and runtime-agnostic WebSocket session handling through `createServer()`.
- `@bquery/bquery/ssr` now spans runtime-agnostic sync/async/streaming rendering with `renderToStringAsync()`, `renderToStream()`, `renderToResponse()`, DOM-free fallback rendering, `createSSRContext()`, head/asset managers, runtime adapters, route loaders, store snapshots, mismatch checks, and resumability hooks.
- The `1.10.0` concurrency helpers and the `1.9.0` watcher/view/media additions remain first-class public APIs; keep them visible in docs and AI guidance instead of treating them as historical footnotes.
- Local validation and publish checks target Node.js `>=24.0.0` and Bun `>=1.3.13`; whenever release metadata or AI guidance changes, `bun run check:ai-guidance` should pass before you stop.

---

## Architecture Overview

```bash
src/
├── index.ts            # Default entry — re-exports all modules
├── full.ts             # Full bundle with explicit named exports (CDN)
├── core/               # $, $$, BQueryElement, BQueryCollection, utils
├── reactive/           # signal, computed, effect, scopes, watch/watchDebounce/watchThrottle, async data/fetch, HTTP, polling, pagination, realtime, REST
├── concurrency/        # runTask(), workers/pools, RPC helpers, reactive wrappers, collection helpers, support/lifecycle helpers
├── component/          # component(), defineComponent(), scoped reactivity, defaults
├── storybook/          # storyHtml(), when() helpers for Storybook stories
├── motion/             # animate, transition, flip, morph, spring, timeline, scroll
├── security/           # sanitizeHtml, escapeHtml, Trusted Types, CSP
├── platform/           # storage, cache, cookies, announcers, page meta, config
├── router/             # createRouter, navigate, guards, currentRoute, bq-link
├── store/              # createStore, defineStore, plugins, persistence
├── view/               # mount(), bq-* directives incl. bq-error/bq-aria, declarative DOM bindings
├── forms/              # createForm(), validators, field state
├── i18n/               # createI18n(), formatting, lazy locale loading
├── a11y/               # focus traps, announcements, audits, media prefs
├── dnd/                # draggable, droppable, sortable
├── media/              # viewport, network, battery, clipboard, sensors, observers
├── plugin/             # plugin registry for directives/components
├── devtools/           # runtime inspection and timeline helpers
├── testing/            # renderComponent(), mockSignal(), waitFor()
├── ssr/                # Runtime-agnostic rendering, streaming, hydration, adapters, snapshots
└── server/             # Backend helpers, SSR-aware responses, and WebSocket sessions

scripts/                # Repo maintenance helpers (including AI guidance sync checks)
tests/                  # Bun test suites (one file per module)
.storybook/             # Storybook config
stories/                # Component stories
docs/                   # VitePress documentation site
```

Each `src/<module>/index.ts` re-exports the module's public API.

When version metadata or public exports change, refresh the AI-facing files as a synced set instead of updating only the file you happen to have open.

---

## Module Reference

### Core (`@bquery/bquery/core`)

| Export                                                                            | Kind      | Description                                                                                                                  |
| --------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `$`                                                                               | function  | Select one element → `BQueryElement` (throws if missing)                                                                     |
| `$$`                                                                              | function  | Select multiple → `BQueryCollection` (never throws)                                                                          |
| `BQueryElement`                                                                   | class     | Chainable wrapper for a single DOM element                                                                                   |
| `BQueryCollection`                                                                | class     | Chainable wrapper for multiple DOM elements                                                                                  |
| `utils`                                                                           | namespace | Legacy namespace; prefer named utility imports                                                                               |
| `debounce`, `throttle`, `once`, `noop`                                            | functions | Function utilities                                                                                                           |
| `chunk`, `compact`, `flatten`, `unique`, `ensureArray`                            | functions | Array utilities                                                                                                              |
| `clamp`, `inRange`, `randomInt`, `toNumber`                                       | functions | Number utilities                                                                                                             |
| `capitalize`, `slugify`, `toCamelCase`, `toKebabCase`, `truncate`, `escapeRegExp` | functions | String utilities                                                                                                             |
| `clone`, `merge`, `pick`, `omit`, `hasOwn`, `isPlainObject`                       | functions | Object utilities                                                                                                             |
| `isEmpty`, `parseJson`, `sleep`, `uid`                                            | functions | General utilities                                                                                                            |
| `is*` guards                                                                      | functions | `isArray`, `isString`, `isNumber`, `isBoolean`, `isFunction`, `isObject`, `isDate`, `isPromise`, `isElement`, `isCollection` |

### Reactive (`@bquery/bquery/reactive`)

| Export                                   | Kind      | Description                                                         |
| ---------------------------------------- | --------- | ------------------------------------------------------------------- |
| `signal(init)`                           | function  | Create a reactive signal                                            |
| `computed(fn)`                           | function  | Derived value that auto-tracks dependencies                         |
| `effect(fn)`                             | function  | Side-effect that re-runs on dependency change                       |
| `batch(fn)`                              | function  | Group multiple signal writes, notify once                           |
| `watch(src, cb)`                         | function  | Watch a signal with old/new values + cleanup                        |
| `watchDebounce(src, cb, ms)`             | function  | Watch with debounced callback delivery for bursty updates           |
| `watchThrottle(src, cb, ms)`             | function  | Watch with throttled callback delivery for high-frequency updates   |
| `untrack(fn)`                            | function  | Read signals without tracking                                       |
| `linkedSignal(get, set)`                 | function  | Writable computed (bidirectional)                                   |
| `persistedSignal(key, init)`             | function  | Signal persisted to localStorage                                    |
| `useAsyncData(handler)`                  | function  | Reactive async lifecycle wrapper with `status`, `error`, etc.       |
| `useFetch(input, options)`               | function  | Fetch composable with query/header/body/timeout/retry/abort         |
| `createUseFetch(defaults)`               | function  | Factory for preconfigured fetch composables                         |
| `createHttp(defaults)`                   | function  | Imperative HTTP client with interceptors and method shortcuts       |
| `http`                                   | instance  | Default HTTP client using global bQuery config                      |
| `HttpError`                              | class     | Error subclass with code, config, response metadata                 |
| `usePolling(input, options)`             | function  | Periodic data fetching with pause/resume/visibility                 |
| `usePaginatedFetch(fn, opt)`             | function  | Page-based pagination with next/prev/goTo numeric page helpers      |
| `useInfiniteFetch(fn, opt)`              | function  | Infinite scroll with accumulated pages and fetchNextPage            |
| `useWebSocket(url, opt)`                 | function  | Reactive WebSocket with auto-reconnect, heartbeat, latency, history |
| `useWebSocketChannel(url, wsOpt, chOpt)` | function  | Topic-based channel multiplexer over a single WebSocket             |
| `useEventSource(url, opt)`               | function  | Reactive SSE composable with auto-reconnect                         |
| `useResource(url, opt)`                  | function  | REST CRUD composable with optimistic updates                        |
| `useResourceList(url, opt)`              | function  | Reactive list CRUD with optimistic add/remove/update                |
| `useSubmit(url, opt)`                    | function  | Form submission composable with reactive state                      |
| `createRestClient(url, cfg)`             | function  | Typed imperative REST client (list/get/create/update/patch/remove)  |
| `createRequestQueue(opt)`                | function  | Request queue with configurable concurrency limit                   |
| `deduplicateRequest(key, fn)`            | function  | Coalesce identical in-flight requests                               |
| `readonly(sig)`                          | function  | Read-only wrapper around a signal                                   |
| `isSignal`, `isComputed`                 | functions | Type guards                                                         |
| `Signal`, `Computed`                     | classes   | Signal and Computed value classes                                   |

### Concurrency (`@bquery/bquery/concurrency`)

| Export                                                 | Kind      | Description                                                            |
| ------------------------------------------------------ | --------- | ---------------------------------------------------------------------- |
| `runTask(handler, input, options?)`                    | function  | Execute one task in a fresh zero-build Web Worker                      |
| `createTaskWorker(handler, options?)`                  | function  | Create a reusable single-task worker with explicit lifecycle           |
| `createTaskPool(handler, options?)`                    | function  | Create a bounded reusable task-worker pool with FIFO queueing          |
| `createRpcWorker(handlers, options?)`                  | function  | Create a reusable named-method worker for explicit RPC-style calls     |
| `callWorkerMethod(handlers, method, input, options?)`  | function  | Execute one named worker method in a fresh worker                      |
| `createRpcPool(handlers, options?)`                    | function  | Create a bounded reusable RPC-worker pool with FIFO queueing           |
| `createReactiveTaskWorker(handler, options?)`          | function  | Wrap a reusable task worker with readonly `state$` / `busy$` signals   |
| `createReactiveRpcWorker(handlers, options?)`          | function  | Wrap a reusable RPC worker with readonly `state$` / `busy$` signals    |
| `createReactiveTaskPool(handler, options?)`            | function  | Wrap a reusable task pool with readonly state, queue, and load signals |
| `createReactiveRpcPool(handlers, options?)`            | function  | Wrap a reusable RPC pool with readonly state, queue, and load signals  |
| `parallel(tasks, options?)`                            | function  | Execute an explicit list of standalone tasks across a worker pool      |
| `batchTasks(tasks, batchSize?, options?)`              | function  | Execute task lists in sequential batches using parallel workers        |
| `map(values, mapper, options?)`                        | function  | Map arrays in parallel with optional chunking via worker pools         |
| `filter(values, predicate, options?)`                  | function  | Filter arrays in parallel while preserving the original order          |
| `some(values, predicate, options?)`                    | function  | Evaluate whether any array item matches in worker chunks               |
| `every(values, predicate, options?)`                   | function  | Evaluate whether all array items match in worker chunks                |
| `find(values, predicate, options?)`                    | function  | Find the first matching array item after worker-side predicate runs    |
| `reduce(values, reducer, initialValue, options?)`      | function  | Reduce arrays off the main thread with standard accumulator order      |
| `pipeline(values, options?)`                           | function  | Create an optional immutable fluent pipeline over collection helpers   |
| `getConcurrencySupport()` / `isConcurrencySupported()` | functions | Detect whether inline browser worker tasks are available               |
| `TaskWorkerError`                                      | class     | Base error with stable `code` values for concurrency failures          |
| `TaskWorkerAbortError`                                 | class     | Error thrown when a task run is aborted                                |
| `TaskWorkerTimeoutError`                               | class     | Error thrown when a task exceeds its timeout                           |
| `TaskWorkerSerializationError`                         | class     | Error thrown when a handler or payload cannot be serialized safely     |
| `TaskWorkerUnsupportedError`                           | class     | Error thrown when required worker primitives are unavailable           |

### Component (`@bquery/bquery/component`)

| Export                        | Kind     | Description                                          |
| ----------------------------- | -------- | ---------------------------------------------------- |
| `component(tag, def)`         | function | Define + auto-register a Web Component               |
| `defineComponent(tag, def)`   | function | Define a component class (manual registration)       |
| `registerDefaultComponents()` | function | Register the default button/card/input UI primitives |
| `bool(name, enabled)`         | function | Boolean-attribute helper for `html` / `safeHtml`     |
| `html`                        | tag fn   | Tagged template for component markup                 |
| `safeHtml`                    | function | Sanitized HTML string helper                         |
| `useSignal(init)`             | function | Component-scoped signal that auto-disposes           |
| `useComputed(fn)`             | function | Component-scoped computed value                      |
| `useEffect(fn)`               | function | Component-scoped effect with auto-cleanup            |

### Storybook (`@bquery/bquery/storybook`)

| Export               | Kind     | Description                                                      |
| -------------------- | -------- | ---------------------------------------------------------------- |
| `storyHtml`          | tag fn   | Sanitized story template helper with boolean attribute shorthand |
| `when(condition, …)` | function | Conditionally render story fragments or callbacks                |

### Motion (`@bquery/bquery/motion`)

| Export                               | Kind      | Description                                  |
| ------------------------------------ | --------- | -------------------------------------------- |
| `animate(el, opts)`                  | function  | Web Animations API wrapper                   |
| `transition(fn \| options)`          | function  | View Transitions API with fallback + options |
| `flip` / `flipElements` / `flipList` | functions | FLIP animation helpers                       |
| `morphElement(from, to, opts)`       | function  | FLIP-style morph animation between elements  |
| `parallax(el, opts)`                 | function  | Scroll-linked parallax helper                |
| `typewriter(el, text, opts)`         | function  | Character-by-character text animation        |
| `spring(init, config)`               | function  | Spring physics animation                     |
| `timeline(steps)`                    | function  | Sequenced animation timeline                 |
| `sequence(steps)`                    | function  | Run animations in order                      |
| `stagger(fn, opts)`                  | function  | Staggered timing for collections             |
| `scrollAnimate(el, opts)`            | function  | Intersection Observer + animation            |
| `keyframePresets`                    | object    | Pre-built keyframe sets (pop, fadeIn, etc.)  |
| `easingPresets`                      | object    | Named easing functions                       |
| `prefersReducedMotion()`             | function  | Check user's motion preference               |
| `setReducedMotion(value)`            | function  | Override reduced-motion behavior globally    |

### Security (`@bquery/bquery/security`)

| Export                            | Kind     | Description                                       |
| --------------------------------- | -------- | ------------------------------------------------- |
| `sanitizeHtml(html)` / `sanitize` | function | Strip dangerous HTML (script, iframe, svg, etc.)  |
| `trusted(html)`                   | function | Mark sanitized HTML for verbatim `safeHtml` reuse |
| `escapeHtml(str)`                 | function | Escape `<>&"'` for text display                   |
| `stripTags(html)`                 | function | Remove all HTML tags                              |
| `generateNonce()`                 | function | Generate a random nonce for CSP                   |
| `hasCSPDirective(name)`           | function | Check if a CSP directive is set                   |
| `createTrustedHtml(html)`         | function | Create Trusted Types HTML                         |
| `getTrustedTypesPolicy()`         | function | Access the Trusted Types policy                   |
| `isTrustedTypesSupported()`       | function | Feature detection                                 |

### Platform (`@bquery/bquery/platform`)

| Export                       | Kind     | Description                                               |
| ---------------------------- | -------- | --------------------------------------------------------- |
| `storage`                    | object   | Unified API for localStorage / sessionStorage / IndexedDB |
| `cache`                      | function | TTL-based in-memory and persistent cache                  |
| `notifications`              | object   | Browser Notifications API wrapper                         |
| `buckets`                    | function | Rate limiting / token bucket utility                      |
| `defineBqueryConfig(config)` | function | Set shared runtime defaults across modules                |
| `getBqueryConfig()`          | function | Read the resolved global config snapshot                  |
| `useCookie(name, options)`   | function | Reactive cookie-backed signal                             |
| `definePageMeta(definition)` | function | Manage document title, meta/link tags, and attrs          |
| `useAnnouncer(options)`      | function | Accessible live-region announcer                          |

### Router (`@bquery/bquery/router`)

| Export                  | Kind      | Description                                   |
| ----------------------- | --------- | --------------------------------------------- |
| `createRouter(opts)`    | function  | Create SPA router with routes + guards        |
| `navigate(path, opts?)` | function  | Programmatic navigation                       |
| `back()`, `forward()`   | functions | History navigation                            |
| `currentRoute`          | signal    | Reactive current route state                  |
| `link(path)`            | function  | Generate link attributes                      |
| `interceptLinks(opts?)` | function  | Auto-intercept `<a>` clicks for SPA nav       |
| `useRoute()`            | function  | Focused readonly signals for route properties |
| `registerBqLink()`      | function  | Register declarative `<bq-link>` navigation   |
| `BqLinkElement`         | class     | Custom element for SPA navigation             |
| `isActive(path)`        | function  | Check if path matches current route           |
| `resolve(path)`         | function  | Resolve a route without navigating            |

### Store (`@bquery/bquery/store`)

| Export                                 | Kind      | Description                                     |
| -------------------------------------- | --------- | ----------------------------------------------- |
| `createStore(def)`                     | function  | Create a signal-based store instance            |
| `defineStore(id, def)`                 | function  | Factory-style store (Pinia-like)                |
| `createPersistedStore(def, opts?)`     | function  | Store with storage/serializer/migration support |
| `mapActions`, `mapGetters`, `mapState` | functions | Helper mappers for stores                       |
| `watchStore(store, sel, cb)`           | function  | Watch specific store property                   |
| `registerPlugin(plugin)`               | function  | Register a global store plugin                  |
| `destroyStore(id)`                     | function  | Remove store from registry                      |
| `getStore(id)`, `listStores()`         | functions | Registry access                                 |

### Forms (`@bquery/bquery/forms`)

| Export                    | Kind      | Description                                |
| ------------------------- | --------- | ------------------------------------------ |
| `createForm(config)`      | function  | Create a reactive form with validation     |
| `required`, `email`, ...` | functions | Built-in sync and async validators         |
| `Form`, `FormField`, ...` | types     | Public form state and validation contracts |

### i18n (`@bquery/bquery/i18n`)

| Export                           | Kind      | Description                                 |
| -------------------------------- | --------- | ------------------------------------------- |
| `createI18n(config)`             | function  | Create a reactive i18n instance             |
| `formatDate`, `formatNumber`     | functions | Standalone Intl-based formatting helpers    |
| `I18nInstance`, `Messages`, ...` | types     | Public translation and formatting contracts |

### A11y (`@bquery/bquery/a11y`)

| Export                                  | Kind      | Description                                |
| --------------------------------------- | --------- | ------------------------------------------ |
| `trapFocus`, `releaseFocus`             | functions | Trap and release focus in dialogs/overlays |
| `announceToScreenReader`                | function  | Write to a shared ARIA live region         |
| `rovingTabIndex()`                      | function  | Arrow-key keyboard navigation helper       |
| `skipLink()`                            | function  | Create/manage skip-navigation links        |
| `auditA11y()`                           | function  | Development-time accessibility audit       |
| `prefersColorScheme`, `prefersContrast` | functions | Reactive media-preference signals          |

### DnD (`@bquery/bquery/dnd`)

| Export        | Kind     | Description                                |
| ------------- | -------- | ------------------------------------------ |
| `draggable()` | function | Pointer-based dragging with bounds/handles |
| `droppable()` | function | Drop zones with filtering and callbacks    |
| `sortable()`  | function | Sortable lists with animated reordering    |

### Media (`@bquery/bquery/media`)

| Export                                    | Kind      | Description                                                                                                   |
| ----------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------- |
| `mediaQuery`, `breakpoints`               | functions | Reactive media-query and breakpoint helpers (`breakpoints()` collections use `destroyAll()` for bulk cleanup) |
| `useViewport`, `useNetworkStatus`         | functions | Reactive viewport and network state                                                                           |
| `useBattery`, `useGeolocation`            | functions | Battery and geolocation wrappers                                                                              |
| `useDeviceMotion`, `useDeviceOrientation` | functions | Device sensor wrappers                                                                                        |
| `useIntersectionObserver`                 | function  | Reactive IntersectionObserver wrapper with `observe` / `unobserve` / `destroy`                                |
| `useResizeObserver`                       | function  | Reactive ResizeObserver wrapper with box selection and `observe` / `unobserve` / `destroy`                    |
| `useMutationObserver`                     | function  | Reactive MutationObserver wrapper with `observe` / `takeRecords` / `destroy`                                  |
| `clipboard`                               | object    | Async clipboard read/write helpers                                                                            |

### Plugin (`@bquery/bquery/plugin`)

| Export                               | Kind      | Description                          |
| ------------------------------------ | --------- | ------------------------------------ |
| `use(plugin, options?)`              | function  | Install a global bQuery plugin       |
| `isInstalled`, `getInstalledPlugins` | functions | Inspect plugin registry state        |
| `getCustomDirective(s)`              | functions | Inspect registered custom directives |
| `resetPlugins()`                     | function  | Reset plugin state for tests         |

### Devtools (`@bquery/bquery/devtools`)

| Export                                                 | Kind      | Description                         |
| ------------------------------------------------------ | --------- | ----------------------------------- |
| `enableDevtools`, `isDevtoolsEnabled`                  | functions | Toggle runtime inspection           |
| `inspectSignals`, `inspectStores`, `inspectComponents` | functions | Snapshot runtime state              |
| `recordEvent`, `getTimeline`, `clearTimeline`          | functions | Work with the event timeline        |
| `logSignals`, `logStores`, `logTimeline`               | functions | Console-oriented inspection helpers |

### Testing (`@bquery/bquery/testing`)

| Export              | Kind     | Description                               |
| ------------------- | -------- | ----------------------------------------- |
| `renderComponent()` | function | Mount a custom element for tests          |
| `flushEffects()`    | function | Flush pending reactive effects            |
| `mockSignal()`      | function | Create a controllable signal              |
| `mockRouter()`      | function | Create a lightweight reactive router mock |
| `fireEvent()`       | function | Dispatch synthetic DOM events             |
| `waitFor()`         | function | Poll async conditions until they pass     |

### SSR (`@bquery/bquery/ssr`)

Runtime-agnostic SSR pipeline. Works on Node.js ≥ 24, Deno and Bun ≥ 1.3.13 with no external deps. The DOM-free renderer activates automatically when no `DOMParser` is available; existing public APIs keep their original behaviour.

| Export                                                                                      | Kind      | Description                                                                                    |
| ------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------- |
| `renderToString()`                                                                          | function  | Synchronous render to HTML (DOM- or DOM-free backend)                                          |
| `renderToStringAsync()`                                                                     | function  | Awaits Promises / `defer()` values in the binding context                                      |
| `renderToStream()`                                                                          | function  | Returns a Web `ReadableStream<Uint8Array>` for the rendered HTML                               |
| `renderToResponse()`                                                                        | function  | Returns a `Response` with content-type, ETag, head/asset/store-state injection                 |
| `hydrateMount()`                                                                            | function  | Hydrate existing server-rendered DOM                                                           |
| `hydrateOnVisible()` / `hydrateOnIdle()` / `hydrateOnInteraction()` / `hydrateOnMedia()`    | functions | Progressive hydration strategies (`HydrationHandle`)                                           |
| `hydrateIsland()`                                                                           | function  | Explicit island hydration (alias for `hydrateMount` with island semantics)                     |
| `serializeStoreState()`                                                                     | function  | Serialize registered store state                                                               |
| `deserializeStoreState()`                                                                   | function  | Read serialized client bootstrap state                                                         |
| `hydrateStore()`, `hydrateStores()`                                                         | functions | Apply SSR state to one or many stores                                                          |
| `createSSRContext()`                                                                        | function  | Build an `SSRContext` (request, url, headers, cookies, locale, signal, nonce, …)               |
| `createHeadManager()` / `createAssetManager()`                                              | functions | Collect head/asset entries and serialise them as HTML                                          |
| `defer(promise, fallback?)` / `defineLoader(fn)`                                            | functions | Async data helpers consumed by `renderToStringAsync()`                                         |
| `configureSSR()` / `getSSRConfig()`                                                         | functions | Switch backend (`'auto'` / `'pure'` / `'dom'`) or inject a custom `DOMParser`                  |
| `detectRuntime()` / `isServerRuntime()` / `isBrowserRuntime()` / `getSSRRuntimeFeatures()`  | functions | Runtime detection helpers                                                                      |
| `createWebHandler()` / `createBunHandler()` / `createDenoHandler()` / `createNodeHandler()` | functions | Runtime adapters; Node supports optional `maxBodyBytes`, and `createSSRHandler()` auto-detects |
| `verifyHydration()` / `HYDRATION_HASH_ATTR`                                                 | function  | Walk `[data-bq-h]` and report mismatches; pair with `RenderOptions.annotateHydration`          |
| `renderToStreamSuspense()`                                                                  | function  | Out-of-order streaming with `defer()` placeholders + CSP-nonce-aware patch scripts             |
| `resolveSSRRoute()` / `runRouteLoaders()` / `createSSRRouterContext()`                      | functions | Match URLs and run `meta.loader` data loaders before render                                    |
| `serializeStoreSnapshot()` / `hydrateStoreSnapshot()` / `readStoreSnapshot()`               | functions | Versioned store snapshots with strict drift detection                                          |
| `createResumableState()` / `resumeState()`                                                  | functions | JSON-safe key/value snapshot the client can read without re-running producers                  |

### Server (`@bquery/bquery/server`)

| Export                                                                   | Kind       | Description                                                                                    |
| ------------------------------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------- |
| `createServer()` / `isWebSocketRequest()` / `isServerWebSocketSession()` | functions  | Create a lightweight backend app and inspect WebSocket upgrade flow                            |
| `ServerApp`                                                              | interface  | App-like handle with `use()`, HTTP method helpers, `ws()`, `handle()`, and `handleWebSocket()` |
| `ServerContext`                                                          | interface  | Request context with params, query, state, response helpers, and `isWebSocketRequest`          |
| `ServerRoute`                                                            | interface  | Route definition with `path`, optional `method`, middleware, handler                           |
| `ServerWebSocketSession` / `ServerWebSocketHandlerSet`                   | interfaces | Runtime-agnostic WebSocket session descriptor and route lifecycle callbacks                    |

### View (`@bquery/bquery/view`)

| Export                   | Kind     | Description                           |
| ------------------------ | -------- | ------------------------------------- |
| `mount(sel, ctx)`        | function | Bind reactive context to DOM subtree  |
| `createTemplate(html)`   | function | Create a reusable template fragment   |
| `clearExpressionCache()` | function | Clear the expression evaluation cache |

**Directives:** `bq-text`, `bq-html`, `bq-if`, `bq-for`, `bq-model`, `bq-class`, `bq-style`, `bq-show`, `bq-bind`, `bq-error`, `bq-aria`, `bq-on:event`

> ⚠ View module uses `new Function()` internally — requires `'unsafe-eval'` in CSP.

---

## Design Principles & Invariants

1. **Security by default** — Every `.html()` call and component render goes through `sanitizeHtml()`. New DOM-writing methods MUST sanitize input.
2. **Chainable APIs** — All mutating methods on `BQueryElement` / `BQueryCollection` return `this`.
3. **Getter/setter overloading** — `.text()`, `.attr()`, `.css()`, `.data()` etc. act as getters without args, setters with args.
4. **Pure ESM** — `"type": "module"`, no CommonJS in source. Dist provides ESM (`.es.mjs`) + UMD.
5. **Tree-shakeable** — `"sideEffects": false`. Each module is a separate entry point.
6. **Strict TypeScript** — `strict: true`, `noUnusedLocals`, `noUnusedParameters`.
7. **No runtime dependencies** — Zero `dependencies` in package.json.
8. **Shared runtime config** — Cross-module defaults flow through `defineBqueryConfig()` instead of ad-hoc globals.

---

## Coding Conventions

### File & Module Structure

- Each module lives in `src/<module>/` with an `index.ts` that re-exports public APIs
- Large modules may have internal submodules (e.g., `security/sanitize-core.ts`) — these are `@internal`
- Keep exports minimal and explicit; avoid barrel re-exports of internals
- Use `@internal` JSDoc tag for non-public helpers

### TypeScript

- Target: ES2020
- Module: ESNext with Bundler resolution
- All public APIs MUST have JSDoc comments with `@example` blocks
- Types go in `types.ts` per module
- Path aliases: `bquery` → `src/index.ts`, `bquery/*` → `src/*`

### Testing

- Framework: **Bun test runner** (`import { describe, expect, it } from 'bun:test'`)
- DOM simulation: `happy-dom` via `tests/setup.ts`
- File naming: `tests/<module>.test.ts`
- Pattern: Create elements inline → test → `.remove()` to clean up
- Do NOT use Node.js test runners — Bun-specific APIs are used

```ts
import { describe, expect, it } from 'bun:test';

it('should add class', () => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  // ... test with BQueryElement wrapper ...
  el.remove();
});
```

### Code Style

- ESLint: flat config with `@typescript-eslint/recommended`
- Prettier: configured for formatting
- Unused variables: prefix with `_` to suppress lint errors
- Run `bun run lint` before committing

---

## Common Tasks for Agents

### Adding a new public method to `BQueryElement`

1. Add method to `src/core/element.ts` with JSDoc + `@example`
2. If it writes HTML → wrap input with `sanitizeHtml()` from `src/security/sanitize.ts`
3. Return `this` for chaining (if mutating)
4. Add test in `tests/core.test.ts`
5. Run `bun test` to verify

### Adding a new reactive primitive

1. Create file in `src/reactive/` (e.g., `myPrimitive.ts`)
2. Export from `src/reactive/index.ts`
3. Add type declarations if needed in `src/reactive/internals.ts`
4. Add test in `tests/signal.test.ts`
5. Run `bun test`

### Adding reactive concurrency wrappers

1. Keep `createTaskWorker()` / `createRpcWorker()` / pool APIs backward compatible
2. Prefer additive wrapper factories (e.g. `createReactiveTaskPool()`) over mutating existing handles
3. Mirror sync getters such as `state`, `busy`, `pending`, and `size` into readonly signals
4. Extend `tests/concurrency.test.ts` using the existing mock worker environment
5. Sync `src/full.ts`, `README.md`, `llms.txt`, and `docs/guide/concurrency.md`

### Updating runtime-config-aware APIs

1. Check `src/platform/config.ts` for existing config surfaces and defaults
2. Wire new defaults through the consuming module instead of duplicating config state
3. Export any new public config types from `src/platform/index.ts` and `src/full.ts`
4. Document the behavior in the relevant guide and in `README.md`
5. Run `bun test`

### Refreshing AI guidance and release metadata

1. Treat `package.json`, `CHANGELOG.md`, and `src/*/index.ts` as the source of truth
2. Update `AGENT.md` first, then `llms.txt`, then `.github/copilot-instructions.md`
3. Re-align `.cursorrules` and `.clinerules` as derived tool-specific views
4. If public runtime exports changed, re-check `src/full.ts` and `README.md`
5. Run `bun run check:ai-guidance`
6. Finish with the smallest relevant Bun validation command for the actual code/docs change

### Adding a new module

1. Create `src/<module>/` directory with `index.ts` + implementation files
2. Add entry point to `vite.config.ts` → `build.lib.entry`
3. Add export map to `package.json` → `"exports"`
4. Add re-export to `src/index.ts` and named exports to `src/full.ts`
5. Create `tests/<module>.test.ts`
6. Run `bun test` and `bun run build`

### Fixing a bug

1. Reproduce with a test in the corresponding `tests/<module>.test.ts`
2. Fix the implementation
3. Run `bun test` to verify fix + no regressions
4. Run `bun run lint` for code quality

---

## Key Files

| File                            | Purpose                                                                                 |
| ------------------------------- | --------------------------------------------------------------------------------------- |
| `src/index.ts`                  | Default entry point — re-exports all modules                                            |
| `src/full.ts`                   | Full bundle with explicit named exports (CDN); keep in sync with public runtime exports |
| `src/ssr/index.ts`              | Canonical SSR surface; use this to verify async/streaming/runtime-adapter exports       |
| `src/server/index.ts`           | Canonical backend helper surface for `@bquery/bquery/server`                            |
| `scripts/check-ai-guidance.mjs` | Lightweight version/engine/guidance drift check for AI-facing repo files                |
| `vite.config.ts`                | Library build config (23 entry points, ESM)                                             |
| `vite.umd.config.ts`            | UMD bundle config for CDN/script tags                                                   |
| `tsconfig.json`                 | TypeScript config (strict, ES2020, Bundler)                                             |
| `tsconfig.test.json`            | Test-specific TypeScript config                                                         |
| `eslint.config.js`              | ESLint flat config                                                                      |
| `.storybook/main.ts`            | Storybook builder/configuration                                                         |
| `tests/setup.ts`                | DOM polyfills for test environment (happy-dom)                                          |
| `tests/http.test.ts`            | HTTP client, retry, polling, and pagination coverage                                    |
| `tests/network.test.ts`         | WebSocket, SSE, REST helpers, queues, and dedupe coverage                               |
| `src/security/sanitize-core.ts` | Core HTML sanitization logic                                                            |
| `package.json`                  | Package config, scripts, export maps                                                    |

---

## Common Pitfalls

| Pitfall                      | Explanation                                                                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `$()` throws                 | Use `$$()` for optional/missing elements                                                                                           |
| Forgetting sanitization      | ALL new DOM-writing methods must call `sanitizeHtml()`                                                                             |
| AI guidance drift            | `package.json` and the public barrels are authoritative; run `bun run check:ai-guidance` after release/engine/API metadata changes |
| Signal `.value` tracks       | Use `.peek()` to read without subscribing in computed/effect                                                                       |
| Disposed async state         | `useAsyncData()` / `useFetch()` return cached data after `dispose()` and should not be re-used for fresh work                      |
| `src/full.ts` drift          | If a public runtime export changes, update `src/full.ts` so the `/full` bundle and CDN entry stay accurate                         |
| Testing with Node            | Use `bun test` only — Bun-specific APIs are used                                                                                   |
| CSP with View module         | `mount()` uses `new Function()` → needs `'unsafe-eval'`                                                                            |
| Double renders in components | `attributeChangedCallback` only re-renders after initial mount                                                                     |
| `linkedSignal` vs `computed` | `computed` is read-only; `linkedSignal` is read-write                                                                              |

---

## Related Files for AI Agents

- [.github/copilot-instructions.md](.github/copilot-instructions.md) — GitHub Copilot context
- [.github/prompts/](.github/prompts/) — Workspace starter prompts for common bQuery workflows
- [llms.txt](llms.txt) — LLM-optimized project summary
- [.cursorrules](.cursorrules) — Cursor-specific derived rules snapshot
- [.clinerules](.clinerules) — Cline-specific derived rules snapshot
- [`scripts/check-ai-guidance.mjs`](scripts/check-ai-guidance.mjs) — Sync guardrail for AI-facing repo files
- [CONTRIBUTING.md](CONTRIBUTING.md) — Contributor guidelines
- [CHANGELOG.md](CHANGELOG.md) — Version history
- [docs/guide/](docs/guide/) — Full documentation (VitePress)
