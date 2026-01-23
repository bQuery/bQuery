import { defineConfig } from 'vitepress';

export default defineConfig({
  lang: 'en-US',
  title: 'bQuery.js',
  description: 'The jQuery for the modern Web Platform.',
  base: process.env.VITEPRESS_BASE ?? '/',
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
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/guide/api-core' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Core API', link: '/guide/api-core' },
            { text: 'Agents', link: '/guide/agents' },
            { text: 'Reactive', link: '/guide/reactive' },
            { text: 'Components', link: '/guide/components' },
            { text: 'Motion', link: '/guide/motion' },
            { text: 'Security', link: '/guide/security' },
            { text: 'Platform', link: '/guide/platform' },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/bQuery/bQuery' },
    ],
  },
});
