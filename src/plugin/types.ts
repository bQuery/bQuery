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
import type { InjectionKey } from './di';

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
 * Lifecycle-aware directive definition (1.14+).
 *
 * Directives can opt into individual `mounted` / `updated` / `unmounted`
 * callbacks instead of a single handler. The `mounted` hook runs once when
 * the directive is encountered during a `mount()` pass and acts as the
 * traditional entry point; `unmounted` is registered as a cleanup. The
 * `updated` hook is currently invoked when the directive expression changes
 * during subsequent re-binding.
 */
export interface CustomDirectiveLifecycle {
  mounted?: CustomDirectiveHandler;
  updated?: CustomDirectiveHandler;
  unmounted?: (el: Element) => void;
}

/**
 * A directive value accepted by {@link PluginInstallContext.directive}.
 */
export type CustomDirectiveValue = CustomDirectiveHandler | CustomDirectiveLifecycle;

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
   * @param name - Directive name **without** the `bq-` prefix (e.g. `'tooltip'`).
   *   Plugins may also use a `namespace:variant` form (e.g. `'tooltip:arrow'`).
   * @param handler - Either a {@link CustomDirectiveHandler} or a
   *   {@link CustomDirectiveLifecycle} object with `mounted`/`updated`/`unmounted`.
   */
  directive(name: string, handler: CustomDirectiveValue): void;

  /**
   * Register a Web Component via the native `customElements.define()` API.
   */
  component(
    tagName: string,
    constructor: CustomElementConstructor,
    options?: ElementDefinitionOptions
  ): void;

  /**
   * Register a filter callback (1.14+).
   *
   * Filters run in priority order and transform a value as it flows through
   * the named pipeline.
   */
  addFilter<T = unknown>(
    name: string,
    fn: (value: T, ...args: unknown[]) => T,
    priority?: number
  ): void;

  /**
   * Apply all registered filters for the given name (1.14+).
   */
  applyFilters<T>(name: string, value: T, ...args: unknown[]): T;

  /**
   * Register a fire-and-forget action hook (1.14+).
   */
  addAction(name: string, fn: (...args: unknown[]) => void, priority?: number): void;

  /**
   * Dispatch every registered action callback for the given name (1.14+).
   */
  doAction(name: string, ...args: unknown[]): void;

  /**
   * Register a value in the global DI container (1.14+).
   */
  provide<T>(key: InjectionKey<T> | string | symbol, value: T): void;

  /**
   * Retrieve a value previously registered via {@link provide}.
   */
  inject<T>(key: InjectionKey<T> | string | symbol): T | undefined;

  /**
   * Register a teardown callback invoked when the plugin is uninstalled
   * via `unuse(name)` or `uninstall(name)` (1.14+).
   */
  onCleanup(fn: () => void): void;
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
 */
export interface BQueryPlugin<TOptions = unknown> {
  /** Unique human-readable name for the plugin. */
  readonly name: string;

  /** Optional semantic version string for diagnostic display. */
  readonly version?: string;

  /** Optional human-readable description shown by devtools / `getPluginInfo()`. */
  readonly description?: string;

  /**
   * Optional list of plugin names that must already be installed before this
   * plugin can be installed. When `dependencyMode` is `'error'` (default),
   * missing dependencies throw; when `'warn'`, the plugin still installs but
   * a console warning is emitted.
   */
  readonly dependencies?: readonly string[];

  /** How missing dependencies should be reported. @default 'error' */
  readonly dependencyMode?: 'error' | 'warn';

  /**
   * Called once when the plugin is registered via `use()`. May return a
   * promise; consumers awaiting `use(plugin)` will be notified when install
   * completes.
   */
  install(context: PluginInstallContext, options?: TOptions): void | Promise<void>;
}

/**
 * Metadata view returned by `getPluginInfo()` (1.14+).
 */
export interface PluginInfo {
  readonly name: string;
  readonly version?: string;
  readonly description?: string;
  readonly dependencies: readonly string[];
}
