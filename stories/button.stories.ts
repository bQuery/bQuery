import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { defaultComponentTags } from './shared';

type ButtonArgs = {
  label: string;
  variant: 'primary' | 'secondary';
  size: 'sm' | 'md' | 'lg';
  type: 'button' | 'submit';
  disabled: boolean;
};

const render = (args: ButtonArgs): HTMLElement => {
  const element = document.createElement(defaultComponentTags.button);
  element.setAttribute('variant', args.variant);
  element.setAttribute('size', args.size);
  element.setAttribute('type', args.type);

  if (args.disabled) {
    element.setAttribute('disabled', 'true');
  }

  element.setAttribute('label', args.label);
  return element;
};

const meta = {
  title: 'Components/Button',
  tags: ['autodocs'],
  args: {
    label: 'Continue',
    variant: 'primary',
    size: 'md',
    type: 'button',
    disabled: false,
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary'] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    type: { control: 'inline-radio', options: ['button', 'submit'] },
    disabled: { control: 'boolean' },
  },
  render,
} satisfies Meta<ButtonArgs>;

export default meta;

type Story = StoryObj<ButtonArgs>;

export const Primary: Story = {};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    label: 'Secondary action',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
