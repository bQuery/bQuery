# Reusable modal dialog

**Problem.** Modal that traps focus, closes on Escape, and announces itself.

**Solution.** Combine a [Component](/guide/components) with [`focusTrap`](/guide/a11y) and a [`createLiveRegion`](/guide/a11y).

```ts
import { defineComponent, useEffect } from '@bquery/bquery/component';
import { focusTrap, createLiveRegion } from '@bquery/bquery/a11y';

const region = createLiveRegion({ politeness: 'assertive' });

defineComponent('ds-modal', {
  props: { open: { type: 'boolean', default: false }, label: { type: 'string', default: 'Dialog' } },
  setup({ props, host }) {
    let release: (() => void) | undefined;
    useEffect(() => {
      if (!props.open) return release?.();
      release = focusTrap(host).activate();
      region.announce(`${props.label} opened`);
      const onKey = (e: KeyboardEvent) => e.key === 'Escape' && host.dispatchEvent(new CustomEvent('close'));
      window.addEventListener('keydown', onKey);
      return () => { release?.(); window.removeEventListener('keydown', onKey); };
    });
    return ({ html }) => html`
      <div role="dialog" aria-modal="true" aria-label=${props.label} hidden=${!props.open}>
        <slot></slot>
      </div>
    `;
  },
});
```

**Why it works.** `focusTrap` keeps Tab navigation inside the dialog and restores focus on release; the live region announces opening without stealing focus.

## Related

- [A11y — Focus trap](/guide/a11y)
- [A11y — Live regions](/guide/a11y)
- [Components guide](/guide/components)
- Longer worked example: [Examples & Recipes — Reusable modal dialog](/guide/examples#reusable-modal-dialog)
