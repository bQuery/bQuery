/**
 * Public types for the bQuery plugin system.
 *
 * Plugins extend bQuery by registering custom directives and Web Components
 * through a single unified interface.
 *
 * @module bquery/plugin
 */

import type { CleanupFn } from '../reactive/index';
import type { BindingContext } from '../view/types';

// ---------------------------------------------------------------------------
// Custom Directive
// ---------------------------------------------------------------------------

/**
 * A custom directive handler that is invoked when the view module encounters
 * a `bq-{name}` attribute during mount processing.
 *
 * @param el - The DOM element carrying the directive attribute
 * @param expression - The raw attribute value (expression string)
 * @param context - The current binding context (data / signals)
 * @param cleanups - Array where the handler should push any cleanup functions
 *
 * @example
 * ```ts
 * const tooltipDirective: CustomDirectiveHandler = (el, expression, ctx, cleanups) => {
 *   const tip = document.createElement('span');
 *   tip.textContent = String(expression);
 *   el.appendChild(tip);
 *   cleanups.push(() => tip.remove());
 * };
 * ```
 */
export type CustomDirectiveHandler = (
  el: Element,
  expression: string,
  context: BindingContext,
  cleanups: CleanupFn[]
) => void;

/**
 * Descriptor for a custom directive registered by a plugin.
 */
export interface CustomDirective {
  /** The directive name (without prefix). e.g. `'tooltip'` → `bq-tooltip` */
  readonly name: string;
  /** The handler function called when the directive is encountered. */
  readonly handler: CustomDirectiveHandler;
}

// ---------------------------------------------------------------------------
// Plugin Install Context
// ---------------------------------------------------------------------------

/**
 * Context object provided to a plugin's `install` function.
 *
 * Plugins use these helpers to register their contributions into bQuery's
 * global registries without directly importing internal modules.
 */
export interface PluginInstallContext {
  /**
   * Register a custom view directive that will be recognized during
   * `mount()` processing.
   *
   * @param name - Directive name **without** the `bq-` prefix (e.g. `'tooltip'`)
   * @param handler - The handler called for each element with the directive
   *
   * @example
   * ```ts
   * ctx.directive('focus', (el) => {
   *   (el as HTMLElement).focus();
   * });
   * ```
   */
  directive(name: string, handler: CustomDirectiveHandler): void;

  /**
   * Register a Web Component via the native `customElements.define()` API.
   *
   * @param tagName - Custom element tag (e.g. `'my-counter'`)
   * @param constructor - The `HTMLElement` subclass
   * @param options - Optional `ElementDefinitionOptions` (e.g. `{ extends: 'div' }`)
   *
   * @example
   * ```ts
   * ctx.component('my-counter', MyCounterElement);
   * ```
   */
  component(
    tagName: string,
    constructor: CustomElementConstructor,
    options?: ElementDefinitionOptions
  ): void;
}

// ---------------------------------------------------------------------------
// Plugin Interface
// ---------------------------------------------------------------------------

/**
 * A bQuery plugin.
 *
 * Plugins are plain objects with a `name` and an `install` function.
 * Call `use(plugin)` to activate a plugin before creating routers, stores,
 * or mounting views.
 *
 * @example
 * ```ts
 * import { use } from '@bquery/bquery/plugin';
 *
 * const myPlugin: BQueryPlugin = {
 *   name: 'my-plugin',
 *   install(ctx, options) {
 *     ctx.directive('highlight', (el, expr) => {
 *       (el as HTMLElement).style.background = String(expr);
 *     });
 *   },
 * };
 *
 * use(myPlugin, { color: 'yellow' });
 * ```
 */
export interface BQueryPlugin<TOptions = unknown> {
  /** Unique human-readable name for the plugin. */
  readonly name: string;

  /**
   * Called once when the plugin is registered via `use()`.
   *
   * @param context - Helpers for registering directives, components, etc.
   * @param options - User-provided options forwarded from `use(plugin, options)`.
   */
  install(context: PluginInstallContext, options?: TOptions): void;
}
