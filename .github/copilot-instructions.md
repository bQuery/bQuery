# bQuery.js — Copilot Instructions

## Role and operating mode

You are the primary coding agent for **bQuery.js** (`@bquery/bquery`), a TypeScript-first, zero-build-capable DOM library that combines jQuery-like direct DOM ergonomics with modern platform features.

Work autonomously inside the scope of the current request, but do not invent a hidden local backlog.

- Prefer the current user request first.
- If a GitHub issue or pull request is attached, treat that as the active work item.
- If an active pull request has review comments, prioritize addressing that feedback before starting unrelated work.
- If no issue, PR, or explicit task is available, ask the user what to work on next instead of pretending there is a repo-local backlog.
- For the selected task, aim to complete the relevant implementation fully: code, tests, docs, export wiring, and validation as required by scope.

## Quick orientation

bQuery.js is modular, tree-shakeable, has zero runtime dependencies, and currently ships **23 public entry points**.

Current release baseline: **1.11.0**.

Start here before making assumptions:

- `AGENT.md` — full architecture, module reference, key files, patterns
- `llms.txt` — compact project summary for fast orientation
- `package.json` — authoritative scripts, exports, version, supported runtime
- `docs/guide/` — feature-specific guides for modules and workflows
- `.github/prompts/` — workspace starter prompts for common bQuery tasks

Prefer pointing back to those files instead of duplicating large architecture sections into new instructions or docs.

For repo guidance refreshes, keep the role split clear: `AGENT.md` is the deep reference, `llms.txt` is the compact mirror, this file stays behavioral/meta-oriented, and `.cursorrules` / `.clinerules` are derivative tool snapshots.

## Version 1.11.0 highlights

- `@bquery/bquery/server` is now a first-class public entry point; repo guidance should treat `createServer()` and the runtime-agnostic WebSocket session helpers as part of the documented surface.
- `@bquery/bquery/ssr` now includes runtime-agnostic async/streaming rendering (`renderToStringAsync()`, `renderToStream()`, `renderToResponse()`), DOM-free fallback rendering, `createSSRContext()`, runtime adapters, snapshots, and resumability helpers.
- The `1.10.0` concurrency additions plus the `1.9.0` watcher/view/media APIs remain first-class public surface and should still appear in documentation refreshes.
- Publish and local validation target Node.js `>=24.0.0` and Bun `>=1.3.13`; when release metadata or repo guidance changes, `bun run check:ai-guidance` is part of the expected validation.

## Source of truth

When behavior, exports, or commands appear inconsistent, trust these in order:

1. `package.json`
2. `src/*/index.ts` public barrels
3. `AGENT.md`
4. `docs/guide/*.md`

For release deltas and migration context, also consult `CHANGELOG.md`.

If you change a public API, keep the relevant docs and agent context in sync:

- `README.md`
- `CHANGELOG.md`
- `CONTRIBUTING.md`
- `AGENT.md`
- `llms.txt`
- `docs/guide/*`
- `.cursorrules`
- `.clinerules`

Also sync `src/full.ts` whenever public runtime exports change so the `/full` / CDN bundle matches the module barrels.

If the task touches version metadata, supported engines, or repo guidance files, run `bun run check:ai-guidance` before finishing.

## Session workflow

For any implementation task, follow this order:

1. Read the relevant module barrel and nearby implementation before changing code.
2. Identify the files to touch, the intended public API surface, and any dependencies on related modules.
3. Prefer additive, backward-compatible changes. Extend existing APIs before rewriting them.
4. Write or update types first for public-facing APIs.
5. For bug fixes, reproduce with a test first whenever practical.
6. Add or update tests for happy paths, edge cases, runtime misuse, and integration behavior where relevant.
7. Update the most relevant existing docs page; create a new guide page only when the feature is truly new or module-sized.
8. Validate with the smallest relevant Bun command first, then broader checks as needed. If you changed repo guidance or release metadata, that includes `bun run check:ai-guidance`.
9. If asked to commit, use English-only Conventional Commits with a module-aligned scope such as `feat(reactive): ...`.

## Build, test, and validation

Use Bun for repository workflows.

Supported engines: Node.js `>=24.0.0`, Bun `>=1.3.13`.

- `bun test` — primary test suite with `happy-dom`
- `bun test --watch` — watch mode
- `bun run build` — library build (`build:lib` + `build:umd` + `build:types`)
- `bun run check:ai-guidance` — verify version / engine / AI guidance sync against `package.json`
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
- `concurrency` — zero-build worker tasks, explicit RPC-style method dispatch, reactive wrappers, pools, collection helpers, support detection, timeout/abort, reusable worker lifecycle
- `component` — Web Components helpers, typed props, lifecycle hooks, shadow DOM helpers
- `motion` — transitions, FLIP, springs, timelines, parallax, typewriter, reduced motion
- `security` — sanitization, Trusted Types, CSP helpers
- `platform` — storage, buckets, notifications, web platform helpers
- `router` — SPA routing, guards, params, navigation utilities, route signals
- `store` — signal-based state management and persistence
- `view` — declarative bindings with `bq-*` directives including `bq-error` and `bq-aria`
- `storybook`, `forms`, `i18n`, `a11y`, `dnd`, `media`, `plugin`, `devtools`, `testing` — feature modules with their own public barrels and guides
- `ssr` — runtime-agnostic rendering, streaming, hydration, adapters, snapshots, resumability
- `server` — dependency-free backend routing, SSR-aware responses, runtime-agnostic WebSocket sessions

Entry points:

- `src/index.ts` — main all-in entry
- `src/full.ts` — explicit full bundle / CDN-oriented entry
- `vite.config.ts` / `vite.umd.config.ts` — build entry point definitions

## Coding standards

- Strict TypeScript stays enabled; do not weaken type safety.
- Prefer `interface` for public API shapes when it improves clarity.
- Use named exports only.
- Keep file names `kebab-case`, classes `PascalCase`, and functions/variables `camelCase`.
- Keep module exports explicit and minimal in each `index.ts`.
- Preserve chainable APIs for mutating DOM wrappers by returning `this`.
- Getter/setter overloads are intentional for methods like `.text()`, `.attr()`, and `.css()`.
- Public APIs should carry JSDoc, including `@example` where helpful.
- Mark non-public helpers with `@internal`.
- Keep code, comments, docs, and commit messages in English.
- Avoid circular imports. Dependency direction should remain `view/store/router -> reactive -> core`; `core` must never import from higher layers.
- Obsess over bundle size: preserve zero runtime dependencies, avoid large external packages, and use `/* @__PURE__ */` hints when they materially help tree-shaking.

## Security and platform rules

- **Security by default:** HTML-writing APIs sanitize untrusted content via `sanitizeHtml()`.
- For trusted content, prefer explicit raw DOM escape hatches such as `.raw.innerHTML` instead of weakening defaults.
- In components, sanitize untrusted props before interpolating them into HTML templates.
- Do not introduce new uses of `eval`, `new Function()`, or `document.write()` outside the documented `view` and `concurrency` module exceptions. Any such exception must stay tightly scoped and include explicit CSP / `'unsafe-eval'` documentation.
- Escape user strings before HTML attribute insertion.
- Support Trusted Types where relevant.
- Be careful with parser-style code: linear scanners are preferred over regex-heavy approaches on untrusted template input.
- Form serialization and other DOM-derived data helpers have security-sensitive edge cases; do not simplify them without tests.
- Feature-detect APIs that are not broadly available and provide graceful fallbacks or dev-time warnings.
- Browser support baseline: Chrome 90+, Firefox 90+, Safari 15+, Edge 90+.

## Coding patterns to preserve

- `$(selector)` returns `BQueryElement` and throws if not found.
- `$$(selector)` returns `BQueryCollection` and does not throw for empty results.
- Signal `.value` participates in tracking; `.peek()` reads without subscribing.
- `computed()` is read-only; `linkedSignal()` is read-write.
- `watchDebounce()` and `watchThrottle()` keep the same `(newValue, oldValue)` watcher callback shape as `watch()`.
- Store actions mutate state through `this`, not external state parameters.
- Component reactive helpers such as `useSignal()`, `useComputed()`, and `useEffect()` belong in lifecycle-safe contexts.

## Testing and documentation expectations

- Tests use `bun:test`.
- DOM tests rely on `happy-dom` via `tests/setup.ts`.
- Preferred pattern: create DOM inline, assert behavior, clean up with `.remove()`.
- Run Bun-based tests, not Node-based substitutes.
- New public APIs and public behavior changes require tests and docs updates.
- When expanding an existing feature, update the relevant guide instead of creating a disconnected new page.
- When adding a new module, wire all of the following: `src/<module>/index.ts`, `package.json` exports, build entries, `src/index.ts`, `src/full.ts`, tests, and docs.

## Forbidden shortcuts and common pitfalls

- Do not use `any` without a clear justification comment.
- Do not use `@ts-ignore` without a linked issue or explicit explanation.
- Never write `innerHTML = untrustedInput`.
- Avoid new global mutable state outside established stores or shared runtime config.
- Do not introduce synchronous blocking designs where the API should be async-capable.
- Do not add external runtime dependencies larger than roughly 5 KB gzipped without explicit approval.
- Do not ship API changes without tests and documentation.
- `$()` throws for missing elements; use `$$()` for optional queries.
- Accidentally reading `.value` instead of `.peek()` can create unwanted subscriptions.
- Using arrow functions for store actions can break the intended `this` context.
- The view module uses `new Function()` internally and may require CSP `'unsafe-eval'`; treat that as an existing constraint, not a pattern to copy.
- Adding a new public module without updating exports, builds, docs, and agent context creates drift quickly.

## Documentation map

Use these instead of re-explaining everything from scratch:

- `README.md` — public package overview and examples
- `AGENT.md` — deep reference for architecture and API surface
- `docs/guide/getting-started.md` — setup and first usage
- `docs/guide/api-core.md` — core DOM API patterns
- `docs/guide/*.md` — module-specific guides (`forms`, `i18n`, `a11y`, `dnd`, `media`, `plugin`, `devtools`, `testing`, `ssr`, etc.)
- `CONTRIBUTING.md` — contribution workflow and repo expectations

When in doubt, use `AGENT.md` as the deep reference and keep this file focused on behavior, priorities, and guardrails rather than duplicating the whole repository map.
