/**
 * Hydration support for server-rendered DOM.
 *
 * Enables the client-side view system to reuse existing server-rendered DOM
 * elements instead of re-rendering them, by attaching reactive bindings
 * to the pre-existing DOM structure.
 *
 * @module bquery/ssr
 */

import type { BindingContext, MountOptions, View } from '../view/types';
import { mount } from '../view/mount';

/**
 * Extended mount options that include hydration mode.
 */
export type HydrateMountOptions = MountOptions & {
  /**
   * When `true`, the mount operation reuses existing DOM elements
   * instead of re-rendering them. Reactive bindings (effects) are
   * still attached so the DOM updates reactively from that point on.
   *
   * @default false
   */
  hydrate?: boolean;
};

/**
 * Mounts a reactive view with optional hydration support.
 *
 * When `hydrate: true` is set, the existing server-rendered DOM is preserved
 * and reactive bindings are attached on top. The DOM is NOT re-rendered;
 * instead, effects begin tracking signals so future changes update the DOM.
 *
 * This is the client-side counterpart to `renderToString()`. The typical flow:
 * 1. Server: `renderToString(template, data)` → send HTML to client
 * 2. Client: `hydrateMount('#app', reactiveContext, { hydrate: true })`
 *
 * Under the hood, `hydrateMount` simply delegates to the standard `mount()`
 * function. The `mount()` function already processes existing DOM elements
 * and attaches reactive effects to them — it does not clear/replace content.
 * The `hydrate` flag is a semantic marker indicating developer intent and
 * ensures the existing DOM structure is preserved.
 *
 * @param selector - CSS selector or Element to hydrate
 * @param context - Binding context with signals, computed values, and functions
 * @param options - Mount options with `hydrate: true`
 * @returns The mounted View instance
 *
 * @example
 * ```ts
 * import { hydrateMount } from '@bquery/bquery/ssr';
 * import { signal, computed } from '@bquery/bquery/reactive';
 *
 * // Server rendered:
 * // <div id="app"><h1>Welcome</h1><p>Hello, World!</p></div>
 *
 * // Client hydration — attaches reactivity to existing DOM:
 * const name = signal('World');
 * const greeting = computed(() => `Hello, ${name.value}!`);
 *
 * const view = hydrateMount('#app', { name, greeting }, { hydrate: true });
 *
 * // Now updating `name.value` will reactively update the DOM
 * name.value = 'Alice'; // <p> updates to "Hello, Alice!"
 * ```
 */
export const hydrateMount = (
  selector: string | Element,
  context: BindingContext,
  options: HydrateMountOptions = {}
): View => {
  const { hydrate: _hydrate, ...mountOptions } = options;

  // Hydration uses the standard mount which processes existing DOM
  // and attaches reactive effects without clearing content.
  return mount(selector, context, mountOptions);
};
