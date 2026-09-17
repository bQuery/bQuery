# AGENT.md — AI Coding Agent Guide for bQuery.js

> This file helps AI coding agents (Copilot, Cursor, Cline, Aider, etc.)
> understand, navigate, and modify this codebase effectively.

**Maintenance note:** `package.json` and `src/*/index.ts` are the authoritative sources for the current version, engine floor, and public exports. If release metadata or the public runtime surface changes, sync `AGENT.md`, `llms.txt`, `.github/copilot-instructions.md`, `.cursorrules`, `.clinerules`, `README.md`, and run `bun run check:ai-guidance`.

## Identity

| Field       | Value                                                                                                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name        | bQuery.js                                                                                                                                                                                         |
| Package     | `@bquery/bquery`                                                                                                                                                                                  |
| Version     | 1.16.1                                                                                                                                                                                            |
| License     | MIT                                                                                                                                                                                               |
| Language    | TypeScript (strict)                                                                                                                                                                               |
| Runtime     | Browser (ESM, UMD, IIFE), plus Node.js, Bun, and Deno for SSR/server workflows                                                                                                                    |
| Toolchain   | Node.js `>=24.0.0`, Bun `>=1.4.0`                                                                                                                                                                 |
| Repository  | <https://github.com/bQuery/bQuery>                                                                                                                                                                |
| Homepage    | <https://bquery.js.org>                                                                                                                                                                           |
| Tagline     | The full-stack web framework that speaks jQuery.                                                                                                                                                  |
| Description | Batteries-included TypeScript framework for the modern web with signals, SSR, Web Components, routing, server helpers, and a jQuery-inspired API — zero mandatory build step, security-by-default |

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

## Version 1.16.1 Highlights

- Toolchain-and-build maintenance patch. Nothing under `src/` changed: no API changes, no breaking changes, no module status transitions — every 1.16.0 API behaves identically.
- Supported Bun floor moves from `1.3.13` to `1.4.0` (`engines.bun`), mirrored in `mise.toml`, the runtime support matrix, the AI guidance files, and the bug-report template. Node.js stays at `>=24.0.0`. CI installs `bun-version: 'latest'`; the SSR cross-runtime matrix leg `bun-1.3` is now `bun-1.4`.
- Build: `vite.config.ts` and `vite.umd.config.ts` use `import.meta.dirname` instead of `__dirname` (compatible with Vite's `configLoader: 'native'`), and the UMD/IIFE build stubs `node:*` with a throwing module so the unreachable `node:http` import in `createServer().listen()` no longer triggers Vite's browser-externalized warning. Bundle contents unchanged.
- Dev dependencies refreshed: Storybook `10.5.10`, `@typescript-eslint/*` `8.68.0`, `bun-types` `1.4.0`, `eslint` `10.9.1`, `globals` `17.11.0`, `happy-dom` `20.11.6`, `vite` `8.2.2`. Still zero runtime dependencies.

## Version 1.16.0 Highlights

- Quality-and-performance release driven by a full audit of the reactive core, DOM core, and view layer. No breaking changes, no module status transitions; the only new API is the additive `trailing` option on `watchThrottle` (`WatchThrottleOptions`).
- `@bquery/bquery/reactive` — `batch()` coalesces transitive updates (diamond dependencies trigger their effect once per batch); computeds re-validate and notify subscribers only when their value actually changes; hot-path allocation cuts on signal writes and dependency tracking; a throwing `computed` stays dirty and retries instead of serving a stale cache.
- `@bquery/bquery/core` — `undelegate()` works across wrapper instances (module-level delegation registry; `delegate()` is idempotent per handler tuple); `wrap()` no longer clones previously wrapped elements into later wrappers; `replaceWith(string)` sanitizes once per call; `empty()` uses `replaceChildren()`; `children()`/`siblings()`/`index()`/`unwrap()`/`css(object)`/`data()` shed per-element allocations.
- `@bquery/bquery/view` — per-update work moved to bind time (object-expression parsing, transition resolution, memoized directive parsing, sandbox proxies cached per context); unchanged DOM writes are skipped (fixes the `bq-model` caret reset); `bq-for` is dispatched before other directives on the same element; `bq-once`/`bq-memo`/`bq-init` evaluate untracked; `bq-html` children are no longer directive-bound. The `with`-scope evaluator hardening closes a residual member-access escape via `hasDangerousMemberAccess()`, and the compiler rejects legacy leading-zero numeric literals.
- `@bquery/bquery/motion` — `onReducedMotionChange` re-binds to the current `window.matchMedia` on subscribe and flushes preference changes that happened without a `change` event. `@bquery/bquery/store` — `deepClone` special-cases only the dangerous `__proto__` key; properties merely named `constructor`/`prototype` are copied normally again.
- Local validation and publish checks target Node.js `>=24.0.0` and Bun `>=1.4.0`; whenever release metadata or AI guidance changes, `bun run check:ai-guidance` should pass before you stop.

## Version 1.15.1 Highlights

- Security-and-correctness patch closing a full-codebase audit — no breaking changes, no module status transitions. XSS hardening across every HTML sink (mutation-XSS fallback escaped, `bq-text` raw-text escaping in SSR, shared `bq-bind` attribute guard), evaluator code-execution paths closed (client `with`-scope denylist, CSP-safe SSR parser), Trusted Types wired in via the new `trustedHtmlForSink()` (`@bquery/bquery/security`), secure-by-default session/CSRF cookies.
- Additive APIs introduced by the fixes: `effectScope(detached?)` (`@bquery/bquery/reactive`) and a `dispose()` method on `deferred()`'s handle.

## Version 1.15.0 Highlights

- Thirteen modules graduate to **Stable** — `@bquery/bquery/view`, `@bquery/bquery/forms`, `@bquery/bquery/i18n`, `@bquery/bquery/a11y`, `@bquery/bquery/dnd`, `@bquery/bquery/media`, `@bquery/bquery/plugin`, `@bquery/bquery/devtools`, `@bquery/bquery/testing`, `@bquery/bquery/storybook`, `@bquery/bquery/concurrency`, `@bquery/bquery/ssr`, and `@bquery/bquery/server`. Every bQuery module is now Stable (the Beta and Experimental tiers are empty); the canonical record is `STABILITY.md`, enforced by `bun run check:stability`.
- `@bquery/bquery/view` — declarative enter/leave/move transitions (`bq-transition`, `bq-in`, `bq-out`, `bq-transition-duration`, `bq-transition-easing`, `bq-animate="flip"`) plus an optional `@bquery/bquery/view/compiler` (`compileViews`, `compileToModule`, `compileExpression`, `emitModule`, the `bquery-view-compile` CLI, and `registerCompiledExpressions`/`clearCompiledExpressions` runtime hooks) that precompiles `bq-*` expressions into `with`-free functions, so the runtime can skip the `new Function()` evaluator and run under a strict CSP without `'unsafe-eval'`. Un-compilable expressions fall back to the runtime evaluator.
- `@bquery/bquery/forms` — progressive-enhancement actions (`formAction`, `useFormStatus`, `enhance`, `FormActionError`) and an `optimistic(base, reducer)` update primitive; `createFieldArray()` gains `getKey` plus `keys()`/`keyAt(index)`. Composes with the `server` module's `csrf()`.
- `@bquery/bquery/i18n` — ICU MessageFormat (`plural`, `selectordinal`, `select`, nested arguments, `offset:`, `=N`, `#`) via `Intl.PluralRules`; new `defineMessages`/`formatMessage`; and an optional, dependency-free `@bquery/bquery/i18n/extract` toolkit + `bquery-i18n` CLI that scans source and merges catalogs without overwriting translations.
- `@bquery/bquery/router` + `@bquery/bquery/server` — an opt-in, bundler-agnostic file-route convention with typed `load`/`action`: `createFileRoutes`, `parseFilePath`, `filePathToRoutePattern`, `sortEntriesBySpecificity`, `createRouteData`/`useRouteData`, plus `mountFileRoutes`/`createFileRouteServerRoutes`. `routes/users/[id]/+page.ts` → `/users/:id`, `[...rest]` → `*`, `(group)` dropped. Programmatic routing is unchanged; no bundler is shipped.
- `@bquery/bquery/server` — first-party `session`/`memoryStore`, `csrf`/`csrfToken`, `guard`, `basicAuth`/`bearerAuth`, and the Web-Crypto signing utilities they build on (`signValue`, `unsignValue`, `timingSafeEqual`, `randomToken`, `randomId`); `app.listen()` supports Node, Bun, and Deno.
- `@bquery/bquery/ssr` — production hydration (`hydrate`, `detectHydrationMismatches`), interactive directive parity (`directives: 'full'`, `onUnsupportedDirective`), and resumable boundaries (`createResumableBoundary`, `createResumableGraph`, `resume`). `renderToStringAsync()` and the rest of the SSR surface are unchanged.
- `@bquery/bquery/devtools` — a stable, versioned bridge protocol (`connectDevtoolsBridge`, `createBridgeServer`, `serializeComponentTree`, `BRIDGE_PROTOCOL_VERSION`/`BRIDGE_SOURCE`/`BRIDGE_CAPABILITIES`) and a Manifest V3 browser extension (component tree, signal/store inspection, timeline) released separately from <https://github.com/bQuery/devtools-extension>. `@bquery/bquery/a11y` stamps each `AuditFinding` with a `wcag` criterion and exports the `auditRules` catalog; `@bquery/bquery/plugin` adds the `definePlugin()` authoring helper.
- All graduations are additive — there are no breaking changes. Local validation and publish checks target Node.js `>=24.0.0` and Bun `>=1.4.0`; whenever release metadata or AI guidance changes, `bun run check:ai-guidance` should pass before you stop.

## Version 1.14.2 Highlights

- Dev-dependency maintenance release — no public API changes. Toolchain packages (TypeScript-ESLint, ESLint, Vite, globals) and the Bun runtime were updated to their latest versions; Dependabot was added for automated future dependency updates.

## Version 1.14.1 Highlights

- `@bquery/bquery/motion` now refreshes its cached reduced-motion `MediaQueryList` when `window.matchMedia` changes, so `prefersReducedMotion()` and `reducedMotionSignal()` stop returning stale values in tests and other runtimes that swap the media-query implementation.

## Version 1.14.0 Highlights

- `@bquery/bquery/media` graduates into a batteries-included tier with 25+ new reactive composables: preference signals (`usePreferredColorScheme`, `usePreferredContrast`, `usePreferredReducedTransparency`, `usePreferredLanguage`, `usePreferredLanguages`); page state (`useOnlineStatus`, `usePageVisibility`, `useDocumentFocus`, `useWindowFocus`, `useIdle`); element observers (`useElementSize`, `useElementBounding`, `useElementVisibility`, `useHover`, `useFocus`, `useFocusWithin`, `useActiveElement`); pointer/scroll (`usePointer`, `useScroll`); platform integrations (`usePermission`, `useWakeLock`, `useShare`, `useShareSupported`, `useBroadcastChannel`, `useEventListener`, `useMediaDevices`, `useStorage`); plus clipboard upgrades (`isSupported`, `isImageSupported`, `readImage`, `writeImage`, `clipboardText`). Every composable accepts an optional `{ signal: AbortSignal }` for auto-teardown.
- `@bquery/bquery/plugin` ships a richer `PluginInstallContext` with hooks and DI: `addFilter`/`applyFilters`/`removeFilter`/`listFilters`, `addAction`/`doAction`/`removeAction`/`listActions`, container-level `createInjectionKey`/`provide`/`inject`/`hasProvided`/`resetDi`, plugin-scoped `ctx.onCleanup` for teardown; new `unuse(name)` and `uninstall(name)` detach plugin-owned directives, hooks, and DI bindings; `install()` may now return `void | Promise<void>` with concurrent installs serialised; plugin metadata (`version`, `description`, `dependencies`, `dependencyMode: 'error' | 'warn'`); `getPluginInfo(name)` and `getInstalledPlugins({ withMetadata: true })`; directive lifecycle objects `{ mounted, unmounted }`; namespaced directive names like `tooltip:arrow`.
- `@bquery/bquery/devtools` adds deeper inspection: ring-buffered timeline (`maxTimelineEntries`, default 1000), expanded `TimelineEntry` with optional `payload`/`source`/`duration`, new event types (`signal:create`, `signal:dispose`, `effect:dispose`, `component:mount`, `component:unmount`, `component:render`, `route:guard`, `error:caught`, `measure`, `mark`); `filterTimeline({ types, since, until, search })`, `subscribeTimeline(listener)`; privacy-aware `inspectSignals({ includeValues: false })`; structural `diffSignals`/`diffStores`; `traceSignal`/`untraceSignal`; `inspectEffects`; snapshot import/export (`exportDevtoolsSnapshot`/`importDevtoolsSnapshot`); `installBrowserBridge()` for future browser-extension panels; performance helpers `time(label, fn)`, `measureRender(tagName, fn)`, `getPerformanceSummary()`.
- `@bquery/bquery/testing` graduates into a batteries-included tier: auto-cleanup tracking (`cleanup`, `autoCleanup`); `fireEvent.click`/`.input`/`.change`/`.submit`/`.focus`/`.blur`/`.dblClick`/`.keyDown`/`.keyUp` shortcut methods on the existing `fireEvent`; `userEvent` namespace with `click`, `dblClick`, `hover`, `unhover`, `type`, `clear`, `selectOptions`, `tab`, `paste`; shadow-DOM-aware screen queries via `screen` and `within(el)` with `getByRole`/`getByText`/`getByLabelText`/`getByPlaceholderText`/`getByTestId` plus their `query*` and `find*` variants; reactive harnesses (`mockComputed`, `mockEffect`); async helpers (`tick`, `nextTick`, `flushPromises`, `runScheduled`); module mocks (`mockStore`, `mockI18n`, `mockForm`, `mockFetch`, `mockWebSocket`); snapshot/a11y helpers (`prettyDOM`, `getReactiveSummary`, `expectAccessible`).
- Additive 1.14.0 module expansions for `@bquery/bquery/router` (`NavigationResult` with `pushResult()`/`replaceResult()`, `beforeResolve()`, `resolveRoute()`, dynamic `addRoute`/`removeRoute`/`hasRoute`, `isReady()`, `lastNavigation` signal, `useNavigation()`), `@bquery/bquery/view` (public `parseDirective()` + `ParsedDirective`, new `bq-once`/`bq-init`/`bq-pre`/`bq-cloak`/`bq-html-safe`/`bq-memo` directives, full `bq-on` modifier system), `@bquery/bquery/a11y` (`createLiveRegion()`, `keyboardUserSignal()`, `focusVisible()`, `prefersReducedTransparency()`/`prefersReducedData()`/`forcedColors()`, `inert()`/`scrollLock()`/`autoFocus()`), `@bquery/bquery/i18n` (`negotiateLocale()`, `detectLocale()`, `isRTL()`, `formatRelativeTime`/`formatList`/`formatDisplayName`/`segment`), `@bquery/bquery/dnd` (programmatic handle APIs, `grid`/`delay`/`touchStartThreshold`/`keyboard`/`keyboardStep` options, `'viewport'` bounds, reactive `useDraggable`/`useDroppable`/`useSortable`), `@bquery/bquery/storybook` (`classMap`/`styleMap`/`ifDefined`/`repeat`/`storyText`/`unsafeHtml`/`storySvg`), `@bquery/bquery/concurrency` (`withTransferables`, `createSharedBuffer`, RPC `maxInFlight`, pool priorities, `pause`/`resume`/`onIdle`, rolling reactive metrics), `@bquery/bquery/ssr` (`flushBoundary`, `createSSRCache`, `createSSRMetrics`, `createEdgeHandler`, cache-aware `renderToResponse`, multi-chunk `renderToStream` boundaries), and `@bquery/bquery/server` (`ServerHttpError` helpers, `ctx.body`/`ctx.cookies`/`ctx.setCookie`/`ctx.accepts`/`ctx.stream`/`ctx.sse`/`ctx.renderStream`/`ctx.renderResponse`, `app.listen()`).
- All earlier baselines (`1.13.0` forms / motion / core utils, `1.12.0` store plugin teardown, `1.11.0` runtime-agnostic SSR/server, `1.10.0` concurrency, `1.9.0` watch/view/media APIs) remain first-class public surface.
- Local validation and publish checks target Node.js `>=24.0.0` and Bun `>=1.4.0`; whenever release metadata or AI guidance changes, `bun run check:ai-guidance` should pass before you stop.

## Version 1.13.0 Highlights

- `@bquery/bquery/forms` graduates into a batteries-included tier: new validators (`integer`, `numeric`, `between`, `length`, `oneOf`, `notOneOf`, `arrayOf`, `requiredIf`, `requiredUnless`, `dateAfter`, `dateBefore`, `validDate`, `fileSize`, `fileType`), validator combinators (`compose`, `all`, `not`, `withMessage`), enriched field/form state (`isValidating`, `isFocused`, `dirtySince`, `disabled`, `setValue`/`setError`/`clearError`, `submitCount`, `submitError`, `isPristine`, `touchAll`/`untouchAll`, `resetField`, `resetErrors`, `getDirtyValues`, `subscribe`, `validationStrategy`, `mode: 'all' | 'first'`), dynamic field arrays via `createFieldArray`, fluent `schema()` declaration, two-way DOM bindings (`bindField`, `bindForm`), scope-aware composables (`useForm`, `useField`, `useFieldArray`), and SSR helpers (`serializeFormState`, `readSerializedFormState`, `hydrateForm`).
- `@bquery/bquery/component` gains slot, ref, async, lifecycle, DI, and styling primitives: `useSlot` / `hasSlot` / `slotText`, `useRef`, `useAsync`, `whenIdle`, `provide` / `inject` / `formContextKey`, additive `beforeUnmount` and `errorBoundary` hooks, instance-level `setProp` / `getProp` for non-string props, delegated event helpers (`on`, `onClick`, `onInput`, `onChange`, `onSubmit`, `bindDelegatedEvents`), a `css` tagged template with adoptable stylesheet support, and `keyedList` / `reconcileKeyed` for keyed list rendering.
- `@bquery/bquery/motion` ships a major expansion: full Penner easing family plus `cubicBezier()`, `steps()`, `mix()`, and `chain()` composers; new `tween()` for number, array, or record interpolation with `pause`/`resume`/`reverse`/`seek`/`stop`/`progress`/`finished` controls and `AbortSignal` support, plus Promise-based `animateValue()`; `animate()` gains `signal` and `playbackRate`, and `animateTo()` turns CSS records into keyframes; `spring()` gains `.velocity()` / `.set()` plus `springVector()` and additional presets (`wobbly`, `slow`, `molasses`); timelines support labels, `reverse()`, `playbackRate()`, `repeat()`, `yoyo()`, `onUpdate()`, and `progress()`; new primitives `scrollProgress()`, `inView()`, `magnetic()`, `tilt()`, `shake()`, `pulse()`, and `countUp()`; `stagger()` gains 2D grids, `axis`, and deterministic `random` / `randomSeed`; new `onReducedMotionChange()` and `reducedMotionSignal()` for reactive reduced-motion observation.
- `@bquery/bquery/core` adds a deep utilities expansion in `utils/`: array helpers (`groupBy`, `keyBy`, `partition`, `zip`, `range`, `first`, `last`, `take`, `drop`, `sample`, `shuffle`, `uniqueBy`, `sortBy`, `intersection`, `difference`, `flattenDeep`, `move`, `chunkBy`); function helpers (`memoize`, `compose`, `pipe`, `curry`, `partial`, `retry`, plus richer `debounce`/`throttle` options and `.flush()`); object helpers (`get`, `set`, `has`, `mapValues`, `mapKeys`, `invert`, `deepEqual`/`isEqual`, deep `freeze`, `defaults`, `entriesTyped`, `keysTyped`); string helpers (`toSnakeCase`, `toPascalCase`, `toTitleCase`, `pad`/`padStart`/`padEnd`, `wordCount`, safe `template`, `stripHtml`, crypto-backed `randomString`, `lines`); number helpers (`round`, `roundTo`, `lerp`, `inverseLerp`, `mapRange`, `formatBytes`, `randomFloat`, `sum`, `average`, `median`, `degToRad`, `radToDeg`); misc helpers (`uuid`, `tryCatch`, `times`, `pollUntil`, `nextFrame`, `nextTick`); and additional type guards (`isError`, `isMap`, `isSet`, `isRegExp`, `isSymbol`, `isBigInt`, `isAsyncFunction`, `isIterable`, `isAsyncIterable`, `isNullish`, `isDefined`).
- All earlier baselines (`1.12.0` store plugin teardown, `1.11.0` runtime-agnostic SSR/server, `1.10.0` concurrency, `1.9.0` watch/view/media APIs) remain first-class public surface.
- Local validation and publish checks target Node.js `>=24.0.0` and Bun `>=1.4.0`; whenever release metadata or AI guidance changes, `bun run check:ai-guidance` should pass before you stop.

## Version 1.12.0 Highlights

- `@bquery/bquery/store` now exposes `unregisterPlugin()` and `clearPlugins()` so plugin registries can be torn down for test isolation and runtime reloads without affecting stores that already received extensions.
- `@bquery/bquery/reactive` now promotes `WebSocketSendData` to a public type-only export for custom serializers, raw WebSocket frames, heartbeat messages, and parity with the server-side `ServerWebSocketData` union.
- The `/full` bundle now re-exports the public platform, a11y, and media type-only surfaces, and `bun run check:full-bundle` statically validates runtime + type export drift before release.
- `@bquery/bquery/server` and `@bquery/bquery/ssr` remain first-class public surfaces from the `1.11.0` runtime-agnostic baseline, including `createServer()`, `renderToStringAsync()`, `renderToStream()`, and `renderToResponse()`.
- Local validation and publish checks target Node.js `>=24.0.0` and Bun `>=1.4.0`; whenever release metadata or AI guidance changes, `bun run check:ai-guidance` should pass before you stop.

---

## Positioning

**The full-stack web framework that speaks jQuery.**

bQuery.js does not compete with jQuery on simplicity — it competes with full-stack frameworks on developer experience, bringing the ergonomics of jQuery's API surface to a modern, reactive, SSR-capable architecture.

## Module Maturity

- **Stable**: Core, Reactive, Security, Component, Motion, Platform, Router, Store
- **Stable (graduated in 1.15.0)**: View, Forms, i18n, A11y, DnD, Media, Plugin, Devtools, Testing, Storybook, Concurrency, SSR, Server
- **Beta / Experimental**: none — every module is Stable as of 1.15.0

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
| `WebSocketSendData`                      | type      | Public raw WebSocket payload union for native sends                 |

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
| `unregisterPlugin`, `clearPlugins`     | functions | Remove one plugin registration or clear all     |
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

Runtime-agnostic SSR pipeline. Works on Node.js ≥ 24, Deno and Bun ≥ 1.4.0 with no external deps. The DOM-free renderer activates automatically when no `DOMParser` is available; existing public APIs keep their original behaviour.

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

See the earlier Positioning section for the project's jQuery/framework comparison.

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
