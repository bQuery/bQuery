# Repository Layout

This is the directory map of the bQuery.js monorepo. Use it alongside the [Architecture](/contributing/architecture) page when navigating the codebase.

## Top-level layout

```
bQuery/
├── src/                # framework source — every public module lives here
├── tests/              # test suite (bun:test + happy-dom)
├── docs/               # VitePress documentation site (this site)
├── examples/           # runnable SSR examples (Node / Bun / Deno)
├── stories/            # Storybook stories for the default component library
├── scripts/            # repo-local validation scripts
├── assets/             # repo assets (logo source files)
├── .github/            # workflows, issue templates, PR template, prompts
├── .storybook/         # Storybook configuration
├── package.json        # exports map, scripts, engines, devDependencies
├── typedoc.json        # API reference configuration
├── vite.config.ts      # ESM build entry
├── vite.umd.config.ts  # UMD/CDN build entry
├── tsconfig*.json      # TypeScript configurations (build, tests, components)
├── eslint.config.js    # ESLint flat config
├── AGENT.md            # deep architectural reference
├── README.md           # public package overview
├── CONTRIBUTING.md     # canonical contributing guide
├── CHANGELOG.md        # release history
├── llms.txt            # compact project summary for LLM/agent consumers
├── CNAME               # docs custom domain (bquery.js.org)
└── LICENSE.md
```

## `src/` — framework modules

Every public module is a directory under `src/` with its own `index.ts` barrel:

```
src/
├── core/         # $, $$, DOM wrappers, traversal, events, utils
├── reactive/     # signals, async data, HTTP, realtime, REST
├── concurrency/  # worker tasks, RPC, pools
├── component/    # Web Components
├── motion/       # transitions, springs, tweens, timelines
├── security/     # sanitize, escape, Trusted Types
├── platform/     # storage, cache, cookies, page meta
├── router/       # SPA routing
├── store/        # state management
├── view/         # bq-* directives
├── forms/        # reactive forms
├── i18n/         # locale, Intl
├── a11y/         # focus, live regions, audits
├── dnd/          # draggable, sortable
├── media/        # viewport, network, clipboard
├── plugin/       # hooks, DI, namespaced directives
├── devtools/     # timeline, diffs, traces
├── testing/      # screen, userEvent, mocks
├── ssr/          # runtime-agnostic rendering
├── server/       # dependency-free backend
├── storybook/    # safe story helpers
├── index.ts      # root entry — curated re-exports
└── full.ts       # full entry — every public export (CDN)
```

## `tests/` — test suite

Tests live next to each other in `tests/`, named `<topic>.test.ts`. Setup runs in `tests/setup.ts` and configures `happy-dom`. See [Testing Strategy](/contributing/testing-strategy).

## `docs/` — documentation site

```
docs/
├── .vitepress/         # config, snippets
├── public/             # static assets served at the site root
├── concepts/           # cross-cutting concept pages
├── guide/              # module guides (one per public module)
├── workflows/          # full-stack tutorial pages
├── cookbook/           # short recipes
├── release-notes/      # per-minor release notes
├── contributing/       # contributor-facing pages
├── introduction.md     # what / why / stability
├── glossary.md         # term glossary
└── index.md            # landing page
```

## `examples/` — runnable apps

```
examples/
├── shared/      # shared bits across runtime adapters
├── ssr-node/    # SSR adapter on Node
├── ssr-bun/     # SSR adapter on Bun
├── ssr-deno/    # SSR adapter on Deno
└── README.md
```

These are the _canonical_ SSR samples. PRs that touch SSR / server should keep these compiling and running.

## `scripts/` — repo-local checks

- `check-ai-guidance.mjs` — verifies version, engines, and AI-guidance docs stay in sync.
- `check-full-bundle.mjs` — verifies `src/full.ts` re-exports every public surface.

Both are invoked via `bun run check:ai-guidance` and `bun run check:full-bundle`.

## See also

- [Architecture](/contributing/architecture)
- [Testing Strategy](/contributing/testing-strategy)
- [Release Process](/contributing/release-process)
