import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { defaultComponentTags, wrapStory } from './shared';

type CheckboxArgs = {
  label: string;
  checked: boolean;
  disabled: boolean;
};

const render = (args: CheckboxArgs): HTMLElement => {
  const element = document.createElement(defaultComponentTags.checkbox);
  element.setAttribute('label', args.label);

  if (args.checked) {
    element.setAttribute('checked', 'true');
  }

  if (args.disabled) {
    element.setAttribute('disabled', 'true');
  }

  return wrapStory(element, '18rem');
};

const meta = {
  title: 'Components/Checkbox',
  tags: ['autodocs'],
  args: {
    label: 'Enable notifications',
    checked: false,
    disabled: false,
  },
  argTypes: {
    checked: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
  render,
} satisfies Meta<CheckboxArgs>;

export default meta;

type Story = StoryObj<CheckboxArgs>;

export const Default: Story = {};

export const Checked: Story = {
  args: {
    checked: true,
  },
};
