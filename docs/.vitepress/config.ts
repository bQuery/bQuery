import { defineConfig } from 'vitepress';

const SITE_URL = 'https://bquery.js.org';
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

const workflowsItems = [{ text: 'Overview', link: '/workflows/' }];

const cookbookItems = [{ text: 'Overview', link: '/cookbook/' }];

const releaseNotesItems = [
  { text: 'Overview', link: '/release-notes/' },
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
    ['meta', { name: 'theme-color', content: '#0b5fff' }],
    // Open Graph
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'bQuery.js' }],
    ['meta', { property: 'og:title', content: 'bQuery.js — the full-stack framework that speaks jQuery' }],
    ['meta', { property: 'og:description', content: DESCRIPTION }],
    ['meta', { property: 'og:url', content: SITE_URL }],
    ['meta', { property: 'og:image', content: `${SITE_URL}/assets/bquerry-logo.svg` }],
    // Twitter
    ['meta', { name: 'twitter:card', content: 'summary' }],
    ['meta', { name: 'twitter:title', content: 'bQuery.js' }],
    ['meta', { name: 'twitter:description', content: DESCRIPTION }],
    ['meta', { name: 'twitter:image', content: `${SITE_URL}/assets/bquerry-logo.svg` }],
  ],
  sitemap: {
    hostname: SITE_URL,
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
    outline: { level: [2, 3] },
    search: {
      provider: 'local',
    },
    editLink: {
      pattern: 'https://github.com/bQuery/bQuery/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
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
