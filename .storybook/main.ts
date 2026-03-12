import type { StorybookConfig } from '@storybook/web-components-vite';

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.ts'],
  addons: ['@storybook/addon-docs'],
  framework: '@storybook/web-components-vite',
  docs: {
    autodocs: 'tag',
  },
};

export default config;
