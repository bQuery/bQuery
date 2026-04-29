import { defineConfig } from 'vitepress';

export default defineConfig({
  lang: 'en-US',
  title: 'bQuery.js',
  description: 'The jQuery for the modern Web Platform.',
  base: process.env.VITEPRESS_BASE ?? '/',
  head: [
    ['link', { rel: 'icon', href: '/assets/bquerry-logo.svg' }],
  ],
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
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/guide/api-core' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Examples & Recipes', link: '/guide/examples' },
            { text: 'FAQ & Troubleshooting', link: '/guide/faq' },
            { text: 'Migrating from jQuery', link: '/guide/migration' },
            { text: 'Best Practices', link: '/guide/best-practices' },
          ],
        },
        {
          text: 'Modules',
          items: [
            { text: 'Core API', link: '/guide/api-core' },
            { text: 'Agents', link: '/guide/agents' },
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
          ],
        },
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/bQuery/bQuery' },
    ],
  },
});
