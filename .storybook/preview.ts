import type { Preview } from '@storybook/web-components-vite';
import './preview.css';

const preview: Preview = {
  parameters: {
    layout: 'centered',
    controls: {
      expanded: true,
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
