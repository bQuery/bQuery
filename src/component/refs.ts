/**
 * `useRef` — declarative DOM references for components.
 *
 * @module bquery/component
 */

import { getCurrentScope } from './scope';

/**
 * Reactive-free DOM reference, conceptually similar to React's `useRef` or
 * Vue's `ref`. Use this to capture an element from the rendered shadow DOM
 * after `render()` runs.
 *
 * @example
 * ```ts
 * component('focus-input', {
 *   connected() {
 *     const input = useRef<HTMLInputElement>();
 *     this._input = input;
 *     // After render, resolve the ref from the shadow DOM:
 *     queueMicrotask(() => input.bind(this.shadowRoot!.querySelector('input')!));
 *   },
 *   render() {
 *     return html`<input type="text" />`;
 *   },
 * });
 * ```
 */
export type Ref<T extends Element = HTMLElement> = {
  /** Current resolved element or `null` while unbound. */
  current: T | null;
  /** Bind the ref to a specific element. */
  bind: (element: T | null) => void;
  /** Clear the ref (`current = null`). */
  clear: () => void;
};

/**
 * Create a new {@link Ref}. The ref is automatically cleared on component
 * disconnect when called inside a component scope; outside of a scope, it
 * still works as a plain mutable holder.
 */
export const useRef = <T extends Element = HTMLElement>(): Ref<T> => {
  const ref: Ref<T> = {
    current: null,
    bind(element) {
      ref.current = element;
    },
    clear() {
      ref.current = null;
    },
  };
  const scope = getCurrentScope();
  scope?.addDisposer(() => {
    ref.current = null;
  });
  return ref;
};
