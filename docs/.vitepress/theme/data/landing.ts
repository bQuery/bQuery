/**
 * Content for the landing page.
 *
 * Kept as data rather than markup so the copy stays reviewable in one place
 * and the components stay layout-only.
 *
 * Every `link` here must resolve to a real page. VitePress only validates
 * links it finds in markdown, so these are outside the docs build's dead-link
 * check — `bun run check:theme-links` covers them instead.
 *
 * Whether a link is external is derived from the URL by `isExternal()`; there
 * is deliberately no per-entry flag to fall out of sync with it.
 */

export interface SpecItem {
  value: string;
  label: string;
}

export interface ModuleEntry {
  name: string;
  blurb: string;
  link: string;
}

export interface ModuleLayer {
  index: string;
  label: string;
  note: string;
  modules: ModuleEntry[];
}

export interface FeatureEntry {
  title: string;
  details: string;
  link?: string;
}

export interface StartPath {
  goal: string;
  targets: { text: string; link: string }[];
}

export interface FlowNode {
  call: string;
  role: string;
}

export interface CtaAction {
  text: string;
  link: string;
  theme?: 'brand' | 'ghost';
}

export interface FooterColumn {
  label: string;
  links: { text: string; link: string }[];
}

/** The numbers that actually matter when you are sizing up a framework. */
export const specs: SpecItem[] = [
  { value: '0', label: 'runtime dependencies' },
  { value: '23', label: 'tree-shakeable entry points' },
  { value: '0', label: 'mandatory build steps' },
  { value: '4', label: 'server runtimes' },
];

/**
 * The public surface, grouped by the layer it belongs to. The names match the
 * `exports` map in package.json — `@bquery/bquery/<name>`.
 */
export const moduleLayers: ModuleLayer[] = [
  {
    index: '01',
    label: 'Foundation',
    note: 'DOM, reactivity, threads, sanitization',
    modules: [
      { name: 'core', blurb: 'Selectors, traversal, events, utilities', link: '/guide/api-core' },
      {
        name: 'reactive',
        blurb: 'Signals, computed, watch, async data, HTTP',
        link: '/guide/reactive',
      },
      {
        name: 'concurrency',
        blurb: 'Worker tasks, RPC, pools, UI scheduling',
        link: '/guide/concurrency',
      },
      {
        name: 'security',
        blurb: 'Sanitization and Trusted Types plumbing',
        link: '/guide/security',
      },
    ],
  },
  {
    index: '02',
    label: 'Interface',
    note: 'Components, directives, motion, input',
    modules: [
      {
        name: 'component',
        blurb: 'Typed Web Components, slots, refs, lifecycle',
        link: '/guide/components',
      },
      { name: 'view', blurb: 'Declarative bq-* directives', link: '/guide/view' },
      {
        name: 'view/compiler',
        blurb: 'Precompiles expressions — no unsafe-eval',
        link: '/guide/view',
      },
      { name: 'motion', blurb: 'Springs, tweens, FLIP, timelines', link: '/guide/motion' },
      { name: 'dnd', blurb: 'Draggable, droppable, sortable, keyboard', link: '/guide/dnd' },
      { name: 'media', blurb: 'Viewport, network, clipboard, prefs', link: '/guide/media' },
      { name: 'storybook', blurb: 'Sanitization-safe story helpers', link: '/guide/storybook' },
    ],
  },
  {
    index: '03',
    label: 'Application',
    note: 'Routing, state, forms, locale, a11y',
    modules: [
      { name: 'router', blurb: 'SPA routing, guards, navigation results', link: '/guide/router' },
      { name: 'store', blurb: 'Signal-based state with persistence', link: '/guide/store' },
      { name: 'forms', blurb: 'Reactive fields, validators, schema', link: '/guide/forms' },
      { name: 'i18n', blurb: 'Locale negotiation, ICU, Intl formatting', link: '/guide/i18n' },
      { name: 'i18n/extract', blurb: 'Message extraction API and CLI', link: '/guide/i18n' },
      { name: 'a11y', blurb: 'Focus traps, live regions, WCAG audits', link: '/guide/a11y' },
      { name: 'platform', blurb: 'Storage, cache, cookies, page meta', link: '/guide/platform' },
      { name: 'plugin', blurb: 'Hooks, DI, namespaced directives', link: '/guide/plugin' },
    ],
  },
  {
    index: '04',
    label: 'Server',
    note: 'Node, Bun, Deno, edge',
    modules: [
      { name: 'ssr', blurb: 'Render, stream, hydrate, resume', link: '/guide/ssr' },
      {
        name: 'server',
        blurb: 'Routing, sessions, CSRF, WebSockets',
        link: '/guide/server',
      },
    ],
  },
  {
    index: '05',
    label: 'Toolchain',
    note: 'Inspect and verify',
    modules: [
      { name: 'devtools', blurb: 'Timeline, signal/store diffs, perf', link: '/guide/devtools' },
      { name: 'testing', blurb: 'Mounts, screen, userEvent, mocks', link: '/guide/testing' },
    ],
  },
];

/** The reactive pipeline, from a write to the DOM. */
export const flowNodes: FlowNode[] = [
  { call: 'signal()', role: 'writable source' },
  { call: 'computed()', role: 'derived, cached' },
  { call: 'effect()', role: 're-runs on change' },
  { call: '$(el)', role: 'typed DOM write' },
];

export const features: FeatureEntry[] = [
  {
    title: 'Zero build',
    details:
      'Load ES modules from a CDN and ship. Vite, Rollup and friends stay optional — never a prerequisite.',
    link: '/guide/getting-started',
  },
  {
    title: 'Fine-grained reactivity',
    details:
      'Signals, computed values, scopes, batching, debounced and throttled watchers. No virtual DOM, no diffing pass.',
    link: '/guide/reactive',
  },
  {
    title: 'Realtime and HTTP',
    details:
      'HTTP client, request dedup, polling, pagination, WebSocket and SSE composables, REST helpers.',
    link: '/guide/reactive',
  },
  {
    title: 'Web Components',
    details:
      'Typed custom elements with scoped reactivity, slots, refs and lifecycle hooks — plus a previewable default library.',
    link: '/guide/components',
  },
  {
    title: 'Secure by default',
    details:
      'Every HTML-writing API sanitizes untrusted input. Trusted Types and CSP-friendly patterns ship in the box.',
    link: '/concepts/security-model',
  },
  {
    title: 'Off the main thread',
    details:
      'Zero-build worker tasks, RPC helpers, bounded pools, reactive worker state and CSP-safe module workers.',
    link: '/guide/concurrency',
  },
  {
    title: 'Router and store',
    details:
      'SPA routing with guards and typed navigation results, plus signal-based state with persistence and plugins.',
    link: '/guide/router',
  },
  {
    title: 'Forms, i18n, a11y',
    details:
      'Reactive form state with schema validation, ICU messages and locale negotiation, focus traps and WCAG audits.',
    link: '/guide/forms',
  },
  {
    title: 'SSR and server',
    details:
      'Runtime-agnostic rendering and streaming, plus a dependency-free backend with sessions and WebSockets.',
    link: '/concepts/rendering-modes',
  },
  {
    title: 'Motion and drag',
    details:
      'Springs, tweens, FLIP, timelines and parallax; drag-and-drop with real keyboard accessibility.',
    link: '/guide/motion',
  },
  {
    title: 'Devtools and testing',
    details:
      'Timeline inspection, signal and store diffs, snapshot import/export, component mounts and userEvent helpers.',
    link: '/guide/testing',
  },
  {
    title: 'Predictable bundles',
    details:
      'Zero runtime dependencies, sideEffects: false, one entry point per module. The /full bundle is CDN-only.',
    link: '/concepts/bundle-and-tree-shaking',
  },
];

export const startPaths: StartPath[] = [
  {
    goal: 'Update the DOM reactively, without a build step',
    targets: [
      { text: 'core', link: '/guide/api-core' },
      { text: 'reactive', link: '/guide/reactive' },
    ],
  },
  {
    goal: 'Build a single-page app',
    targets: [
      { text: 'router', link: '/guide/router' },
      { text: 'store', link: '/guide/store' },
      { text: 'view', link: '/guide/view' },
    ],
  },
  {
    goal: 'Ship a Web Component library',
    targets: [
      { text: 'component', link: '/guide/components' },
      { text: 'storybook', link: '/guide/storybook' },
    ],
  },
  {
    goal: 'Render on the server and hydrate',
    targets: [
      { text: 'ssr', link: '/guide/ssr' },
      { text: 'server', link: '/guide/server' },
    ],
  },
  {
    goal: 'Handle forms, locales and accessibility',
    targets: [
      { text: 'forms', link: '/guide/forms' },
      { text: 'i18n', link: '/guide/i18n' },
      { text: 'a11y', link: '/guide/a11y' },
    ],
  },
  {
    goal: 'Move expensive work off the main thread',
    targets: [{ text: 'concurrency', link: '/guide/concurrency' }],
  },
  {
    goal: 'Port an existing jQuery codebase',
    targets: [{ text: 'migration guide', link: '/guide/migration' }],
  },
  {
    goal: 'Point an AI agent at the codebase',
    targets: [{ text: 'agents', link: '/guide/agents' }],
  },
];

/** Closing call to action, below the routing table. */
export const ctaActions: CtaAction[] = [
  { text: 'get started', link: '/guide/getting-started', theme: 'brand' },
  { text: 'build the tutorial app', link: '/guide/tutorial' },
  { text: 'browse the cookbook', link: '/cookbook/' },
];

export const footerColumns: FooterColumn[] = [
  {
    label: 'Learn',
    links: [
      { text: 'Introduction', link: '/introduction' },
      { text: 'Getting started', link: '/guide/getting-started' },
      { text: 'Tutorial', link: '/guide/tutorial' },
      { text: 'Core concepts', link: '/concepts/architecture' },
      { text: 'Glossary', link: '/glossary' },
    ],
  },
  {
    label: 'Build',
    links: [
      { text: 'Full-stack workflows', link: '/workflows/' },
      { text: 'Cookbook', link: '/cookbook/' },
      { text: 'Examples', link: '/guide/examples' },
      { text: 'Best practices', link: '/guide/best-practices' },
      { text: 'Migrating from jQuery', link: '/guide/migration' },
    ],
  },
  {
    label: 'Reference',
    links: [
      { text: 'Release notes', link: '/release-notes/' },
      { text: 'Supported runtimes', link: '/concepts/runtimes' },
      { text: 'Security model', link: '/concepts/security-model' },
      { text: 'FAQ', link: '/guide/faq' },
    ],
  },
  {
    label: 'Project',
    links: [
      { text: 'Contributing', link: '/contributing/' },
      { text: 'Repository', link: 'https://github.com/bQuery/bQuery' },
      { text: 'Issues', link: 'https://github.com/bQuery/bQuery/issues' },
      { text: 'npm package', link: 'https://www.npmjs.com/package/@bquery/bquery' },
    ],
  },
];
