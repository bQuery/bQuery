# bQuery.js - Copilot Instructions

## Project Overview

bQuery.js is a TypeScript-first, zero-build-capable DOM library combining jQuery-style chainable APIs with modern features (reactivity, Web Components, animations, routing, state management, declarative views). The library is **modular** — users can import specific modules to minimize bundle size. Zero runtime dependencies.

## Architecture

### Module Structure (`src/`)

- **core/** — DOM selection (`$`, `$$`), manipulation, events (`BQueryElement`, `BQueryCollection`), utilities
- **reactive/** — Signals system (`signal`, `computed`, `effect`, `batch`, `watch`, `linkedSignal`, `persistedSignal`) for fine-grained reactivity
- **component/** — Web Components helper with typed props, shadow DOM, lifecycle hooks
- **motion/** — View Transitions API, FLIP animations, spring physics, timelines, scroll animations
- **security/** — HTML sanitization (enabled by default), Trusted Types, CSP support
- **platform/** — Storage adapters, caching, notifications, buckets
- **router/** — SPA routing with navigation guards, hash mode, reactive `currentRoute`
- **store/** — Signal-based state management with persistence, plugins, Pinia-style `defineStore`
- **view/** — Declarative DOM bindings with `bq-*` directives (`bq-text`, `bq-if`, `bq-for`, `bq-model`, etc.)

Entry points: `index.ts` (default exports all), `full.ts` (explicit full bundle)

### Key Design Patterns

1. **Security by default**: All `.html()` methods sanitize input via `sanitizeHtml()` from security module
2. **Chainable APIs**: Mutating methods return `this` for jQuery-style chaining
3. **Wrapper classes**: `BQueryElement` (single), `BQueryCollection` (multiple) wrap raw DOM elements
4. **Getter/setter overloading**: Methods like `.text()`, `.attr()`, `.css()` act as getters when called without args

## Build & Dev Commands (Bun)

```bash
bun install           # Install dependencies
bun test              # Run tests (uses happy-dom for DOM simulation)
bun test --watch      # Watch mode
bun run build         # Build library (lib + UMD + types)
bun run playground    # Start dev playground at playground/
bun run dev           # Start VitePress docs server
bun run lint          # ESLint with auto-fix
bun run lint:types    # TypeScript type checking only
bun run format        # Prettier formatting
bun run docs:api      # Generate TypeDoc API docs
bun run clean         # Remove dist/
```

## Testing Conventions

- Tests in `tests/` use **Bun's test runner** with `bun:test` imports
- DOM environment provided by `happy-dom` via `tests/setup.ts`
- Test file naming: `<module>.test.ts` (e.g., `core.test.ts`, `signal.test.ts`)
- Pattern: Create DOM elements inline, test wrapper methods, clean up with `.remove()`

```ts
import { describe, expect, it } from 'bun:test';
it('example', () => {
  const div = document.createElement('div');
  // test...
  div.remove();
});
```

## Code Patterns

### Module Exports

Each module has an `index.ts` that re-exports public APIs. Keep exports minimal and explicit.

### Selector Functions

- `$(selector)` → `BQueryElement` (throws if not found)
- `$$(selector)` → `BQueryCollection` (never throws, may be empty)

### Reactive Primitives

```ts
const count = signal(0); // Reactive value
const doubled = computed(() => count.value * 2); // Derived value
effect(() => console.log(count.value)); // Side effect
batch(() => {
  /* multiple updates, one notification */
});
```

### Security Integration

```ts
// HTML is always sanitized by default
$('#el').html('<script>bad</script>'); // Script stripped automatically

// For trusted content, use raw DOM
$('#el').raw.innerHTML = trustedContent;
```

### Component Definition

```ts
// Sanitize untrusted props before interpolating into html templates
component('my-element', {
  props: { name: { type: String, required: true } },
  styles: `.host { color: blue; }`,
  render: ({ props }) => html`<span>${sanitizeHtml(String(props.name))}</span>`,
});
```

### Router

```ts
const router = createRouter({
  routes: [
    { path: '/', component: Home },
    { path: '/user/:id', component: User },
  ],
});
router.beforeEach(async (to, from) => {
  /* guard */
});
await navigate('/user/42');
```

### Store

```ts
const store = createStore({
  id: 'counter',
  state: () => ({ count: 0 }),
  getters: { doubled: (s) => s.count * 2 },
  actions: {
    increment() {
      this.count++;
    },
  },
});
```

### View (Declarative Bindings)

```ts
import { mount } from '@bquery/bquery/view';
const count = signal(0);
mount('#app', { count, inc: () => count.value++ });
// HTML: <p bq-text="count"></p> <button bq-on:click="inc">+</button>
```

## Important Files

- `src/index.ts` - Default entry point — re-exports all modules
- `src/full.ts` - Full bundle with explicit named exports (CDN)
- `vite.config.ts` - Library build config with 11 entry points
- `vite.umd.config.ts` - UMD bundle for CDN/script tags
- `src/security/sanitize-core.ts` - Core sanitization logic
- `tests/setup.ts` - DOM polyfills for test environment
- `package.json` - Export maps, scripts, package metadata
- `tsconfig.json` - Strict TypeScript config (ES2020, Bundler)
- `AGENT.md` - Comprehensive AI agent guide
- `llms.txt` - LLM-optimized project summary

## Conventions

- **Strict TypeScript**: `strict: true`, no unused locals/params
- **Pure ESM**: `"type": "module"`, use `.mjs` extensions in dist
- **No side effects**: `"sideEffects": false` - tree-shakeable
- **JSDoc comments**: All public APIs have documentation with `@example` blocks
- **Internal markers**: Use `@internal` JSDoc tag for non-public helpers

## Common Pitfalls

1. Don't forget `$()` throws for missing elements — use `$$()` for optional queries
2. Always use `sanitizeHtml()` for any user HTML in new DOM-writing methods
3. Signal `.value` triggers tracking — use `.peek()` to read without subscribing
4. Test with `bun test`, not Node — Bun-specific APIs are used
5. View module uses `new Function()` → requires `'unsafe-eval'` in CSP
6. `linkedSignal` is read-write; `computed` is read-only
7. Store actions access state via `this` (not a parameter)
8. Component render output is auto-sanitized — use `.raw` for trusted content

## AI Agent Resources

- **AGENT.md** - Full architecture reference, module API tables, common tasks
- **llms.txt** - Compact LLM-readable project summary
- **This file** - GitHub Copilot context (auto-loaded in VS Code)
