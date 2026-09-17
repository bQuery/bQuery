import { defineConfig } from 'vitepress';

const SITE_URL = 'https://bquery.js.org';
const SOCIAL_CARD = '/assets/bquery-social-card.png';
const DESCRIPTION =
  'Batteries-included TypeScript framework for the modern web — signals, SSR, Web Components, routing, and more — with a jQuery-inspired API and zero mandatory build step.';

const introductionItems = [
  { text: 'What is bQuery?', link: '/introduction' },
  { text: 'Getting Started', link: '/guide/getting-started' },
  { text: 'Tutorial', link: '/guide/tutorial' },
  { text: 'Examples & Recipes', link: '/guide/examples' },
  { text: 'FAQ & Troubleshooting', link: '/guide/faq' },
  { text: 'Migrating from jQuery', link: '/guide/migration' },
  { text: 'Best Practices', link: '/guide/best-practices' },
  { text: 'Glossary', link: '/glossary' },
];

const conceptsItems = [
  { text: 'Architecture', link: '/concepts/architecture' },
  { text: 'Reactivity Model', link: '/concepts/reactivity-model' },
  { text: 'Rendering Modes', link: '/concepts/rendering-modes' },
  { text: 'Security Model', link: '/concepts/security-model' },
  { text: 'Bundle & Tree-shaking', link: '/concepts/bundle-and-tree-shaking' },
  { text: 'Supported Runtimes', link: '/concepts/runtimes' },
];

const moduleItems = [
  { text: 'Core API', link: '/guide/api-core' },
  { text: 'Reactive', link: '/guide/reactive' },
  { text: 'Concurrency', link: '/guide/concurrency' },
  { text: 'Components', link: '/guide/components' },
  { text: 'Storybook', link: '/guide/storybook' },
  { text: 'Motion', link: '/guide/motion' },
  { text: 'Security', link: '/guide/security' },
  { text: 'Platform', link: '/guide/platform' },
  { text: 'Router', link: '/guide/router' },
  { text: 'File-based Routing', link: '/guide/file-routing' },
  { text: 'Store', link: '/guide/store' },
  { text: 'View', link: '/guide/view' },
  { text: 'Forms', link: '/guide/forms' },
  { text: 'i18n', link: '/guide/i18n' },
  { text: 'Accessibility', link: '/guide/a11y' },
  { text: 'Drag & Drop', link: '/guide/dnd' },
  { text: 'Media', link: '/guide/media' },
  { text: 'Plugin System', link: '/guide/plugin' },
  { text: 'Devtools', link: '/guide/devtools' },
  { text: 'Testing', link: '/guide/testing' },
  { text: 'SSR', link: '/guide/ssr' },
  { text: 'Server', link: '/guide/server' },
  { text: 'Agents', link: '/guide/agents' },
];

const workflowsItems = [
  { text: 'Overview', link: '/workflows/' },
  { text: 'Todo SPA', link: '/workflows/todo-spa' },
  { text: 'Web Component library', link: '/workflows/component-library' },
  { text: 'SSR + hydration (Node/Bun/Deno)', link: '/workflows/ssr-hydration' },
  { text: 'Streaming SSR', link: '/workflows/streaming-ssr' },
  { text: 'Backend API + WebSocket', link: '/workflows/backend-api' },
  { text: 'Forms + validation + i18n + a11y', link: '/workflows/forms-validation' },
  { text: 'Sortable lists with keyboard a11y', link: '/workflows/sortable-keyboard' },
  { text: 'Off-main-thread work', link: '/workflows/off-main-thread' },
];

const cookbookItems = [
  { text: 'Overview', link: '/cookbook/' },
  {
    text: 'Reactivity & async data',
    collapsed: true,
    items: [
      { text: 'Reactive counter', link: '/cookbook/reactive-counter' },
      { text: 'Debounced search input', link: '/cookbook/debounced-search' },
      { text: 'Polling for live data', link: '/cookbook/polling' },
      { text: 'Paginated data loading', link: '/cookbook/pagination' },
      { text: 'Infinite scroll', link: '/cookbook/infinite-scroll' },
    ],
  },
  {
    text: 'Realtime',
    collapsed: true,
    items: [
      { text: 'WebSocket with reconnect', link: '/cookbook/websocket-reconnect' },
      { text: 'Server-Sent Events stream', link: '/cookbook/sse-stream' },
    ],
  },
  {
    text: 'Components & UI',
    collapsed: true,
    items: [
      { text: 'Notification toast', link: '/cookbook/notification-toast' },
      { text: 'Modal dialog', link: '/cookbook/modal-dialog' },
      { text: 'Theme switcher', link: '/cookbook/theme-switcher' },
    ],
  },
  {
    text: 'Forms',
    collapsed: true,
    items: [{ text: 'Login form', link: '/cookbook/login-form' }],
  },
  {
    text: 'Routing & state',
    collapsed: true,
    items: [
      { text: 'Protected routes', link: '/cookbook/route-guards' },
      { text: 'Persisted store', link: '/cookbook/persisted-store' },
    ],
  },
  {
    text: 'Motion & DnD',
    collapsed: true,
    items: [
      { text: 'Scroll reveal', link: '/cookbook/scroll-reveal' },
      { text: 'Spring-based drag', link: '/cookbook/spring-drag' },
    ],
  },
  {
    text: 'i18n & a11y',
    collapsed: true,
    items: [{ text: 'RTL locale layout', link: '/cookbook/rtl-locale' }],
  },
  {
    text: 'Devtools & testing',
    collapsed: true,
    items: [
      { text: 'Trace a signal', link: '/cookbook/trace-signal' },
      { text: 'Mock fetch in tests', link: '/cookbook/mock-fetch-test' },
    ],
  },
  {
    text: 'Bundle & deploy',
    collapsed: true,
    items: [
      { text: 'Pick a sub-path import', link: '/cookbook/pick-subpath-import' },
      { text: 'Deploy SSR (Node/Bun/Deno)', link: '/cookbook/ssr-deploy' },
    ],
  },
];

const releaseNotesItems = [
  { text: 'Overview', link: '/release-notes/' },
  { text: '1.16.1', link: '/release-notes/1.16.1' },
  { text: '1.16.0', link: '/release-notes/1.16' },
  { text: '1.15.1', link: '/release-notes/1.15.1' },
  { text: '1.15.0', link: '/release-notes/1.15' },
  { text: '1.14.0', link: '/release-notes/1.14' },
];

const contributingItems = [
  { text: 'Contributing', link: '/contributing/' },
  { text: 'Repository Layout', link: '/contributing/repo-layout' },
  { text: 'Architecture', link: '/contributing/architecture' },
  { text: 'Testing Strategy', link: '/contributing/testing-strategy' },
  { text: 'Release Process', link: '/contributing/release-process' },
  { text: 'Agent Guide', link: '/contributing/agent-guide' },
  { text: 'Code of Conduct', link: '/contributing/code-of-conduct' },
  { text: 'Security Policy', link: '/contributing/security' },
];

const fullSidebar = [
  { text: 'Introduction', collapsed: false, items: introductionItems },
  { text: 'Core Concepts', collapsed: false, items: conceptsItems },
  { text: 'Modules', collapsed: false, items: moduleItems },
  { text: 'Full-Stack Workflows', collapsed: true, items: workflowsItems },
  { text: 'Cookbook', collapsed: true, items: cookbookItems },
  { text: 'Release Notes', collapsed: true, items: releaseNotesItems },
  { text: 'Reference & Contributing', collapsed: true, items: contributingItems },
];

export default defineConfig({
  lang: 'en-US',
  title: 'bQuery.js',
  description: DESCRIPTION,
  base: process.env.VITEPRESS_BASE ?? '/',
  cleanUrls: true,
  // TypeDoc emits its HTML reference into docs/api/ via `bun run docs:api`.
  // VitePress should not crawl those files; the API reference is linked as
  // an external sub-site instead.
  srcExclude: ['api/**', '**/node_modules/**'],
  ignoreDeadLinks: [
    // TypeDoc-emitted markdown sometimes ends up inside docs/api/; if any
    // straggler escapes srcExclude, never block the docs build on it.
    /^\/?api\//,
  ],
  head: [
    ['link', { rel: 'icon', href: '/assets/bquerry-logo.svg' }],
    ['meta', { name: 'google-site-verification', content: 'injOs87iZEPOqUJhHQiKuXhzvuD7XL4dyXxyDpx4Sx8' }],
    // IBM Plex: Sans for prose, Mono for every piece of metadata. The theme
    // falls back to the system stack if these never arrive.
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    [
      'link',
      {
        rel: 'stylesheet',
        href:
          'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600' +
          '&family=IBM+Plex+Sans:wght@400;500;600&display=swap',
      },
    ],
    ['meta', { name: 'theme-color', media: '(prefers-color-scheme: light)', content: '#fbfcfd' }],
    ['meta', { name: 'theme-color', media: '(prefers-color-scheme: dark)', content: '#0b1218' }],
    // Open Graph
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'bQuery.js' }],
    ['meta', { property: 'og:title', content: 'bQuery.js — the full-stack framework that speaks jQuery' }],
    ['meta', { property: 'og:description', content: DESCRIPTION }],
    ['meta', { property: 'og:url', content: SITE_URL }],
    ['meta', { property: 'og:image', content: `${SITE_URL}${SOCIAL_CARD}` }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    ['meta', { property: 'og:image:alt', content: 'bQuery.js — the full-stack framework that speaks jQuery' }],
    // Twitter
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: 'bQuery.js' }],
    ['meta', { name: 'twitter:description', content: DESCRIPTION }],
    ['meta', { name: 'twitter:image', content: `${SITE_URL}${SOCIAL_CARD}` }],
  ],
  sitemap: {
    hostname: SITE_URL,
  },
  markdown: {
    // Dimmed GitHub reads better against the theme's blue-tinted panels than
    // the high-contrast default does.
    theme: { light: 'github-light', dark: 'github-dark-dimmed' },
    config(md) {
      // These docs are full of wide API tables. Wrapping every table in a
      // scroll container lets the theme render real `display: table` layouts
      // (full width on desktop, swipeable on phones) instead of the shrink-to-
      // fit block tables the default stylesheet needs.
      const renderTableOpen = md.renderer.rules.table_open;
      md.renderer.rules.table_open = (tokens, idx, options, env, self) => {
        const table = renderTableOpen
          ? renderTableOpen(tokens, idx, options, env, self)
          : self.renderToken(tokens, idx, options);
        return `<div class="bq-table-scroll">${table}`;
      };

      const renderTableClose = md.renderer.rules.table_close;
      md.renderer.rules.table_close = (tokens, idx, options, env, self) => {
        const table = renderTableClose
          ? renderTableClose(tokens, idx, options, env, self)
          : self.renderToken(tokens, idx, options);
        return `${table}</div>`;
      };
    },
  },
  lastUpdated: true,
  vite: {
    build: {
      rollupOptions: {
        output: {
          // Use lowercase hashes to avoid case-sensitivity issues on some servers
          hashCharacters: 'hex',
        },
      },
    },
  },
  themeConfig: {
    logo: '/assets/bquerry-logo.svg',
    siteTitle: 'bQuery.js',
    externalLinkIcon: true,
    nav: [
      { text: 'Guide', link: '/guide/getting-started', activeMatch: '^/guide/' },
      { text: 'Concepts', link: '/concepts/architecture', activeMatch: '^/concepts/' },
      { text: 'Modules', link: '/guide/api-core', activeMatch: '^/guide/api-core' },
      { text: 'Workflows', link: '/workflows/', activeMatch: '^/workflows/' },
      { text: 'Cookbook', link: '/cookbook/', activeMatch: '^/cookbook/' },
      {
        text: 'Reference',
        items: [
          { text: 'Release Notes', link: '/release-notes/' },
          { text: 'Glossary', link: '/glossary' },
          { text: 'Contributing', link: '/contributing/' },
          { text: 'Changelog (GitHub)', link: 'https://github.com/bQuery/bQuery/blob/main/CHANGELOG.md' },
        ],
      },
    ],
    sidebar: {
      '/': fullSidebar,
      '/guide/': fullSidebar,
      '/concepts/': fullSidebar,
      '/workflows/': fullSidebar,
      '/cookbook/': fullSidebar,
      '/release-notes/': fullSidebar,
      '/contributing/': fullSidebar,
    },
    outline: { level: [2, 3], label: 'On this page' },
    search: {
      provider: 'local',
      options: {
        detailedView: true,
      },
    },
    editLink: {
      pattern: 'https://github.com/bQuery/bQuery/edit/main/docs/:path',
      text: 'Suggest an edit to this page',
    },
    lastUpdated: {
      text: 'Last updated',
      formatOptions: { dateStyle: 'medium' },
    },
    notFound: {
      code: '404',
      title: 'No matching route',
      quote:
        'The router found nothing at this path. The sidebar and the search box both know where everything lives.',
      linkLabel: 'Go to the home page',
      linkText: 'Back to the docs',
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/bQuery/bQuery' },
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present bQuery.js contributors',
    },
    docFooter: {
      prev: 'Previous',
      next: 'Next',
    },
  },
});
