# Build a Web Component library

How to ship a reusable Web Component library with [Component](/guide/components), [Storybook](/guide/storybook), and [Testing](/guide/testing). The same pattern scales from a single `<my-button>` to a full design system.

## 1. Define a component

```ts
// src/button.ts
import { defineComponent, css } from '@bquery/bquery/component';
import { signal } from '@bquery/bquery/reactive';

defineComponent('ds-button', {
  props: { variant: { type: 'string', default: 'primary' } },
  styles: css`
    button {
      font: inherit;
      padding: 0.5em 1em;
      border-radius: 6px;
      border: 1px solid currentColor;
      cursor: pointer;
    }
    button[data-variant='primary'] { background: var(--accent, #0b5fff); color: white; border-color: transparent; }
    button[data-variant='ghost']   { background: transparent; }
  `,
  setup({ props, on }) {
    const pressed = signal(false);
    on('click', () => (pressed.value = !pressed.value));
    return ({ html }) => html`
      <button data-variant=${props.variant} aria-pressed=${pressed.value}>
        <slot></slot>
      </button>
    `;
  },
});
```

## 2. Write a Storybook story

```ts
// stories/button.stories.ts
import type { StoryObj } from '@storybook/web-components';
import { classMap, storyText } from '@bquery/bquery/storybook';

import '../src/button';

export default { title: 'Button', tags: ['autodocs'] };

export const Primary: StoryObj = {
  render: (args) => `
    <ds-button variant=${args.variant} class=${classMap({ block: args.block })}>
      ${storyText(args.label)}
    </ds-button>
  `,
  args: { variant: 'primary', label: 'Click me', block: false },
};

export const Ghost: StoryObj = {
  ...Primary,
  args: { variant: 'ghost', label: 'Cancel', block: false },
};
```

`storyText()` escapes user-controlled label content; `classMap()` accepts reactive booleans without leaking string templates.

## 3. Test the component

```ts
// tests/button.test.ts
import { describe, expect, it } from 'bun:test';
import { renderComponent, screen, userEvent, expectAccessible } from '@bquery/bquery/testing';

import '../src/button';

describe('<ds-button>', () => {
  it('toggles aria-pressed on click', async () => {
    const { unmount } = renderComponent('<ds-button>Save</ds-button>');
    const btn = await screen.findByRole('button', { name: 'Save' });

    expect(btn.getAttribute('aria-pressed')).toBe('false');
    await userEvent.click(btn);
    expect(btn.getAttribute('aria-pressed')).toBe('true');

    await expectAccessible(btn);
    unmount();
  });
});
```

## 4. Package as a library

In `package.json`:

```json
{
  "name": "@acme/ds",
  "type": "module",
  "exports": {
    ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" },
    "./button": { "import": "./dist/button.js", "types": "./dist/button.d.ts" }
  },
  "sideEffects": ["./dist/button.js"]
}
```

Mark per-component entries as `sideEffects: true` so bundlers preserve the `customElements.define()` call.

## What you exercised

- **Adoptable stylesheets** via `css` ship one shared `CSSStyleSheet` across every instance.
- **Slot projection** keeps content composable while shadow DOM contains styles.
- **Stories** double as visual documentation and integration tests.
- **Accessibility-first queries** (`screen.findByRole`, `expectAccessible`) catch regressions early.

## Next steps

- Add a [theme switcher](/cookbook/theme-switcher) using `prefersColorScheme` from [Media](/guide/media).
- Document API tables in each Story's `parameters.docs.description`.
- Publish per-component entries so consumers can tree-shake to just the elements they use.
