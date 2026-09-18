# Improvement & Extension Roadmap

An evidence-based audit of bQuery.js **v1.16.1**, listing the changes that would
raise quality and usefulness the most. Every finding below was reproduced
against the checked-out tree — the commands and observed output are quoted so
each item can be re-verified before it is picked up.

This is a working document for maintainers, not a commitment. Items are grouped
by theme and each carries an effort and risk estimate. A suggested release
sequencing is at the [end](#suggested-sequencing).

## Audit baseline

What the tree looks like today, measured rather than assumed:

| Signal                 | Result                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------ |
| Source                 | 283 TypeScript files, ~64,100 lines across 21 modules                                |
| `bun test`             | 3,067 pass / 1 fail, 7,561 assertions, 74 files, ~15 s                               |
| `bun test --coverage`  | **90.70 % functions / 91.25 % lines**                                                |
| `bunx eslint .`        | clean                                                                                |
| `bun run format:check` | clean                                                                                |
| `bun run check`        | all five checks pass (AI guidance, full bundle, stability, doc exports, theme links) |
| Public API docs        | 656/656 runtime exports mentioned in their module guide (100 %)                      |
| Stability matrix       | 21/21 modules Stable, no Beta or Experimental members                                |

The hygiene layer is in very good shape. That shifts the highest-leverage work
away from "tidy the repo" and towards three places: **a correctness gap in the
reactive scheduler**, **two sanitizer implementations that disagree**, and the
**verification and adoption surfaces that do not exist yet**.

## Priority matrix

| #   | Item                                                   | Category     | Impact | Effort | Risk   |
| --- | ------------------------------------------------------ | ------------ | ------ | ------ | ------ |
| A1  | Glitch-free, auto-batched effect scheduling            | Correctness  | High   | L      | High   |
| B1  | Unify the two sanitizer implementations                | Security     | High   | M      | Medium |
| B2  | DOM-free sanitizer for SSR/server runtimes             | Security     | High   | M      | Low    |
| B3  | XSS payload corpus + differential sanitizer tests      | Security     | High   | S      | Low    |
| C1  | Make the PR gate run `check`, `lint`, `format:check`   | CI           | High   | S      | None   |
| C2  | Fix workflows targeting the non-existent `development` | CI           | High   | S      | None   |
| C3  | Real-browser test lane (Playwright)                    | Verification | High   | M      | Low    |
| C4  | Coverage floor + targeted tests for the weak files     | Verification | Medium | M      | Low    |
| C5  | Bundle-size budgets per entry point                    | Verification | Medium | S      | Low    |
| C6  | Performance benchmark suite with regression gate       | Verification | Medium | M      | Low    |
| C7  | `publint` + `are-the-types-wrong` in CI                | Packaging    | Medium | S      | Low    |
| D1  | Shrink the published package (11.3 MB → ~3 MB)         | Packaging    | Medium | S      | Low    |
| D2  | Decide and document the CJS story for subpaths         | Packaging    | Medium | S      | Medium |
| E1  | Standard Schema adapter (forms + server validation)    | Extension    | High   | M      | Low    |
| E2  | Static asset serving in `server`                       | Extension    | High   | M      | Low    |
| E3  | Rate limiting / request throttling middleware          | Extension    | Medium | S      | Low    |
| F1  | Official bundler plugin (`unplugin`)                   | Adoption     | High   | L      | Low    |
| F2  | `create-bquery` project scaffolder                     | Adoption     | High   | M      | Low    |
| F3  | Editor IntelliSense data for `bq-*` directives         | Adoption     | Medium | S      | Low    |
| F4  | ESLint plugin with bQuery-specific rules               | Adoption     | Medium | M      | Low    |
| F5  | Example apps beyond SSR                                | Adoption     | Medium | M      | None   |
| G1  | Harden the IPv6 server test                            | Reliability  | Low    | XS     | None   |

Effort: XS ≈ under an hour · S ≈ a day · M ≈ a few days · L ≈ a release cycle.

---

## A. Reactive core correctness

### A1 — Effects observe glitched intermediate states

This is the single most valuable change in the list, and the only one that is a
genuine correctness bug rather than a gap.

**Evidence.** A classic diamond graph, run against `src/reactive/index`:

```ts
const a = signal(0);
const b = computed(() => a.value + 1);
const c = computed(() => a.value * 2);
const d = computed(() => b.value + c.value);

const runs: number[] = [];
effect(() => {
  runs.push(d.value);
});

a.value = 1; // d should become 4
a.value = 2; // d should become 7
```

Observed: `[1, 2, 4, 5, 7]`. Expected: `[1, 4, 7]`.

The values `2` and `5` are **glitches** — states in which `b` has been
recomputed but `c` has not, so the effect briefly observes a `d` that never
logically existed. Wrapping the writes in `batch()` produces the correct
`[1, 7]`, which confirms the diagnosis rather than excusing it.

**Root cause.** `scheduleObserver()` in `src/reactive/internals.ts` invokes the
observer synchronously whenever `batchDepth === 0`:

```ts
export const scheduleObserver = (observer: Observer): void => {
  if (batchDepth > 0) {
    pendingObservers.add(observer);
    return;
  }
  observer();
};
```

Each `Signal` notifies its subscribers in insertion order, with no topological
ordering and no dirty/clean propagation phase. `computed` is already lazy and
cached (verified: a computed evaluates zero times before its first read, and
once thereafter), so reading `d.value` at any point outside an effect is always
correct — the inconsistency is confined to the effect notification path, which
is exactly where user-visible DOM updates happen.

**Secondary cost.** The same design makes every write flush the whole dependent
set synchronously. Measured on Bun 1.3.11 in this container: 1,000 writes to one
signal with 1,000 subscribed effects takes **371 ms** (1,000,000 effect
invocations). With a microtask-flushed scheduler the same burst inside one tick
collapses to 1,000 invocations.

**Proposal.**

1. Introduce a two-phase scheduler: a synchronous _mark-dirty_ pass that
   propagates a dirty flag through the dependency graph, and a flush pass that
   runs effects in dependency order, pulling values lazily. This is the
   push-pull model used by Preact Signals, Angular and Solid, and it removes
   glitches by construction.
2. Auto-batch the flush onto a microtask, so a burst of synchronous writes
   produces one effect run. Keep `batch()` working as an explicit, still-useful
   scope; add `flushSync()` for tests and for code that needs the old timing.
3. Ship it behind `configureReactive({ scheduler: 'sync' | 'batched' })` with
   `'sync'` as the default for the whole 1.x line, flip the default in 2.0.

**Risk.** High — effect timing is observable, so this is semver-major behaviour
even though it fixes a bug. Every module that layers on `effect` (view, forms,
store, dnd, router, ssr hydration) needs its tests re-run under the new
scheduler before the default flips. The opt-in flag is what makes it shippable
in a minor.

**Suggested acceptance tests.** Diamond graph produces no intermediate values;
a chain of N writes in one tick produces one effect run; effects that write
signals still settle (keep the existing `MAX_FLUSH_PASSES` guard); ordering is
parent-before-child for nested scopes.

---

## B. Security

### B1 — Two sanitizer implementations that disagree

`src/security/sanitize-core.ts` (DOM-based, used on the client) and
`sanitizeHtmlForSSR()` in `src/ssr/renderer.ts` (string/AST-based, used by the
SSR renderer for `bq-html`) are independent implementations of the same policy.
They share `DANGEROUS_TAGS` and `DEFAULT_ALLOWED_TAGS` but not their attribute
logic, and they have already drifted.

**Evidence.** Running both over the same input:

| Input                                   | Client sanitizer    | SSR sanitizer                           |
| --------------------------------------- | ------------------- | --------------------------------------- |
| `<img srcset="javascript:alert(1) 1x">` | `<img>`             | `<img srcset="javascript:alert(1) 1x">` |
| `<a id="x"></a><a id="x" name="y"></a>` | second `id` dropped | both `id`s kept                         |

Differences the SSR path is missing, by reading the two sources side by side:

- no `srcset` URL validation (`isSafeSrcset`),
- no duplicate-`id` de-duplication, so the **DOM-clobbering vector the client
  sanitizer explicitly defends against survives server-side rendering**,
- no `action` attribute URL check,
- no mXSS double-parse stability check,
- no `SanitizeOptions` support (`allowTags`, `allowAttributes`,
  `allowDataAttributes`, `stripAllTags`) — SSR silently ignores any policy the
  app configured for the client.

The last point is the structural problem: an app that renders the same
`bq-html` content on the server and the client gets two different security
policies, and the weaker one runs where the output is not yet under the
browser's own parser.

**Proposal.** Extract one policy engine parameterised over a tree backend:
`src/security/policy.ts` holding the decision logic (which tags, which
attributes, URL checks, clobbering defence, mXSS check), with two thin adapters
— one over `DOMParser`/`TreeWalker`, one over the existing `SSRNode` tree from
`src/ssr/html-parser.ts`. `sanitizeHtmlForSSR` becomes a call into the shared
engine with the SSR adapter. Add a differential test (see B3) that asserts both
backends agree on every corpus entry, so they cannot drift again.

### B2 — `sanitizeHtml()` is unusable outside a DOM

**Evidence.**

```console
$ bun -e "import('./src/security/index.ts').then(m => m.sanitizeHtml('<b>hi</b>'))"
ReferenceError: document is not defined
```

`parseHtmlSafely()` reaches for `document.createDocumentFragment()` and
`DOMParser` unconditionally. For a framework that advertises runtime-agnostic
SSR and "DOM writes are sanitized by default", the sanitizer being the one piece
that requires a browser is a sharp edge: server code that needs to sanitize
user-generated HTML — the most common case there is — must install `linkedom`
or `happy-dom` and wire globals, or reach for an unexported internal.

**Proposal.** Once B1 lands, the SSR adapter makes this free: `sanitizeHtml()`
selects the string backend when no DOM is present, exactly as
`src/ssr/config.ts` already does for the renderer (`getDefaultBackend()`).
Export the choice as `configureSanitizer({ backend })` for apps that want to
pin it. Document it in `docs/concepts/security-model.md`.

### B3 — No adversarial test corpus for the sanitizer

`tests/` contains no XSS payload corpus, no mXSS regression fixtures and no
fuzzing. The sanitizer's own comments describe defences against DOM clobbering,
mXSS and URL normalisation tricks — all of which are currently covered only by
hand-written examples.

**Proposal.**

1. `tests/fixtures/xss-corpus.json` — a curated payload list (mXSS via
   `<svg><style>` and `<math><mtext>` namespace confusion, clobbering,
   protocol obfuscation, entity and control-character tricks, `srcset`,
   `formaction`, `xlink:href`). Assert for each: no `on*` attribute, no
   script-capable URL scheme, no `<script>`/`<iframe>` in the output.
2. A differential test asserting the DOM and string backends produce identical
   output for every corpus entry (this is what would have caught B1).
3. A property-based pass (`fast-check`, dev-only) generating random attribute
   and tag soup, asserting the same invariants plus idempotency:
   `sanitize(sanitize(x)) === sanitize(x)`.

`src/security/csp.ts` sits at **53.66 %** line coverage today; the CSP helpers
should be pulled up alongside this work.

---

## C. Verification infrastructure

### C1 — The PR gate does not run the repo's own checks

`.github/workflows/test.yml` runs `bun run test:types` and `bun test`. It does
not run `bun run check`, `bun run lint`, or `bun run format:check`. ESLint runs
in a separate workflow whose trigger is broken (C2), so in practice a PR can
merge with lint errors, unformatted files, a stale stability matrix, or a public
export missing from its module guide — all of which the repo has scripts to
catch.

**Proposal.** Add a `quality` job to `test.yml` running
`bun run lint:types && bunx eslint . && bun run format:check && bun run check`.
Keep the SARIF-uploading ESLint workflow for code scanning, but stop relying on
it as the gate.

### C2 — Four workflows trigger on a branch that does not exist

```console
$ grep -rn "development" .github/workflows/
docs-link-check.yml:10, :18
eslint.yml:14, :17
docs.yml:10, :21
ssr-cross-runtime.yml:13
test.yml:12
```

The repository's branches are `main` and `dev`; `codeql.yml` was already
corrected in commit `97a7aa0` but the other five references were not. Effects:
`pull_request` events targeting `dev` do not trigger ESLint, the docs build, the
docs link check, or the SSR cross-runtime suite. (`test.yml` and
`ssr-cross-runtime.yml` still run via their `push: '**'` trigger, so the damage
is partial — but PRs into `dev` get a weaker gate than PRs into `main`, which is
backwards.)

The same stale name appears in the contributor docs: the
[Contributing](/contributing/) page still tells newcomers to branch from
`development`.

**Proposal.** Replace every `development` with `dev`, in the workflows and in
the docs. Consider a repo policy check that fails if a workflow references a
branch with no remote counterpart.

### C3 — No test ever runs in a real browser

Every DOM test runs under `happy-dom`. For a DOM-centric framework this leaves a
meaningful class of bugs unobservable: Shadow DOM and slot distribution,
`adoptedStyleSheets`, real custom-element upgrade timing, Trusted Types
enforcement under a real CSP, View Transitions, Web Animations timing, pointer
and drag events, `IntersectionObserver`/`ResizeObserver` scheduling. The
`security`, `component`, `motion`, `dnd` and `a11y` modules are all rated Stable
on the strength of a DOM emulator.

**Proposal.** A `browser` CI lane using Playwright against Chromium, Firefox and
WebKit, with a small suite covering: component lifecycle and slots, Trusted
Types under an enforced `require-trusted-types-for 'script'` header, view
transitions and FLIP, a drag-and-drop keyboard and pointer path, and a
hydration-mismatch scenario. Keep it separate from `bun test` so the fast lane
stays fast; run it on PRs and nightly.

### C4 — Coverage is measured but not enforced, and some Stable modules are thin

Overall coverage is good; the distribution is not. Files under 75 % line
coverage:

| File                            | Lines   | Note                                               |
| ------------------------------- | ------- | -------------------------------------------------- |
| `src/store/utils.ts`            | 5.08 %  | `store` is rated Stable                            |
| `src/a11y/skip-link.ts`         | 9.13 %  |                                                    |
| `src/platform/buckets.ts`       | 13.79 % |                                                    |
| `src/router/bq-link.ts`         | 20.96 % | the documented navigation element                  |
| `src/component/props.ts`        | 24.19 % |                                                    |
| `src/platform/storage.ts`       | 33.33 % |                                                    |
| `src/component/scope.ts`        | 47.76 % | scoped reactivity — feeds every component          |
| `src/store/create-store.ts`     | 49.35 % | the module's main entry point                      |
| `src/security/csp.ts`           | 53.66 % | security-relevant                                  |
| `src/motion/flip.ts`            | 54.44 % |                                                    |
| `src/motion/scroll.ts`          | 54.55 % |                                                    |
| `src/platform/notifications.ts` | 57.14 % |                                                    |
| `src/ssr/runtime.ts`            | 59.52 % |                                                    |
| `src/media/clipboard.ts`        | 63.74 % |                                                    |
| `src/component/css.ts`          | 66.67 % |                                                    |
| `src/view/process.ts`           | 67.16 % | the directive processing hot path                  |
| `src/ssr/expression.ts`         | 69.26 % | evaluates template expressions — security-relevant |
| `src/media/device-sensors.ts`   | 69.62 % |                                                    |
| `src/motion/spring.ts`          | 70.05 % |                                                    |
| `src/media/geolocation.ts`      | 70.31 % |                                                    |
| `src/forms/bind.ts`             | 71.74 % |                                                    |
| `src/concurrency/helpers.ts`    | 72.60 % |                                                    |
| `src/view/compiler/cli.ts`      | 74.65 % |                                                    |

Some of these are browser-API wrappers that are genuinely awkward under
happy-dom — which is an argument for C3, not for leaving them untested.

**Proposal.** Add `bun test --coverage` to CI with a global floor at the current
90 % (so it can only go up) and a per-file floor of 70 % applied to
`store`, `view`, `security`, `component` and `ssr` first. Prioritise
`store/create-store.ts`, `component/scope.ts`, `view/process.ts`,
`ssr/expression.ts` and `security/csp.ts` — those five carry the most behaviour
per uncovered line.

### C5 — No bundle-size budget

Bundle size is a headline claim (three badges in the README), but nothing fails
if it regresses. Current build output:

| Artifact        | Raw     | Gzip   |
| --------------- | ------- | ------ |
| `full.iife.js`  | 408 kB  | 132 kB |
| `full.umd.js`   | 408 kB  | 131 kB |
| `full.es.mjs` † | 20.8 kB | 7.5 kB |
| `core.es.mjs` † | 3.3 kB  | 1.4 kB |

† ESM entries re-export shared chunks, so these figures are entry files, not the
transitive cost of importing the module.

**Proposal.** Add `size-limit` (or a small script over the build output) with a
budget per public entry point measured **transitively** — that is, the real cost
of `import { $ } from '@bquery/bquery/core'` after bundling — and fail CI on
regression beyond a threshold. Publish the resulting table in
`docs/concepts/bundle-and-tree-shaking.md` so the numbers users care about are
first-party rather than inferred from Bundlephobia.

### C6 — No performance benchmarks

There is no benchmark suite, so there is no way to notice a performance
regression except in production. For a framework whose pitch includes signals
and SSR, the three numbers that matter are: signal write/notify throughput,
directive mount and update cost, and SSR render throughput.

**Proposal.** A `bench/` directory using `mitata` (Bun-native), covering signal
graphs (wide fan-out, deep chains, diamonds), `mount()` over a large list with
`bq-for`, and `renderToString` on a representative page. Run it nightly, store
results as a CI artifact, and gate PRs on a generous regression threshold
(e.g. 20 %) so noise does not block merges. A1 should land with before/after
numbers from this suite.

### C7 — No packaging validation

Nothing verifies the `exports` map, the type resolution under each module
resolution mode, or the contents of the published tarball.

**Proposal.** Add `publint` and `@arethetypeswrong/cli` to the release job (and
to the quality job from C1, running against a fresh `bun run build`). Both are
single-command tools and would have surfaced D2 automatically.

---

## D. Packaging and distribution

### D1 — The published package is 11.3 MB unpacked across 972 files

```console
$ npm pack --dry-run
npm notice package size: 2.8 MB
npm notice unpacked size: 11.3 MB
npm notice total files: 972
```

Breakdown: source maps 7.6 MB, `src/` 2.6 MB, `dist/` without maps 3.0 MB. The
`files` field ships `dist` _and_ `src`, and the build emits `sourcemap: true`
for every entry, including the 2.2 MB map for `full.iife.js`.

**Proposal.** Decide deliberately, then document the decision in
`docs/contributing/release-process.md`:

- keep `src` (useful for go-to-definition) but drop `**/*.map` from the package
  → ~3.7 MB unpacked, or
- keep maps for the ESM entries only and drop the IIFE/UMD maps → ~5 MB, or
- drop both and publish maps as a separate `@bquery/bquery-sourcemaps` package.

Any of these is a large win for install time and CI cache size, and none affects
runtime behaviour.

### D2 — Subpath entries are ESM-only, silently

```console
$ node -e "require.resolve('@bquery/bquery')"        # OK
$ node -e "require.resolve('@bquery/bquery/core')"   # ERR_PACKAGE_PATH_NOT_EXPORTED
$ node -e "require.resolve('@bquery/bquery/server')" # ERR_PACKAGE_PATH_NOT_EXPORTED
```

Only the root export has a `require` condition (pointing at the UMD build); the
23 subpath entries have `import` and `types` only. For `/server` in particular —
the entry most likely to be consumed from a CJS Node backend — the failure mode
is a resolution error with no explanation.

Two further nits in the same map:

- `types` is listed **after** `import` in every subpath. TypeScript currently
  resolves it anyway (verified with a scratch consumer under
  `moduleResolution: nodenext`), but the documented requirement is that `types`
  comes first, and tooling that follows condition order strictly will break.
- There is no `"./package.json": "./package.json"` entry, which some tools
  (and several bundler plugins) expect to be resolvable.

**Proposal.** ESM-only is a defensible choice — but make it explicit rather than
accidental. Either add CJS builds for the subpaths, or keep ESM-only, move
`types` first, add the `./package.json` export, and state the policy in the
installation docs so the error is anticipated. C7 enforces whichever is chosen.

---

## E. Framework extensions

### E1 — Standard Schema adapter for forms and server validation

`src/forms/schema.ts` provides a fluent builder over the module's own
validators. It is well-built, but it is an island: a team that already has Zod,
Valibot or ArkType schemas for its API contracts has to restate them for bQuery
forms, and `src/server` has no body-validation helper at all
(`grep -rniE "validate|schema" src/server/*.ts` returns one unrelated comment).

[Standard Schema](https://standardschema.dev) is the cross-library interface
those validators already implement. Supporting it is a small amount of code and
buys interoperability with the whole ecosystem at once.

**Proposal.**

- `createForm({ schema })` accepting any `StandardSchemaV1`, mapping issue paths
  to field errors, and inferring the form value type from the schema's
  `~standard.types`.
- A `validate(schema)` middleware in `src/server` that parses the body
  (JSON / form data), replies `400` with a structured issue list on failure, and
  narrows `ctx.body`'s type on success.
- A shared schema used by both sides in the docs, demonstrating one definition
  driving client validation, server validation and TypeScript types — that
  example is the strongest argument for the "full-stack" positioning in the
  whole docs site.

Keep the existing builder; this is additive.

### E2 — Static asset serving in `server`

`src/server` has sessions, CSRF, guards, auth, cookies, errors, file routes and
WebSocket sessions — but no way to serve a file from disk. There is no
`readFile`, `createReadStream` or `Bun.file` anywhere in the module. Every
bQuery app therefore needs a reverse proxy or a second server just to deliver
its own `client.js`, which undercuts the zero-config story and makes the
`examples/ssr-*` apps less representative than they look.

**Proposal.** `serveStatic({ root, prefix, maxAge, immutable, index })` built on
the runtime adapters that `listen()` already uses, with: path traversal
rejection, `ETag` + `Last-Modified` and `304` handling (the ETag helper in
`src/ssr/render-async.ts` can be reused), `Range` support, correct
`Content-Type` mapping, and optional precompressed `.br`/`.gz` sidecar lookup.
This is the single largest usefulness gap in the server module.

### E3 — Rate limiting

No throttling primitive exists server-side (`createRequestQueue` in `reactive`
is a client-side concern). Any public bQuery endpoint — the login route in the
docs' own example included — is unprotected against brute force by default.

**Proposal.** `rateLimit({ window, max, keyBy, store })` sharing the
`SessionStore` abstraction from `src/server/session.ts` so a Redis-backed store
can be plugged in, emitting the standard `RateLimit-*` response headers and
`429` with `Retry-After`. Pair it with the `basicAuth`/`bearerAuth` docs.

---

## F. Adoption and developer experience

These do not change what bQuery can do; they change how many people get far
enough to find out.

### F1 — Official bundler plugin

Two CLI binaries exist (`bquery-view-compile`, `bquery-i18n`), and file routing
is documented as "pass `import.meta.glob` output in yourself". There is no
first-party Vite/Rollup/webpack integration, so every non-trivial project wires
the same glue by hand.

**Proposal.** An [`unplugin`](https://github.com/unjs/unplugin)-based package —
one implementation, adapters for Vite, Rollup, webpack, Rspack and esbuild —
providing: view precompilation with HMR, i18n catalog extraction and
hot-reloading, file-route manifest generation, CSP nonce injection in dev, and
an SSR dev middleware. This is the highest-impact item in the section and the
natural home for the existing CLI logic.

### F2 — `create-bquery` scaffolder

There is no `npm create bquery@latest`. A first-time user's path today is: read
the README, pick an import strategy, wire a build, find the SSR example. Every
framework bQuery is positioned against removes that step.

**Proposal.** A scaffolder with four templates: zero-build CDN page, SPA with
router and store, SSR app (Node/Bun/Deno selectable, reusing `examples/ssr-*`),
and full-stack with `server` + forms. Each ships with tests wired to
`@bquery/bquery/testing` — which also markets the testing module for free.

### F3 — Editor IntelliSense for `bq-*` directives

The `view` module's directive set is frozen and fully documented, but editors
know nothing about it: `bq-if`, `bq-for`, `bq-model` and friends get no
completion, no hover documentation, and a "unknown attribute" squiggle in
strict HTML linting configs.

**Proposal.** Ship a VS Code
[custom data](https://code.visualstudio.com/api/extension-guides/custom-data-extension)
file (`html-custom-data.json`) generated from the directive registry, plus a
JSON Schema for `defineBqueryConfig`. Both are static files, both are generated
from sources that already exist, and both are noticed immediately by users.

### F4 — ESLint plugin

`eslint.config.js` carries the standard TypeScript rules and nothing
bQuery-specific. Several of the framework's documented invariants are
mechanically checkable.

**Proposal.** `@bquery/eslint-plugin` with rules such as: no `$()` without a
null-guard in code paths that can run pre-hydration, `effect()` inside a
component must use the scoped variant, no `trusted()`/`unsafeHtml()` on a
non-literal, `signal.value` read inside an untracked callback, and imports from
`@bquery/bquery` where a subpath would tree-shake better. The
"Common Pitfalls" section of `AGENT.md` is effectively a rule list waiting to be
written.

### F5 — Examples cover only SSR

`examples/` contains `ssr-bun`, `ssr-deno`, `ssr-node` and a shared `app.ts` —
no client-side SPA, no component library usage, no forms, no full-stack app.
The cookbook has 21 focused recipes, which is excellent, but nothing shows the
modules composing at application scale.

**Proposal.** Add a realistic full-stack example (auth, forms with server
validation, router with loaders, store persistence, i18n, SSR + hydration) and
run it in CI as a smoke test. It doubles as the F2 template and as the target
for the C3 browser suite.

---

## G. Smaller fixes

### G1 — The IPv6 server test fails in IPv6-less environments

`tests/server.test.ts:667` (`returns a valid URL for IPv6 node listen
addresses`) tolerates `EADDRNOTAVAIL` and `EAFNOSUPPORT`, but in a container
without IPv6 Bun's `node:http` shim reports:

```
error: Failed to start server. Is port 0 in use?
 syscall: "listen", errno: 0, code: "EADDRINUSE"
```

so the test fails rather than skipping. This is the one failing test in an
otherwise green suite, and it will bite anyone running the suite in Docker.

**Proposal.** Probe IPv6 availability once and skip the test when unavailable,
or widen the tolerated codes to include `EADDRINUSE` and `ENOTSUP` when the
hostname is `::1` and the port is `0` (a port-0 bind cannot genuinely collide).

---

## Suggested sequencing

**1.17 — verification and packaging (no behaviour change).**
C1, C2, G1 first (hours, and they protect everything after). Then C5, C7, D1,
D2, B3. Outcome: the gate catches what the repo can already detect, the package
is a third of its size, and the sanitizer has an adversarial corpus.

**1.18 — security unification and reach.**
B1 and B2 (one shared policy engine, two backends, guarded by B3's differential
test). C3 and C4 in parallel. Then E2 and E3 — the server module stops needing a
reverse proxy for a hello-world deploy.

**1.19 — ecosystem.**
E1 (Standard Schema), F1 (bundler plugin), F2 (scaffolder), F3, F5. This is the
batch that most changes how many people can adopt bQuery in an afternoon.
F4 follows whenever there is appetite.

**2.0 — reactive scheduler.**
A1 lands opt-in during 1.x with C6's benchmarks as evidence, and the default
flips in 2.0 with a migration guide (`flushSync()` for tests, explicit `batch()`
where synchronous timing was relied on). Since the stability matrix lists all 21
modules as Stable, this is the only correct place for it.
