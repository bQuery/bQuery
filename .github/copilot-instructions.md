# bQuery.js — Copilot Instructions

## Quick orientation

bQuery.js is a TypeScript-first, zero-build-capable DOM library with jQuery-style chaining and modern platform features. The package is modular, tree-shakeable, has zero runtime dependencies, and currently ships **21 public entry points**.

Current release baseline: **1.9.0**.

Start here before making assumptions:

- `AGENT.md` — full architecture, module reference, key files, patterns
- `llms.txt` — compact project summary for fast orientation
- `package.json` — authoritative scripts, exports, version, supported runtime
- `docs/guide/` — feature-specific guides for modules and workflows

Prefer linking to those files instead of duplicating large sections into new instructions or docs.

## Version 1.9.0 highlights

- `watchDebounce()` and `watchThrottle()` are public reactive APIs and should preserve `watch()`-style callback semantics and cleanup behavior.
- The view module's public directive set includes `bq-error` and `bq-aria`.
- The media module's public surface includes `useIntersectionObserver()`, `useResizeObserver()`, and `useMutationObserver()`.
- Publish and local validation target Node.js `>=24.0.0` and Bun `>=1.3.11`.

## Source of truth

When behavior, exports, or commands appear inconsistent, trust these in order:

1. `package.json`
2. `src/*/index.ts` public barrels
3. `AGENT.md`
4. `docs/guide/*.md`

If you change a public API, keep the relevant docs and agent context in sync:

- `README.md`
- `CHANGELOG.md`
- `AGENT.md`
- `llms.txt`
- `docs/guide/*`
- `.cursorrules`
- `.clinerules`

Also sync `src/full.ts` whenever public runtime exports change so the `/full` / CDN bundle matches the module barrels.

## Build, test, and validation

Use Bun for repository workflows:

Supported engines: Node.js `>=24.0.0`, Bun `>=1.3.11`.

- `bun test` — primary test suite with `happy-dom`
- `bun test --watch` — watch mode
- `bun run build` — library build (`build:lib` + `build:umd` + `build:types`)
- `bun run lint` — ESLint with auto-fix
- `bun run lint:types` — TypeScript type check only
- `bun run format` — Prettier
- `bun run dev` — VitePress docs dev server
- `bun run storybook` — Storybook dev server

For code changes, prefer validating with the smallest relevant command first, then broader checks as needed.

## Architecture snapshot

Public modules live under `src/<module>/index.ts`. Important module groups:

- `core` — `$`, `$$`, DOM wrappers, traversal, manipulation, events, utilities
- `reactive` — signals, computed values, scopes, batching, watch/watchDebounce/watchThrottle, async helpers, HTTP, polling/pagination, realtime transport, REST helpers
- `component` — Web Components helpers, typed props, lifecycle hooks, shadow DOM helpers
- `motion` — transitions, FLIP, springs, timelines, parallax, typewriter, reduced motion
- `security` — sanitization, Trusted Types, CSP helpers
- `platform` — storage, buckets, notifications, web platform helpers
- `router` — SPA routing, guards, params, navigation utilities, route signals
- `store` — signal-based state management and persistence
- `view` — declarative bindings with `bq-*` directives including `bq-error` and `bq-aria`
- `storybook`, `forms`, `i18n`, `a11y`, `dnd`, `media`, `plugin`, `devtools`, `testing`, `ssr` — feature modules with their own public barrels and guides

Entry points:

- `src/index.ts` — main all-in entry
- `src/full.ts` — explicit full bundle / CDN-oriented entry
- `vite.config.ts` / `vite.umd.config.ts` — build entry point definitions

## Project conventions

- Strict TypeScript, pure ESM, tree-shakeable package design
- Keep module exports explicit and minimal in each `index.ts`
- Preserve chainable APIs for mutating DOM wrappers by returning `this`
- Getter/setter overloads are intentional for methods like `.text()`, `.attr()`, `.css()`
- Public APIs should carry JSDoc, including `@example` where helpful
- Mark non-public helpers with `@internal`

## Security-critical rules

- **Security by default:** HTML-writing APIs sanitize untrusted content via `sanitizeHtml()`
- For trusted content, prefer explicit raw DOM escape hatches such as `.raw.innerHTML`
- In components, sanitize untrusted props before interpolating into HTML templates
- Be careful with parser-style code: linear scanners are preferred over regex-heavy approaches on untrusted template input
- Form serialization has security-sensitive edge cases; do not replace safe iteration with convenience abstractions without tests

## Coding patterns to preserve

- `$(selector)` returns `BQueryElement` and throws if not found
- `$$(selector)` returns `BQueryCollection` and does not throw for empty results
- Signal `.value` participates in tracking; `.peek()` reads without subscribing
- `computed()` is read-only; `linkedSignal()` is read-write
- `watchDebounce()` and `watchThrottle()` keep the same `(newValue, oldValue)` watcher callback shape as `watch()`
- Store actions mutate state through `this`, not external state parameters
- Component reactive helpers such as `useSignal()`, `useComputed()`, and `useEffect()` belong in lifecycle-safe contexts

## Testing conventions

- Tests use `bun:test`
- DOM tests rely on `happy-dom` via `tests/setup.ts`
- Preferred pattern: create DOM inline, assert behavior, clean up with `.remove()`
- Run Bun-based tests, not Node-based substitutes

## Common pitfalls

- `$()` throws for missing elements; use `$$()` for optional queries
- Forgetting sanitization when adding new HTML-writing helpers
- Accidentally subscribing to signals by reading `.value` where `.peek()` is intended
- Using arrow functions for store actions and losing the intended `this` context
- Forgetting that the view module uses `new Function()` and may require CSP `'unsafe-eval'`
- Adding a new public module without updating exports, builds, docs, and agent context

## Documentation map

Use these instead of re-explaining everything from scratch:

- `README.md` — public package overview and examples
- `AGENT.md` — deep reference for architecture and API surface
- `docs/guide/getting-started.md` — setup and first usage
- `docs/guide/api-core.md` — core DOM API patterns
- `docs/guide/*.md` — module-specific guides (`forms`, `i18n`, `a11y`, `dnd`, `media`, `plugin`, `devtools`, `testing`, `ssr`, etc.)
- `CONTRIBUTING.md` — contribution workflow and repo expectations

## Practical workflow for agents

1. Read the relevant module barrel and nearby implementation.
2. Confirm public surface in `package.json` exports and `src/full.ts` when needed.
3. Update tests with the change, especially for API or security-sensitive behavior.
4. Sync docs and context files for public-facing changes.
5. Prefer small, targeted edits over broad refactors.

When in doubt, use `AGENT.md` as the deep reference and keep this file compact.
