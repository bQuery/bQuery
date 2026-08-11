# Reusable modal dialog

**Problem.** Modal that traps focus, closes on Escape, and announces itself.

**Solution.** Combine a [Component](/guide/components) with [`trapFocus`](/guide/a11y) and a [`createLiveRegion`](/guide/a11y).

```ts
import { bool, defineComponent, html } from '@bquery/bquery/component';
import { createLiveRegion, trapFocus } from '@bquery/bquery/a11y';

const region = createLiveRegion({ priority: 'assertive' });
const modalHandles = new WeakMap<
  HTMLElement,
  { trap?: ReturnType<typeof trapFocus>; onKey?: (event: KeyboardEvent) => void }
>();

const syncModalState = (host: HTMLElement, open: boolean, label: string) => {
  const current = modalHandles.get(host);
  current?.trap?.release();
  if (current?.onKey) window.removeEventListener('keydown', current.onKey);

  if (!open) {
    modalHandles.set(host, {});
    return;
  }

  const trap = trapFocus(host);
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      host.dispatchEvent(new CustomEvent('close'));
    }
  };

  region.announce(`${label} opened`);
  window.addEventListener('keydown', onKey);
  modalHandles.set(host, { trap, onKey });
};

defineComponent('ds-modal', {
  props: { open: { type: Boolean, default: false }, label: { type: String, default: 'Dialog' } },
  connected() {
    syncModalState(this, this.getProp<boolean>('open'), this.getProp<string>('label'));
  },
  updated(change) {
    if (!change || change.name === 'open' || change.name === 'label') {
      syncModalState(this, this.getProp<boolean>('open'), this.getProp<string>('label'));
    }
  },
  disconnected() {
    syncModalState(this, false, this.getProp<string>('label'));
    modalHandles.delete(this);
  },
  render({ props }) {
    return html`
      <div role="dialog" aria-modal="true" aria-label=${props.label} ${bool('hidden', !props.open)}>
        <slot></slot>
      </div>
    `;
  },
});
```

**Why it works.** `trapFocus` keeps Tab navigation inside the dialog and restores focus on release; the live region announces opening without stealing focus.

## Related

- [A11y — Focus trap](/guide/a11y)
- [A11y — Live regions](/guide/a11y)
- [Components guide](/guide/components)
- Longer worked example: [Examples & Recipes — Reusable modal dialog](/guide/examples#reusable-modal-dialog)
