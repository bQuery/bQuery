# Notification toast component

**Problem.** Reusable toast Web Component with auto-dismiss and reduced-motion respect.

**Solution.** Define a [Component](/guide/components) with [`css`](/guide/components) styles and [Motion](/guide/motion) helpers.

```ts
import { defineComponent, css, useSignal, useEffect } from '@bquery/bquery/component';
import { animate } from '@bquery/bquery/motion';
import { prefersReducedMotion } from '@bquery/bquery/a11y';

defineComponent('ds-toast', {
  props: { duration: { type: 'number', default: 3000 }, message: { type: 'string', default: '' } },
  styles: css`
    :host { position: fixed; bottom: 1rem; right: 1rem; background: #222; color: white;
            padding: .75rem 1rem; border-radius: 6px; opacity: 0; }
    :host([open]) { opacity: 1; }
  `,
  setup({ props, host }) {
    const open = useSignal(true);
    useEffect(() => {
      host.toggleAttribute('open', open.value);
      if (!prefersReducedMotion.value) {
        animate(host, { transform: ['translateY(20px)', 'translateY(0)'] }, { duration: 180 });
      }
      const t = setTimeout(() => (open.value = false), props.duration);
      return () => clearTimeout(t);
    });
    return ({ html }) => html`<span role="status">${props.message}</span>`;
  },
});
```

**Why it works.** `role="status"` makes the message accessible without forcing focus; reduced-motion users skip the slide-in.

## Related

- [Components guide](/guide/components)
- [Motion — `animate`](/guide/motion)
- [A11y — `prefersReducedMotion`](/guide/a11y)
- Longer worked example: [Examples & Recipes — Notification toast](/guide/examples#a-notification-toast)
