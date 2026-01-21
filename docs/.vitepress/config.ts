import { defineConfig } from 'vitepress';

export default defineConfig({
  lang: 'en-US',
  title: 'bQuery.js',
  description: 'The jQuery for the modern Web Platform.',
  lastUpdated: true,
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
            { text: 'Reactive', link: '/guide/reactive' },
            { text: 'Components', link: '/guide/components' },
            { text: 'Motion', link: '/guide/motion' },
            { text: 'Security', link: '/guide/security' },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/your-org/bquery' },
    ],
  },
});
