import { $, component, computed, effect, html, signal } from '@bquery/bquery';

/**
 * Wires the greeting in index.html: `$` finds and updates elements, a signal
 * holds the name, and the effect re-runs whenever the signal changes.
 *
 * @param {ParentNode} root - Element that contains `#name` and `#greeting`.
 * @returns {{ stop: () => void }} Stops updating the greeting.
 */
export function mountGreeting(root) {
  const name = signal('');
  const greeting = computed(() => `Hello, ${name.value.trim() || 'stranger'}!`);

  const input = $(root.querySelector('#name'));
  const output = $(root.querySelector('#greeting'));

  input.on('input', (event) => {
    name.value = event.target.value;
  });
  const stop = effect(() => {
    output.text(greeting.value);
  });

  return { stop };
}

/** Clicks anywhere in the component bump its count; `this` is the element. */
function increment() {
  this.setState('count', this.getState('count') + 1);
}

// A Web Component with a typed prop and internal state. `html` escapes every
// interpolated value.
component('click-counter', {
  props: {
    label: { type: String, default: 'Clicks' },
  },
  state: { count: 0 },
  connected() {
    this.addEventListener('click', increment);
  },
  disconnected() {
    this.removeEventListener('click', increment);
  },
  render({ props, state }) {
    return html`<button type="button">${props.label}: ${state.count}</button>`;
  },
});
