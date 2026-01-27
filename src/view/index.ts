/**
 * Declarative DOM bindings via data attributes.
 *
 * This module provides Vue/Svelte-style template directives without
 * requiring a compiler. Bindings are evaluated at runtime using
 * bQuery's reactive system. Features include:
 * - Conditional rendering (bq-if)
 * - List rendering (bq-for)
 * - Two-way binding (bq-model)
 * - Class binding (bq-class)
 * - Text/HTML binding (bq-text, bq-html)
 * - Attribute binding (bq-bind)
 * - Event binding (bq-on)
 *
 * ## Security Considerations
 *
 * **WARNING:** This module uses `new Function()` to evaluate expressions at runtime.
 * This is similar to Vue/Alpine's approach but carries inherent security risks:
 *
 * - **NEVER** use expressions derived from user input or untrusted sources
 * - Expressions should only come from developer-controlled templates
 * - The context object should not contain sensitive data that could be exfiltrated
 * - For user-generated content, use static bindings with sanitized values instead
 *
 * Since bQuery is runtime-only (no build-time compilation), expressions are evaluated
 * dynamically. If your application loads templates from external sources (APIs, databases),
 * ensure they are trusted and validated before mounting.
 *
 * ## Content Security Policy (CSP) Compatibility
 *
 * **IMPORTANT:** This module requires `'unsafe-eval'` in your CSP `script-src` directive.
 * The `new Function()` constructor used for expression evaluation will be blocked by
 * strict CSP policies that omit `'unsafe-eval'`.
 *
 * ### Required CSP Header
 * ```
 * Content-Security-Policy: script-src 'self' 'unsafe-eval';
 * ```
 *
 * ### CSP-Strict Alternatives
 *
 * If your application requires a strict CSP without `'unsafe-eval'`, consider these alternatives:
 *
 * 1. **Use bQuery's core reactive system directly** - Bind signals to DOM elements manually
 *    using `effect()` without the view module's template directives:
 *    ```ts
 *    import { signal, effect } from 'bquery/reactive';
 *    import { $ } from 'bquery';
 *
 *    const count = signal(0);
 *    effect(() => {
 *      $('#counter').text(String(count.value));
 *    });
 *    ```
 *
 * 2. **Use bQuery's component module** - Web Components with typed props don't require
 *    dynamic expression evaluation:
 *    ```ts
 *    import { component } from 'bquery/component';
 *    component('my-counter', {
 *      props: { count: { type: Number } },
 *      render: ({ props }) => `<span>${props.count}</span>`,
 *    });
 *    ```
 *
 * 3. **Pre-compile templates at build time** - Use a build step to transform bq-* attributes
 *    into static JavaScript (similar to Svelte/Vue SFC compilation). This is outside bQuery's
 *    scope but can be achieved with custom Vite/Rollup plugins.
 *
 * The view module is designed for rapid prototyping and applications where CSP flexibility
 * is acceptable. For security-critical applications requiring strict CSP, use the alternatives above.
 *
 * @module bquery/view
 *
 * @example
 * ```html
 * <div id="app">
 *   <input bq-model="name" />
 *   <p bq-text="greeting"></p>
 *   <ul>
 *     <li bq-for="item in items" bq-text="item.name"></li>
 *   </ul>
 *   <button bq-on:click="handleClick">Click me</button>
 *   <div bq-if="showDetails" bq-class="{ active: isActive }">
 *     Details here
 *   </div>
 * </div>
 * ```
 *
 * ```ts
 * import { mount } from 'bquery/view';
 * import { signal } from 'bquery/reactive';
 *
 * mount('#app', {
 *   name: signal('World'),
 *   greeting: computed(() => `Hello, ${name.value}!`),
 *   items: signal([{ name: 'Item 1' }, { name: 'Item 2' }]),
 *   showDetails: signal(true),
 *   isActive: signal(false),
 *   handleClick: () => console.log('Clicked!'),
 * });
 * ```
 */

export { clearExpressionCache } from './evaluate';
export { createTemplate, mount } from './mount';
export type { BindingContext, MountOptions, View } from './types';

/**
 * Re-export reactive primitives for convenience.
 */
export { batch, computed, effect, signal } from '../reactive/index';
