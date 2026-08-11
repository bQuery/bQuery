# Notification toast component

**Problem.** Reusable toast Web Component with auto-dismiss and reduced-motion respect.

**Solution.** Define a [Component](/guide/components) with [`css`](/guide/components) styles and [Motion](/guide/motion) helpers.

```ts
import { defineComponent, css, html } from '@bquery/bquery/component';
import { animate } from '@bquery/bquery/motion';
import { prefersReducedMotion } from '@bquery/bquery/a11y';

defineComponent('ds-toast', {
  props: { duration: { type: Number, default: 3000 }, message: { type: String, default: '' } },
  state: { open: true },
  styles: css`
    :host {
      position: fixed;
      bottom: 1rem;
      right: 1rem;
      background: #222;
      color: white;
      padding: 0.75rem 1rem;
      border-radius: 6px;
      display: none;
    }
    :host([open]) {
      display: block;
    }
  `,
  connected() {
    this.toggleAttribute('open', true);

    const reducedMotion = prefersReducedMotion();
    if (!reducedMotion.value) {
      animate(this, { transform: ['translateY(20px)', 'translateY(0)'] }, { duration: 180 });
    }
    reducedMotion.destroy();

    const host = this as HTMLElement & { dismissTimer?: ReturnType<typeof setTimeout> };
    host.dismissTimer = setTimeout(
      () => this.setState('open', false),
      this.getProp<number>('duration')
    );
  },
  updated() {
    this.toggleAttribute('open', this.getState('open'));
  },
  disconnected() {
    const host = this as HTMLElement & { dismissTimer?: ReturnType<typeof setTimeout> };
    if (host.dismissTimer) clearTimeout(host.dismissTimer);
  },
  render({ props }) {
    return html`<span role="status">${props.message}</span>`;
  },
});
```

**Why it works.** `role="status"` makes the message accessible without forcing focus; reduced-motion users skip the slide-in.

## Related

- [Components guide](/guide/components)
- [Motion — `animate`](/guide/motion)
- [A11y — `prefersReducedMotion`](/guide/a11y)
- Longer worked example: [Examples & Recipes — Notification toast](/guide/examples#a-notification-toast)
