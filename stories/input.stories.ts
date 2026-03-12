import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { defaultComponentTags, wrapStory } from './shared';

type InputArgs = {
  label: string;
  type: 'text' | 'email' | 'password';
  value: string;
  placeholder: string;
  name: string;
  disabled: boolean;
};

const render = (args: InputArgs): HTMLElement => {
  const element = document.createElement(defaultComponentTags.input);
  element.setAttribute('label', args.label);
  element.setAttribute('type', args.type);
  element.setAttribute('value', args.value);
  element.setAttribute('placeholder', args.placeholder);
  element.setAttribute('name', args.name);

  if (args.disabled) {
    element.setAttribute('disabled', 'true');
  }

  return wrapStory(element, '22rem');
};

const meta = {
  title: 'Components/Input',
  tags: ['autodocs'],
  args: {
    label: 'Email address',
    type: 'email',
    value: '',
    placeholder: 'name@example.com',
    name: 'email',
    disabled: false,
  },
  argTypes: {
    type: { control: 'inline-radio', options: ['text', 'email', 'password'] },
    disabled: { control: 'boolean' },
  },
  render,
} satisfies Meta<InputArgs>;

export default meta;

type Story = StoryObj<InputArgs>;

export const Default: Story = {};

export const Disabled: Story = {
  args: {
    disabled: true,
    value: 'disabled@example.com',
  },
};
