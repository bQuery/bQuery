import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { defaultComponentTags, wrapStory } from './shared';

type TextareaArgs = {
  label: string;
  value: string;
  placeholder: string;
  name: string;
  rows: number;
  disabled: boolean;
};

const render = (args: TextareaArgs): HTMLElement => {
  const element = document.createElement(defaultComponentTags.textarea);
  element.setAttribute('label', args.label);
  element.setAttribute('value', args.value);
  element.setAttribute('placeholder', args.placeholder);
  element.setAttribute('name', args.name);
  element.setAttribute('rows', String(args.rows));

  if (args.disabled) {
    element.setAttribute('disabled', 'true');
  }

  return wrapStory(element, '24rem');
};

const meta = {
  title: 'Components/Textarea',
  tags: ['autodocs'],
  args: {
    label: 'Project summary',
    value: 'Storybook now drives the component development workflow.',
    placeholder: 'Write a short summary',
    name: 'summary',
    rows: 4,
    disabled: false,
  },
  argTypes: {
    rows: { control: { type: 'number', min: 2, max: 8, step: 1 } },
    disabled: { control: 'boolean' },
  },
  render,
} satisfies Meta<TextareaArgs>;

export default meta;

type Story = StoryObj<TextareaArgs>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    value: '',
  },
};
