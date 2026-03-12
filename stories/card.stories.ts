import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { defaultComponentTags, wrapStory } from './shared';

type CardArgs = {
  title: string;
  footer: string;
  content: string;
  elevated: boolean;
};

const render = (args: CardArgs): HTMLElement => {
  const element = document.createElement(defaultComponentTags.card);
  element.setAttribute('title', args.title);
  element.setAttribute('footer', args.footer);
  element.setAttribute('elevated', String(args.elevated));
  element.textContent = args.content;
  return wrapStory(element, '24rem');
};

const meta = {
  title: 'Components/Card',
  tags: ['autodocs'],
  args: {
    title: 'Account overview',
    footer: 'Updated just now',
    content: 'Use the default card as a neutral surface for structured content.',
    elevated: true,
  },
  argTypes: {
    elevated: { control: 'boolean' },
  },
  render,
} satisfies Meta<CardArgs>;

export default meta;

type Story = StoryObj<CardArgs>;

export const Default: Story = {};

export const Flat: Story = {
  args: {
    elevated: false,
    footer: 'No elevation',
  },
};
