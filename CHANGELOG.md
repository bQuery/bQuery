# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to Semantic Versioning.

## Releases

- [Changelog](#changelog)
  - [Releases](#releases)
  - [\[Unreleased\]](#unreleased)
  - [\[1.16.1\] - 2026-08-26](#1161---2026-08-26)
    - [Changed (1.16.1)](#changed-1161)
    - [Fixed (1.16.1)](#fixed-1161)
  - [\[1.16.0\] - 2026-08-11](#1160---2026-08-11)
    - [Added (1.16.0)](#added-1160)
    - [Changed (1.16.0)](#changed-1160)
    - [Fixed (1.16.0)](#fixed-1160)
    - [Security (1.16.0)](#security-1160)
  - [\[1.15.1\] - 2026-07-06](#1151---2026-07-06)
    - [Security (1.15.1)](#security-1151)
    - [Fixed (1.15.1)](#fixed-1151)
  - [\[1.15.0\] - 2026-06-30](#1150---2026-06-30)
    - [Added (1.15.0)](#added-1150)
    - [Changed (1.15.0)](#changed-1150)
    - [Fixed (1.15.0)](#fixed-1150)
    - [Module status (1.15.0)](#module-status-1150)
      - [Breaking changes](#breaking-changes)
  - [\[1.14.2\] - 2026-06-26](#1142---2026-06-26)
    - [Fixed (1.14.2)](#fixed-1142)
  - [\[1.14.1\] - 2026-05-28](#1141---2026-05-28)
    - [Fixed (1.14.1)](#fixed-1141)
  - [\[1.14.0\] - 2026-05-26](#1140---2026-05-26)
    - [Added (1.14.0)](#added-1140)
    - [Changed (1.14.0)](#changed-1140)
    - [Fixed (1.14.0)](#fixed-1140)
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

_Nothing yet._

## [1.16.1] - 2026-08-26

A toolchain-and-build maintenance patch. Nothing under `src/` changed, so every 1.16.0 API behaves identically and upgrading is a drop-in. The supported Bun floor moves to `1.4.0`, the dev-dependency set is refreshed, and both Vite configs now build warning-free.

### Changed (1.16.1)

- **Toolchain**: The supported Bun floor moves from `1.3.13` to `1.4.0` (`engines.bun`), mirrored in `mise.toml`, the AI guidance files (`AGENT.md`, `llms.txt`, `.github/copilot-instructions.md`, `.cursorrules`, `.clinerules`), the runtime support matrix, and the bug-report template. CI workflows install `bun-version: 'latest'` instead of pinning a patch release, and the SSR cross-runtime matrix leg `bun-1.3` becomes `bun-1.4`. Node.js stays at `>=24.0.0`.
- **Build**: `vite.config.ts` and `vite.umd.config.ts` resolve the repository root from `import.meta.dirname` instead of `__dirname`, making both configs compatible with Vite's `configLoader: 'native'` (planned to become the default in a future major) and silencing the loader warning it emitted on every build.
- **Dev dependencies**: Bumped `@storybook/addon-docs`, `@storybook/web-components-vite`, and `storybook` from `10.5.7` to `10.5.10`, `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser` from `8.67.0` to `8.68.0`, `bun-types` from `1.3.14` to `1.4.0`, `eslint` from `10.8.1` to `10.9.1`, `globals` from `17.9.0` to `17.11.0`, `happy-dom` from `20.11.2` to `20.11.6`, and `vite` from `8.2.1` to `8.2.2`.

### Fixed (1.16.1)

- **Build**: The UMD/IIFE build no longer logs `Module "node:http" has been externalized for browser compatibility`. `createServer().listen()` dynamically imports `node:http` on its Node branch, which is unreachable in a browser bundle, but Vite's resolver substituted its own stub and warned on every build (`rollupOptions.external` does not apply — `node:*` is handled earlier by Vite's client-environment resolver). A build-only plugin in `vite.umd.config.ts` now maps `node:*` to a stub module that throws a message naming the missing built-in, so the dynamic import rejects with actionable text instead of failing later as a cryptic "not a function". Bundle contents are otherwise unchanged.

## [1.16.0] - 2026-08-11

A quality-and-performance pass over the three hot paths of the framework — the reactive core, the DOM core, and the view layer — driven by a full audit of each. Signal writes, computed propagation, list reconciliation, and directive updates all got measurably cheaper, and the audit surfaced (and this release fixes) several real correctness bugs. The release also folds in the previously staged follow-up to the 1.15.1 security review (a residual evaluator-hardening gap, the `deepClone` prototype-pollution guard, and a compiler numeric-literal fix). No breaking changes; one small additive API (`watchThrottle`'s `trailing` option).

### Added (1.16.0)

- **`@bquery/bquery/reactive`** — `watchThrottle` accepts a new `trailing` option (`WatchThrottleOptions`). When `true`, the last value of a burst is delivered once the interval elapses, so consumers never end up on a stale intermediate value. Defaults to `false`, preserving the leading-edge-only behavior of earlier releases.

### Changed (1.16.0)

- **`@bquery/bquery/reactive`** — batching now spans the whole propagation: `batch()` keeps the batch open while flushing, so signal writes performed by observers keep coalescing into the same flush instead of dispatching synchronously one by one. Flushes drain re-queued observers in follow-up passes (bounded at 100 passes, mirroring the existing cyclic-effect guard) — diamond dependencies inside a batch now trigger their effect once instead of once per branch.
- **`@bquery/bquery/reactive`** — `Computed` re-validates before waking subscribers: when a dependency changes but the recomputed value is `Object.is`-equal to the last observed one, downstream effects are not notified at all. In the micro-benchmark, a `computed(() => count.value > 5)` under 20k writes went from 20k effect runs to 2.
- **`@bquery/bquery/reactive`** — hot-path allocation cuts: signal writes with zero or one subscriber no longer allocate a snapshot array (~6× faster with no subscribers), repeat reads of the same source inside one observer skip the dependency bookkeeping (~1.6× faster), computed chains propagate ~1.7× faster, and `effect()` no longer allocates an inspection `Symbol` when effect inspection is disabled.
- **`@bquery/bquery/core`** — collection/element cheapening: `replaceWith(string)` sanitizes and parses the HTML once and clones per element (matching `insertAll`); `css(object)` hoists `Object.entries` out of the per-element loop; `children()`/`siblings()` iterate live `HTMLCollection`s without `Array.from` copies and `siblings()` visits each unique parent once; `index()` counts `previousElementSibling` instead of materializing the sibling list; `empty()` uses `replaceChildren()` (no HTML parser, no Trusted Types sink); `unwrap()` collapses to a single `replaceWith(...childNodes)` mutation; form serialization resolves each control's kind with one `tagName.toLowerCase()` instead of three; `data()`'s camel→kebab regex is compiled once at module level. The per-instance delegation maps are gone entirely (see the `undelegate` fix below).
- **`@bquery/bquery/view`** — per-update work moved to bind time: `bq-class`/`bq-style`/`bq-aria` parse their static object expression once (memoized) instead of on every reactive tick, and pre-normalize property names; `bq-if` resolves its transition config only on an actual visibility flip instead of on every effect run; `bq-text`/`bq-bind`/`bq-model` skip the DOM write when the value is unchanged; `bq-html` skips sanitize+parse when the HTML string is unchanged. `processElement` reuses one set of per-prefix attribute-name strings instead of rebuilding them per element, `parseDirective` results are memoized (bounded like the expression caches), `bq-for`'s key extraction reuses one context object per reconcile instead of spreading the context per item, and expression evaluation caches its sandbox proxies per context object instead of allocating one per evaluation.
- **Tooling / Dev dependencies**: Bumped `@storybook/addon-docs` and `@storybook/web-components-vite` from `10.4.6` to `10.5.7`, `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser` from `8.63.0` to `8.67.0`, `eslint` from `10.6.0` to `10.8.1`, `globals` from `17.7.0` to `17.9.0`, `happy-dom` from `20.10.6` to `20.11.2`, `prettier` from `3.9.4` to `3.9.6`, `storybook` from `10.4.6` to `10.5.7`, and `vite` from `8.1.3` to `8.2.1`.

### Fixed (1.16.0)

- **`@bquery/bquery/core`** — `undelegate()` called on a fresh wrapper (e.g. `$$('.container').undelegate(...)` after delegating via an earlier `$$()` call — the documented usage) was a silent no-op because the handler registry lived on the wrapper instance, permanently leaking the delegated listener. The registry is now module-level and keyed by element, `delegate()` attaches a single listener per (element, event, selector, handler) and counts its registrations so one owner's `undelegate()` cannot detach a delegation another owner still holds, and the delegated dispatcher no longer throws when `event.target` is not an `Element` (e.g. a `Text` node).
- **`@bquery/bquery/core`** — `wrap(element)` over a multi-element collection cloned the wrapper _after_ the first element had been moved into it, so later wrappers contained copies of previously wrapped elements. The pristine wrapper is snapshotted before the loop.
- **`@bquery/bquery/view`** — directives declared before `bq-for` on the same element (`<li bq-text="item.name" bq-for="item in items">`) were bound against the discarded template element and the outer context, leaking a live effect that errored on every update. `bq-for` is now dispatched first regardless of attribute order.
- **`@bquery/bquery/view`** — `bq-once`/`bq-memo`/`bq-init` evaluated their expression while the enclosing `bq-for` reconciler was the active observer, silently subscribing the whole list to signals the "non-reactive" directives read. Their evaluation is now untracked, matching their documented contract.
- **`@bquery/bquery/view`** — `bq-model` re-wrote `input.value` on the effect tick triggered by the input's own `input` event, resetting the caret position while typing. The write is now skipped when the input already holds the value.
- **`@bquery/bquery/view`** — children of `bq-html`/`bq-html-safe` content were processed for directives at mount and their effects kept running (and writing) after the first re-render replaced the markup. Child processing is skipped for author-opaque HTML content.
- **`@bquery/bquery/motion`** — `onReducedMotionChange` now re-binds to the current `window.matchMedia` when subscribing (a replaced `matchMedia` — e.g. in tests or embedded contexts — previously left the subscription attached to the stale source) and flushes preference changes that happened without a `change` event, so existing listeners and the new subscriber's baseline stay accurate. This also fixes two order-dependent test failures in the motion suite.
- **`@bquery/bquery/reactive`** — nested `batch()` calls could execute observers twice per flush (the flush loop iterated a stale snapshot); a `computed` whose compute function threw was left marked clean and served its stale cached value on subsequent reads (it now stays dirty and retries); `watchThrottle` cancels a pending trailing delivery on scope disposal, mirroring `watchDebounce`.
- **`@bquery/bquery/store`** — `deepClone` (used by `$patchDeep`) now special-cases only the genuinely dangerous `__proto__` key, defining it as a real own data property so it can no longer trigger the prototype-reassigning setter. Own data properties merely _named_ `constructor` or `prototype` are copied normally again instead of being silently dropped, which had discarded legitimate cloned data.
- **`@bquery/bquery/view/compiler`** — `NUMERIC_LITERAL_RE` now rejects legacy leading-zero decimal literals (`007`, `01.5`), which are `SyntaxError`s in the strict-mode ES module the compiler emits, instead of compiling them into invalid output.

### Security (1.16.0)

- **`@bquery/bquery/view`** — closes a residual escape from the `with`-scoped evaluator hardening shipped in 1.15.1 ([#168](https://github.com/bQuery/bQuery/issues/168)): shadowing dangerous _identifiers_ on the `with` scope didn't stop a _member access_ chain off any reachable context value from reaching `Function`, e.g. `items.constructor.constructor('return 2')()`. A new shared guard, `hasDangerousMemberAccess()`, rejects dotted (`.constructor`), optional-chaining (`?.constructor`), and string-literal bracket (`['constructor']`) access to `constructor`, `prototype`, or `__proto__` — applied to both the runtime evaluator (`evaluate`/`evaluateRaw`, which now refuse and log instead of executing) and the ahead-of-time compiler (which bails to the runtime evaluator, itself also guarded). Computed bracket access assembled at runtime (`foo['con' + 'structor']`) remains out of scope, documented as a residual limit of the `with`-scope evaluator's threat model ([#202](https://github.com/bQuery/bQuery/issues/202)).

## [1.15.1] - 2026-07-06

A security-and-correctness patch closing the findings of a full-codebase audit. No breaking changes and no module status transitions — every entry is a fix on the 1.15.0 surface. Three small, backwards-compatible additions are noted inline with the fixes that introduced them (the `trustedHtmlForSink` helper, the `effectScope(detached)` parameter, and a `dispose()` method on `deferred()`'s handle).

### Security (1.15.1)

- **`@bquery/bquery/security`** — the anti-mutation-XSS fallback in `sanitizeHtml` returned raw, un-escaped `textContent` when the serialize→re-parse stability check failed. Because every HTML sink (`$el.html()`, `.append()`/`.before()`/`.after()`, the default-sanitized `bq-html`) assigns that result to `innerHTML`, an entity-encoded payload combined with a foster-parenting construct could smuggle live markup through the defense meant to stop it. The fallback is now HTML-escaped ([#162](https://github.com/bQuery/bQuery/issues/162)).
- **`@bquery/bquery/ssr`** — `bq-text` on raw-text elements (`textarea`, `title`) is now escaped in the default DOM-free renderer. Raw-text children are serialized verbatim, so an untrusted value such as `</textarea><img onerror=…>` could break out of the element (stored XSS) — the escaping now mirrors the existing `bq-model` handling ([#163](https://github.com/bQuery/bQuery/issues/163)).
- **`@bquery/bquery/view` + `@bquery/bquery/ssr`** — `bq-bind` now guards runtime-bound attribute values via a shared `src/security/bind-guard.ts`: inline `on*` handlers are never written, URL attributes (`href`, `src`, `xlink:href`, `formaction`, `action`, `poster`, `background`, `cite`, `data`) and `srcset` reject dangerous protocols, and `srcdoc` is treated as an HTML sink (sanitized). Applied consistently to the client directive and both SSR backends ([#164](https://github.com/bQuery/bQuery/issues/164)).
- **`@bquery/bquery/view`** — the `with`-scoped runtime evaluator no longer resolves inherited members or globals, closing a `constructor.constructor('…')()` (and bare `Function('…')()`) code-execution path. The proxy now shadows a denylist (`constructor`, `__proto__`, `prototype`, `Function`, `eval`, `globalThis`, `window`, `self`, …) for both `evaluate` and `evaluateRaw`; own context properties, arithmetic, and method calls on values are unaffected ([#168](https://github.com/bQuery/bQuery/issues/168)).
- **`@bquery/bquery/ssr`** — the DOM-backed evaluator now routes through the CSP-safe Pratt parser shared with the pure renderer, removing the `new Function()` fallback (`'unsafe-eval'`) and a prototype-lookup gap (`constructor.constructor` reachability). Evaluator behaviour is now unified across both SSR backends ([#167](https://github.com/bQuery/bQuery/issues/167)).
- **`@bquery/bquery/server`** — the session-id cookie and the CSRF secret cookie now default to `Secure`, keeping these bearer credentials off plaintext HTTP. Opt out explicitly with `cookie: { secure: false }` for local HTTP dev ([#169](https://github.com/bQuery/bQuery/issues/169)).
- **`@bquery/bquery/security`** — Trusted Types are now wired into the framework's HTML sinks. The new `trustedHtmlForSink()` helper (also re-exported from `/full`) returns a `TrustedHTML` object when a policy is active — so writes satisfy an enforced `require-trusted-types-for 'script'` CSP instead of throwing — and the sanitized string otherwise. `setHtml`, `Collection.html()`/insert paths, `bq-html`, and `bq-html-safe` route through it ([#171](https://github.com/bQuery/bQuery/issues/171)).
- **`@bquery/bquery/ssr`** — `bq-style` declarations are validated in the pure renderer before concatenation: property names must be valid CSS identifiers and values containing `;`, `{`, `}`, or `<` are dropped, preventing injection of extra declarations/rules (UI-redress, exfiltration) from untrusted style objects ([#176](https://github.com/bQuery/bQuery/issues/176)).
- **`@bquery/bquery/security`** — DOM-clobbering defenses strengthened: the reserved-`id`/`name` denylist is expanded with the many missing high-value targets (`attributes`, `nodeName`, `getElementById`, `defaultView`, `implementation`, DOM-traversal properties, …) and duplicate `id`s within a sanitized fragment are now stripped, mitigating the classic HTMLCollection-clobbering vector. Documented as defense-in-depth ([#179](https://github.com/bQuery/bQuery/issues/179)).
- **`@bquery/bquery/i18n`** — placeholder and message-key resolution now use own-property checks, so a placeholder or key colliding with an `Object.prototype` member (`toString`, `constructor`, …) is left intact rather than substituted with the inherited value ([#174](https://github.com/bQuery/bQuery/issues/174)).
- **`@bquery/bquery/store`** — `deepClone` (used by `$patchDeep`) now skips prototype-pollution keys, so an own enumerable `__proto__` (e.g. from `JSON.parse`) no longer triggers the setter and reassigns the clone's prototype ([#175](https://github.com/bQuery/bQuery/issues/175)).
- **`@bquery/bquery/server`** — file-route loader (JSON) endpoints now default their middleware to the action middleware chain. Protecting mutations with `middlewares: [auth]` no longer accidentally exposes every route's `load()` output as unauthenticated JSON; opt out with an explicit `dataMiddlewares: []` ([#181](https://github.com/bQuery/bQuery/issues/181)).

### Fixed (1.15.1)

- **`@bquery/bquery/store`** — `$subscribe` notifications iterate a snapshot of the subscriber list, so a callback that unsubscribes during notification no longer causes the next subscriber to be silently skipped (mirrors the existing `$onAction` guard) ([#165](https://github.com/bQuery/bQuery/issues/165)).
- **`@bquery/bquery/reactive`** — an effect that writes a signal it also reads no longer recurses synchronously into a stack overflow. Self-triggered re-runs are drained in a bounded loop and a `cyclic effect update detected` warning is logged instead of crashing the page; effects that legitimately settle still converge silently ([#166](https://github.com/bQuery/bQuery/issues/166)).
- **`@bquery/bquery/view/compiler`** — the compiler bails to the runtime evaluator on an unterminated string literal or an invalid numeric literal instead of emitting a syntactically broken module (one bad expression previously took down every precompiled expression in the emitted file) ([#170](https://github.com/bQuery/bQuery/issues/170)).
- **`@bquery/bquery/reactive`** — overlapping `useFetch` / `useAsyncData` executions (e.g. a `watch` refresh racing a manual `refresh()`) now abort the superseded in-flight request instead of leaving it running un-cancellable ([#172](https://github.com/bQuery/bQuery/issues/172)).
- **`@bquery/bquery/reactive` + `@bquery/bquery/concurrency`** — composables that created long-lived reactive primitives now have disposal paths. `deferred()` returns a handle with a `dispose()`; `persistedSignal()` runs its persistence effect in a detached scope tied to the signal's own `dispose()` (so an ambient `scope.stop()` no longer silently stops persistence). Adds an optional `effectScope(detached?)` parameter ([#173](https://github.com/bQuery/bQuery/issues/173)).
- **`@bquery/bquery/ssr`** — `titleTemplate` inserts the page title literally, so special `String.prototype.replace` patterns (`$&`, `$1`, `` $` ``, `$'`) in a title no longer mangle the rendered `<title>` ([#177](https://github.com/bQuery/bQuery/issues/177)).
- **`@bquery/bquery/core`** — `debounce({ leading: true, trailing: true })` no longer double-invokes on a single call; the trailing edge fires only when the function was called more than once during the wait window (lodash semantics) ([#178](https://github.com/bQuery/bQuery/issues/178)).
- **`@bquery/bquery/view`** — `bq-on` decides bare-reference vs. call by evaluating the expression rather than string-scanning for `(`. Handlers resolved through an expression containing an inner paren (e.g. `items.find(fn).handler`) are now invoked instead of silently doing nothing ([#180](https://github.com/bQuery/bQuery/issues/180)).

## [1.15.0] - 2026-06-30

This release graduates the final thirteen modules to **Stable** — `view`, `forms`, `i18n`, `a11y`, `dnd`, `media`, `plugin`, `devtools`, `testing`, `storybook`, `concurrency`, `ssr`, and `server`. With them, **every bQuery module is now Stable** and bound by the no-breaking-changes-between-minor-releases contract (see [STABILITY.md](https://github.com/bQuery/bQuery/blob/main/STABILITY.md)). All graduations are additive — there are no breaking changes this cycle.

### Added (1.15.0)

- **`@bquery/bquery/view`** — declarative enter/leave/move transitions ([#137](https://github.com/bQuery/bQuery/issues/137)). New companion attributes `bq-transition`, `bq-in`, `bq-out`, `bq-transition-duration`, `bq-transition-easing` drive enter/leave animations on `bq-if` / `bq-show`, and `bq-animate="flip"` drives FLIP move animations when `bq-for` items reorder. The layer delegates to the existing `motion` engine (Web Animations + FLIP), skips the initial paint, defers removal until the leave finishes, is race-safe on rapid toggles, and honours `prefers-reduced-motion`.
- **`@bquery/bquery/view/compiler`** — optional, build-tool-agnostic compiler ([#138](https://github.com/bQuery/bQuery/issues/138)). `compileViews()`, `compileToModule()`, `compileExpression()`, `emitModule()`, and the dependency-free CLI (`runCompileCli` / `compileFiles`, `bquery-view-compile`) pre-parse `bq-*` expressions into optimized, `with`-free update functions. New runtime hooks `registerCompiledExpressions()` / `clearCompiledExpressions()` (exported from `@bquery/bquery/view`) let the runtime use the precompiled functions, skipping the `new Function()` evaluator (and its `'unsafe-eval'` requirement). The runtime evaluator stays the default; un-compilable expressions transparently fall back to it, so both paths are behaviourally identical.
- **`@bquery/bquery/forms`** — progressive-enhancement form actions + optimistic updates ([#140](https://github.com/bQuery/bQuery/issues/140)). New `formAction(target, options)` binds a form to a server action that POSTs natively without JS and progressively enhances to a `fetch`-based submit with reactive `pending` / `error` / `result` state when JS is present (`enhance(form)` sets the native `action`/`method` and an optional hidden CSRF field, then intercepts `submit`). `useFormStatus(action)` exposes read-only status signals (mirroring React 19), and `optimistic(base, reducer)` is an optimistic-update primitive whose reactive `value` folds pending drafts over the base and reverts automatically (`add` / `run` / `clear`). Composes with the validation pipeline and the `server` module's `csrf()`. A non-OK response throws `FormActionError` (carrying `status` / `response`).
- **`@bquery/bquery/forms`** — `createFieldArray()` gains an optional `getKey` for keyed list reconciliation ([#139](https://github.com/bQuery/bQuery/issues/139)), plus `keys()` / `keyAt(index)`. When supplied, the stable-key contract (present, unique keys) is validated on every structural mutation and a descriptive error names the offending key. Without `getKey` the array stays positional (unchanged behaviour).
- **`@bquery/bquery/i18n`** — ICU MessageFormat support ([#141](https://github.com/bQuery/bQuery/issues/141)). Messages using typed arguments (`{count, plural, …}`, `{n, selectordinal, …}`, `{gender, select, …}`) are routed through a locale-aware formatter backed by `Intl.PluralRules`, with `offset:`, exact `=N` selectors, nested arguments, the `#` token, and apostrophe escaping. New authoring helpers `defineMessages()` (identity + extraction anchor) and `formatMessage()` (standalone single-message formatter). Plain `{name}` interpolation and the legacy `singular | plural` pipe form are unchanged.
- **`@bquery/bquery/i18n/extract`** — optional, dependency-free message-extraction tooling ([#141](https://github.com/bQuery/bQuery/issues/141)). `extractFromSource()`, `mergeCatalog()`, `extractFiles()`, `expandGlobs()`, `flatten()` / `unflatten()`, and the CLI (`runExtractCli`, `bquery-i18n extract`) scan source for `defineMessages` catalogs and `t()` / `tc()` calls, then emit/merge nested JSON catalogs without overwriting existing translations (`--prune` opt-in). A separate entry point — importing it is never required at runtime, preserving the zero-build path.
- **`@bquery/bquery/a11y`** — the runtime audit now stamps each `AuditFinding` with its WCAG 2.1 criterion (`wcag`), and the full rule catalog is exported as `auditRules` ([#142](https://github.com/bQuery/bQuery/issues/142)) — each rule documents its WCAG mapping, default severity, and a known limitation (what it cannot detect).
- **`@bquery/bquery/plugin`** — new `definePlugin()` authoring helper ([#145](https://github.com/bQuery/bQuery/issues/145)): an identity helper that infers a plugin's install-options type and gives third-party authors a single, stable entry point.
- **`@bquery/bquery/devtools`** — new stable, versioned bridge protocol for the DevTools browser extension ([#146](https://github.com/bQuery/bQuery/issues/146)): `connectDevtoolsBridge()` (over `window.postMessage`), the transport-agnostic `createBridgeServer()`, `serializeComponentTree()`, and `BRIDGE_PROTOCOL_VERSION` / `BRIDGE_SOURCE` / `BRIDGE_CAPABILITIES`. A reference Manifest V3 extension (component tree, signal/store inspection, live timeline) ships in `extension/`.
- **`@bquery/bquery/router` + `@bquery/bquery/server`** — opt-in, bundler-agnostic file-route convention with typed `load` / `action` ([#149](https://github.com/bQuery/bQuery/issues/149)). New `createFileRoutes(manifest, options?)` turns a manifest (a bundler glob such as `import.meta.glob`, or a hand-written map) into the same `RouteDefinition`s `createRouter()` already consumes, with `parseFilePath` / `filePathToRoutePattern` (`routes/users/[id]/+page.ts` → `/users/:id`, `[...rest]` → `*`, `(group)` dropped) and specificity sorting (`sortEntriesBySpecificity`). Route modules export a typed `Load` (data into the view) and `Action` (mutation target). Loaders run on the server before render (the SSR router bridge now recognises `meta.load` alongside `meta.loader`) and on client navigation via `createRouteData(router)` / `useRouteData()`. The `server` module exposes `mountFileRoutes(app, entries, options?)` / `createFileRouteServerRoutes()` so a `<form>` (or `formAction()`) posts to a route's `action`, composing with `csrf()`. Programmatic routing stays fully supported and unchanged; no bundler is shipped. See the new [File-based Routing guide](https://bquery.js.org/guide/file-routing).
- **Docs / Stability** — single-source [Stability Matrix](https://github.com/bQuery/bQuery/blob/main/STABILITY.md) plus a per-module stability changelog ([#150](https://github.com/bQuery/bQuery/issues/150)). A new canonical `STABILITY.md` (backed by `scripts/stability-matrix.mjs`) records each module's maturity and its status-transition history; the README "Modules at a glance" table and the docs `introduction.md` matrix are now validated against it by `bun run check:stability` (`scripts/check-stability-matrix.mjs`), so the three surfaces can no longer silently drift.

### Changed (1.15.0)

- **`@bquery/bquery/view`** — `view` graduated to **Stable** in 1.15.0 ([#136](https://github.com/bQuery/bQuery/issues/136)). The directive set and expression grammar are frozen for one minor cycle, and a per-directive SSR support matrix is published in the [View guide](https://bquery.js.org/guide/view).
- **`@bquery/bquery/forms`** — `forms` graduated to **Stable** in 1.15.0 ([#139](https://github.com/bQuery/bQuery/issues/139)). The 1.13 batteries-included surface is frozen for one minor cycle; the `'manual'` `validationStrategy` default is documented as a deliberate contract (`handleSubmit()` always runs the full validation pass; the strategy gates only _automatic_ per-change/per-blur validation); the SSR serialization boundary is now a guaranteed contract (`serializeFormState()` deterministically drops functions, `File` / `Blob` / `FileList`, `bigint`, and `symbol`); and the `createFieldArray()` stable-key requirement is validated with clear errors. See the [Forms guide](https://bquery.js.org/guide/forms).
- **`@bquery/bquery/i18n`** — `i18n` graduated to **Stable** in 1.15.0 ([#141](https://github.com/bQuery/bQuery/issues/141)). The formatting/locale surface is frozen for one minor cycle, ICU MessageFormat coverage is documented and tested, and lazy-loading of catalogs is documented. See the [i18n guide](https://bquery.js.org/guide/i18n).
- **`@bquery/bquery/a11y`** — `a11y` graduated to **Stable** in 1.15.0 ([#142](https://github.com/bQuery/bQuery/issues/142)). The surface (focus management, live regions, `inert`/`scrollLock`, preference signals) is frozen for one minor cycle, and the audit's WCAG coverage is documented with its known limitations. See the [A11y guide](https://bquery.js.org/guide/a11y).
- **`@bquery/bquery/dnd`** — `dnd` graduated to **Stable** in 1.15.0 ([#143](https://github.com/bQuery/bQuery/issues/143)). The surface is frozen for one minor cycle; the keyboard model (pick up / move / drop / cancel, `aria-grabbed`) is hardened and tested across `grid` / `delay` / `viewport`; and an accessibility statement is published. Drag announcements route through the shared `a11y` live-region announcer. See the [DnD guide](https://bquery.js.org/guide/dnd).
- **`@bquery/bquery/media`** — `media` graduated to **Stable** in 1.15.0 ([#144](https://github.com/bQuery/bQuery/issues/144)). The 1.14 composable surface is frozen for one minor cycle; each composable's SSR-safe default and cleanup is documented; and reactivity, idempotent `destroy()`, listener detachment, and `AbortSignal` teardown are verified. Bake-and-verify — no new features. See the [Media guide](https://bquery.js.org/guide/media).
- **`@bquery/bquery/plugin`** — `plugin` graduated to **Stable** in 1.15.0 ([#145](https://github.com/bQuery/bQuery/issues/145)). The hook-bus / DI / install-lifecycle / directive-registration surface is frozen for one minor cycle; install/uninstall symmetry (no leaked directives/filters/actions/DI bindings) is proven with tests; and a plugin-author guide (lifecycle, hook timing, DI resolution, directive namespacing) is published. See the [Plugin guide](https://bquery.js.org/guide/plugin).
- **`@bquery/bquery/devtools`** — `devtools` graduated to **Stable** in 1.15.0 ([#146](https://github.com/bQuery/bQuery/issues/146)). The surface is frozen for one minor cycle; the bridge protocol is stabilized as the app↔extension contract; and a reference browser extension ships. See the [DevTools guide](https://bquery.js.org/guide/devtools).
- **`@bquery/bquery/testing`** — `testing` graduated to **Stable** in 1.15.0 ([#147](https://github.com/bQuery/bQuery/issues/147)). The Testing-Library-parity surface is frozen for one minor cycle; runner integration beyond `bun:test` (Vitest / Jest) is documented; and the shadow-DOM-aware queries, `userEvent` / `fireEvent`, and mocks are tested across light + shadow DOM. See the [Testing guide](https://bquery.js.org/guide/testing).
- **`@bquery/bquery/storybook`** — `storybook` graduated to **Stable** in 1.15.0 ([#148](https://github.com/bQuery/bQuery/issues/148)). The helper surface is frozen for one minor cycle, and the `unsafeHtml` security contract is pinned (sanitize-by-default; only brand-checked, author-controlled fragments inserted verbatim) and covered by tests. See the [Storybook guide](https://bquery.js.org/guide/storybook).

### Fixed (1.15.0)

- **`@bquery/bquery/view`** — `bq-for` duplicate-key handling is resolved ([#136](https://github.com/bQuery/bQuery/issues/136)): colliding keys now fall back to a deterministic, referentially-stable composite key so duplicate rows reuse their DOM across re-renders, and the duplicate-key warning is dev-only and emitted once per offending key instead of on every reactive update.
- **`@bquery/bquery/view`** — object-expression shorthand is resolved ([#136](https://github.com/bQuery/bQuery/issues/136)): `bq-class="{ active }"` (and `bq-style` / `bq-aria` object syntax) now behaves like JS object shorthand (`{ active: active }`) instead of silently dropping the property.

### Module status (1.15.0)

Canonical source: [STABILITY.md](https://github.com/bQuery/bQuery/blob/main/STABILITY.md) (enforced by `bun run check:stability`).

- `view`, `forms`, `i18n`, `a11y`, `dnd`, `media`, `plugin`, `devtools`, `testing`, `storybook`: Beta → **Stable** (surfaces frozen, exit criteria met and tested).
- `concurrency`, `ssr`, `server`: Experimental → **Stable** (CSP-safe module workers / resumable production hydration / first-party sessions resolved; `ctx`/`app` contract frozen).
- `router`: Stable — file-route convention added as a strictly additive, opt-in surface ([#149](https://github.com/bQuery/bQuery/issues/149)); no status change.
- With these graduations, all 21 modules are now Stable; the Beta and Experimental tiers are currently empty.

#### Breaking changes

- None this cycle. Every graduation is additive; no breaking changes are flagged.

## [1.14.2] - 2026-06-26

### Fixed (1.14.2)

- Updating Dev-Dependencies

## [1.14.1] - 2026-05-28

### Fixed (1.14.1)

- **Motion**: `prefersReducedMotion()` and `reducedMotionSignal()` now refresh their cached reduced-motion media query when `window.matchMedia` changes, preventing stale preference reads in tests and other environments that swap the media-query implementation at runtime.

## [1.14.0] - 2026-05-26

### Added (1.14.0)

- **Media / Preference signals**: Added `usePreferredColorScheme()`, `usePreferredContrast()`, `usePreferredReducedTransparency()`, `usePreferredLanguage()`, and `usePreferredLanguages()` reactive composables to `@bquery/bquery/media` that wrap `prefers-color-scheme`, `prefers-contrast`, `prefers-reduced-transparency`, and `navigator.language(s)` with deterministic SSR defaults.
- **Media / Page state**: Added `useOnlineStatus()` (slim boolean variant of `useNetworkStatus()`), `usePageVisibility()`, `useDocumentFocus()`, `useWindowFocus()`, and `useIdle(timeoutMs, opts?)` to track top-level user-activity state.
- **Media / Element observers**: Added `useElementSize(target, opts?)`, `useElementBounding(target, opts?)`, `useElementVisibility(target, opts?)`, `useHover(target)`, `useFocus(target)`, `useFocusWithin(target)`, and `useActiveElement()` — ergonomic wrappers over `ResizeObserver` / `IntersectionObserver` and DOM focus events. Targets accept plain `Element | null | undefined` values.
- **Media / Pointer & scroll**: Added `usePointer()` (`{ x, y, pressure, type, isInside }`) and `useScroll(target?)` (`{ x, y, directionX, directionY, isScrolling, arrived }`).
- **Media / Platform integrations**: Added `usePermission(name)` (`'granted' | 'denied' | 'prompt' | 'unsupported'`), `useWakeLock()` (`isActive`, `request()`, `release()`), `useShare()` / `useShareSupported()`, `useBroadcastChannel<T>(name)` (`{ data, post, close }`), `useEventListener(target, event, opts?)`, `useMediaDevices()`, and `useStorage<T>(key, defaultValue, opts?)` with cross-tab `storage` event sync.
- **Media / Clipboard**: Added `clipboard.isSupported`, `clipboard.isImageSupported`, `clipboard.readImage()`, `clipboard.writeImage()`, and the standalone `clipboardText()` reactive accessor.
- **Media / Composables**: Every new composable accepts an optional `{ signal: AbortSignal }` for auto-teardown matching the `motion` 1.13 convention, and an internal shared `createMediaSignal` helper standardises SSR safety + idempotent teardown.
- **Plugin / Hooks**: Added a synchronous filter pipeline (`addFilter`, `applyFilters`, `removeFilter`, `listFilters`) and a fire-and-forget action bus (`addAction`, `doAction`, `removeAction`, `listActions`) exposed both on the install context (`ctx.addFilter`, `ctx.addAction`) and as standalone exports for app-level consumers.
- **Plugin / DI**: Added container-level dependency injection — `createInjectionKey<T>()`, `provide(key, value)`, `inject(key)`, `hasProvided(key)`, `resetDi()` — and a matching `ctx.provide` / `ctx.inject`. Plugins can register `ctx.onCleanup(fn)` callbacks that fire when the plugin is uninstalled.
- **Plugin / Lifecycle**: Added `unuse(name)` and `uninstall(name)` to detach every directive, filter, action, and DI binding owned by a plugin and run its registered cleanups. `install()` may now return `void | Promise<void>`; concurrent installs of the same name are serialised.
- **Plugin / Metadata**: `BQueryPlugin` now accepts optional `version`, `description`, and `dependencies: string[]`. `use()` enforces dependencies via `dependencyMode: 'error' | 'warn'`. New `getPluginInfo(name)` and `getInstalledPlugins({ withMetadata: true })` overloads expose plugin metadata.
- **Plugin / Directives**: Directives may now register lifecycle objects `{ mounted, unmounted }` and use plugin-namespaced names like `tooltip:arrow`.
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
- **`@bquery/bquery/router`** — additive 1.14.0 expansion:
  - `NavigationResult` type with `pushResult()` and `replaceResult()`
    methods that return structured results with `status`, `requestedPath`,
    `to`, `from`, and `error` fields instead of bare promises (existing
    `push`/`replace` continue to return `Promise<void>`).
  - `beforeResolve(guard)` global hook fired after `beforeEach` and
    route-level `beforeEnter` guards but before navigation commits.
  - `resolveRoute(input)` method for synchronous route lookup without
    navigating.
  - Dynamic route management via `addRoute(parentName?, route)`,
    `removeRoute(name)`, and `hasRoute(name)`.
  - `isReady()` returning a promise that settles after the initial route
    synchronization during router construction,
    plus `lastNavigation` signal exposing the most recent result.
  - `useNavigation()` composable returning reactive navigation state
    (`isNavigating`, `error`, etc.).
- **`@bquery/bquery/view`** — additive 1.14.0 expansion:
  - Public `parseDirective(name)` helper and `ParsedDirective` type for
    parsing `bq-on:event.modifier-param.modifier` syntax.
  - New directives `bq-once`, `bq-init`, `bq-pre`, `bq-cloak`,
    `bq-html-safe`, and `bq-memo`.
  - Full `bq-on` modifier system: `.stop`, `.prevent`, `.self`, `.capture`,
    `.passive`, `.once`, mouse-button filters (`.left`/`.middle`/`.right`),
    system-modifier filters (`.ctrl`/`.alt`/`.shift`/`.meta`), and
    KeyboardEvent.key filters including aliases (`.enter`, `.esc`, arrow
    keys, etc.).
- **`@bquery/bquery/a11y`** — additive 1.14.0 expansion:
  - `createLiveRegion(options)` for imperative, per-instance ARIA live
    regions independent of the singleton `announceToScreenReader`.
  - Reactive `keyboardUserSignal()` and `focusVisible()` signals.
  - New media-preference signals `prefersReducedTransparency()`,
    `prefersReducedData()`, and `forcedColors()`.
  - DOM helpers `inert(target)`, `scrollLock()`, and `autoFocus(target, opts)`.
- **`@bquery/bquery/i18n`** — additive 1.14.0 expansion:
  - `negotiateLocale(requested, available, opts)` for pure locale
    negotiation against a list of available tags.
  - `detectLocale(opts)` reading from cookies, `localStorage`,
    `<html lang>`, and `navigator.languages`.
  - `isRTL(locale)` using `Intl.Locale` text-info when available with a
    well-known-language fallback.
  - New Intl helpers `formatRelativeTime`, `formatList`,
    `formatDisplayName`, and `segment` (graceful fallbacks when the
    underlying Intl API is unavailable).
- **`@bquery/bquery/dnd`** — additive 1.14.0 expansion:
  - Programmatic API on existing handles — `DraggableHandle.moveTo`/`reset`/`getPosition`/`setBounds`/`setAxis`, `SortableHandle.move`/`setOrder`/`getItems`, `DroppableHandle.setAccept`/`isOver`/`getActiveDragged`.
  - New draggable options `grid` (snap-to-grid), `delay` (long-press threshold), `touchStartThreshold` (minimum pointer movement before drag activates), `keyboard` (opt-in keyboard accessibility with `Space`/`Enter` pickup, arrow-key movement, `Escape` cancel, and ARIA announcements via `@bquery/bquery/a11y`), and `keyboardStep` (keyboard movement step).
  - `bounds` now accepts an `HTMLElement` reference directly and supports a `'viewport'` shorthand.
  - Reactive composables `useDraggable()`, `useDroppable()`, `useSortable()`, plus the `draggablePosition()` and `sortableOrder()` adapters for raw handles. Composables auto-dispose when the surrounding reactive scope stops.
- **`@bquery/bquery/storybook`**: New ergonomic helpers `classMap()`, `styleMap()`, `ifDefined()`, `repeat()`, `storyText()`, and the opt-in sanitizer escape hatch `unsafeHtml()`, all callable inside `storyHtml` template literals. Added `storySvg()` for SVG-rooted stories (interpolated values are HTML-escaped; static template is treated as author-trusted because the HTML sanitizer hard-blocks `<svg>`).
- **`@bquery/bquery/concurrency`**: Expanded with richer support metadata, `withTransferables()`, `createSharedBuffer()`, RPC `maxInFlight`, pool priority handling, `pause()` / `resume()`, `onIdle()`, and rolling pool metrics with reactive mirrors.
- **`@bquery/bquery/ssr`**: Expanded with `flushBoundary()`, `createSSRCache()`, `createSSRMetrics()`, `createEdgeHandler()`, cache-aware `renderToResponse()`, and explicit multi-chunk `renderToStream()` boundaries.
- **`@bquery/bquery/server`**: Expanded with structured `ServerHttpError` helpers, `ctx.body()`, `ctx.cookies`, `ctx.setCookie()`, `ctx.accepts()`, `ctx.stream()`, `ctx.sse()`, `ctx.renderStream()`, `ctx.renderResponse()`, and `app.listen()` for supported runtimes.

### Changed (1.14.0)

- **Devtools**: `inspectSignals()` accepts a new `{ includeValues?: boolean }` option. `enableDevtools()` accepts `maxTimelineEntries` and now flushes any active timeline subscribers on disable.
- **Plugin**: `BQueryPlugin.install` may now return `void | Promise<void>`; `use()` returns `void` for synchronous installs and `Promise<void>` whenever a plugin installs asynchronously.
- **Media**: `clipboard` re-uses a shared SSR-safe initialisation helper; existing `readText` / `writeText` signatures are unchanged.

### Fixed (1.14.0)

- Preserved queue ordering within equal priorities for concurrency pools while still allowing higher-priority work to run sooner.
- Hardened SSR edge and cache helpers so cached responses preserve status and headers consistently.

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
- **Motion / Reduced motion**: `onReducedMotionChange(callback)` subscribes to changes (system preference _or_ `setReducedMotion()` override) and returns an unsubscribe; `reducedMotionSignal()` exposes the same value as a reactive `ReadonlySignal<boolean>` for `view`/components.
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
