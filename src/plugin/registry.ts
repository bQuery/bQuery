/**
 * Global plugin registry for bQuery.
 *
 * Provides `use()` to register plugins and query helpers consumed by
 * other modules (e.g. the view module reads custom directives from here).
 *
 * @module bquery/plugin
 */

import { registerCustomDirectiveResolver } from '../view/custom-directives';
import type {
  BQueryPlugin,
  CustomDirective,
  CustomDirectiveHandler,
  PluginInstallContext,
} from './types';

// ---------------------------------------------------------------------------
// Internal registries
// ---------------------------------------------------------------------------

/** Set of installed plugin names — prevents double-install. */
const installedPlugins = new Set<string>();

/** Custom directives contributed by plugins. */
const customDirectives = new Map<string, CustomDirectiveHandler>();

type PendingComponentRegistration = {
  tagName: string;
  constructor: CustomElementConstructor;
  options?: ElementDefinitionOptions;
};

registerCustomDirectiveResolver((name) => customDirectives.get(name));

// ---------------------------------------------------------------------------
// Install context factory
// ---------------------------------------------------------------------------

/**
 * Build the `PluginInstallContext` handed to each plugin's `install()`.
 * @internal
 */
const createInstallContext = (
  pendingComponents: PendingComponentRegistration[]
): PluginInstallContext => ({
  directive(name: string, handler: CustomDirectiveHandler): void {
    if (typeof name !== 'string' || name.length === 0) {
      throw new Error('bQuery plugin directive: name must be a non-empty string');
    }
    if (name.startsWith('bq-')) {
      const suggestedName = name.slice(3);
      throw new Error(
        `bQuery plugin directive: name "${name}" must be provided without the "bq-" prefix` +
          (suggestedName ? ` (use "${suggestedName}")` : '')
      );
    }
    if (typeof handler !== 'function') {
      throw new Error(`bQuery plugin directive: handler for "${name}" must be a function`);
    }
    if (customDirectives.has(name)) {
      throw new Error(`bQuery plugin directive: a directive named "${name}" is already registered`);
    }
    customDirectives.set(name, handler);
  },

  component(
    tagName: string,
    constructor: CustomElementConstructor,
    options?: ElementDefinitionOptions
  ): void {
    if (typeof tagName !== 'string' || tagName.length === 0) {
      throw new Error('bQuery plugin component: tagName must be a non-empty string');
    }
    if (typeof constructor !== 'function') {
      throw new Error(`bQuery plugin component: constructor for "${tagName}" must be a function`);
    }
    if (typeof customElements === 'undefined') {
      if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        console.warn(
          `[bQuery] plugin component "${tagName}" was not registered because customElements is not available in this environment.`
        );
      }
      return;
    }
    // Idempotent — skip if already defined or already staged during this install
    if (
      !customElements.get(tagName) &&
      !pendingComponents.some((entry) => entry.tagName === tagName)
    ) {
      pendingComponents.push({ tagName, constructor, options });
    }
  },
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register a bQuery plugin.
 *
 * Plugins are installed at most once (identified by `plugin.name`).
 * Duplicate calls with the same name are silently ignored.
 *
 * @param plugin - The plugin object implementing `{ name, install }`.
 * @param options - Optional configuration forwarded to `plugin.install()`.
 * @throws If `plugin` is not a valid plugin object.
 *
 * @example
 * ```ts
 * import { use } from '@bquery/bquery/plugin';
 *
 * use({
 *   name: 'highlight',
 *   install(ctx) {
 *     ctx.directive('highlight', (el, expr) => {
 *       (el as HTMLElement).style.background = String(expr);
 *     });
 *   },
 * });
 * ```
 */
export const use = <TOptions = unknown>(
  plugin: BQueryPlugin<TOptions>,
  options?: TOptions
): void => {
  if (!plugin || typeof plugin !== 'object') {
    throw new Error('bQuery plugin: use() expects a plugin object with { name, install }');
  }
  if (typeof plugin.name !== 'string' || plugin.name.length === 0) {
    throw new Error('bQuery plugin: plugin must have a non-empty "name" property');
  }
  if (typeof plugin.install !== 'function') {
    throw new Error(`bQuery plugin: plugin "${plugin.name}" must have an "install" function`);
  }

  // Deduplicate
  if (installedPlugins.has(plugin.name)) return;

  const pendingComponents: PendingComponentRegistration[] = [];
  const ctx = createInstallContext(pendingComponents);
  const directivesSnapshot = new Map(customDirectives);

  try {
    plugin.install(ctx, options);
  } catch (error) {
    customDirectives.clear();
    for (const [name, handler] of directivesSnapshot) {
      customDirectives.set(name, handler);
    }
    throw error;
  }

  for (const entry of pendingComponents) {
    if (!customElements.get(entry.tagName)) {
      customElements.define(entry.tagName, entry.constructor, entry.options);
    }
  }

  installedPlugins.add(plugin.name);
};

/**
 * Check whether a plugin with the given name has been installed.
 *
 * @param name - The plugin name to check.
 * @returns `true` if the plugin was previously installed via `use()`.
 *
 * @example
 * ```ts
 * import { isInstalled } from '@bquery/bquery/plugin';
 *
 * if (!isInstalled('my-plugin')) {
 *   use(myPlugin);
 * }
 * ```
 */
export const isInstalled = (name: string): boolean => installedPlugins.has(name);

/**
 * Return a read-only snapshot of all installed plugin names.
 *
 * @returns Array of plugin name strings.
 *
 * @example
 * ```ts
 * import { getInstalledPlugins } from '@bquery/bquery/plugin';
 * console.log(getInstalledPlugins()); // ['my-plugin', 'other-plugin']
 * ```
 */
export const getInstalledPlugins = (): readonly string[] => [...installedPlugins];

/**
 * Retrieve the handler for a custom directive registered by a plugin.
 *
 * This is used internally by the view module's `processElement` to
 * resolve directives that aren't built-in.
 *
 * @param name - Directive name **without** prefix (e.g. `'tooltip'`).
 * @returns The handler, or `undefined` if none is registered.
 *
 * @example
 * ```ts
 * import { getCustomDirective } from '@bquery/bquery/plugin';
 * const handler = getCustomDirective('tooltip');
 * ```
 */
export const getCustomDirective = (name: string): CustomDirectiveHandler | undefined =>
  customDirectives.get(name);

/**
 * Return a read-only snapshot of all registered custom directives.
 *
 * @returns Array of `{ name, handler }` descriptors.
 *
 * @example
 * ```ts
 * import { getCustomDirectives } from '@bquery/bquery/plugin';
 * for (const { name, handler } of getCustomDirectives()) {
 *   console.log(`Directive: bq-${name}`);
 * }
 * ```
 */
export const getCustomDirectives = (): readonly CustomDirective[] =>
  [...customDirectives.entries()].map(([name, handler]) => ({ name, handler }));

/**
 * Reset all plugin registrations.
 *
 * Clears all installed plugins and custom directives.
 *
 * This utility is primarily intended for tests and other isolated environments
 * that need to reinitialize plugin state between runs.
 *
 * @example
 * ```ts
 * import { resetPlugins } from '@bquery/bquery/plugin';
 * afterEach(() => resetPlugins());
 * ```
 */
export const resetPlugins = (): void => {
  installedPlugins.clear();
  customDirectives.clear();
};
