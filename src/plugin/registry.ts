/**
 * Global plugin registry for bQuery.
 *
 * 1.14+ adds plugin metadata, dependencies, async install, full lifecycle
 * tracking (so `unuse()` can deterministically tear down a plugin's
 * directives, components stub, filters, actions, DI bindings, and any
 * user-supplied `onCleanup` callbacks), and the richer
 * {@link PluginInstallContext}.
 *
 * @module bquery/plugin
 */

import { registerCustomDirectiveResolver } from '../view/custom-directives';
import {
  addFilter as freeAddFilter,
  applyFilters as freeApplyFilters,
  addAction as freeAddAction,
  doAction as freeDoAction,
  registerAction,
  registerFilter,
  removeActionsByOwner,
  removeFiltersByOwner,
} from './hooks';
import { hasProvided, inject as freeInject, registerProvide, removeProvidedByOwner } from './di';
import type {
  BQueryPlugin,
  CustomDirective,
  CustomDirectiveHandler,
  CustomDirectiveLifecycle,
  CustomDirectiveValue,
  PluginInfo,
  PluginInstallContext,
} from './types';
import type { InjectionKey } from './di';

// ---------------------------------------------------------------------------
// Internal registries
// ---------------------------------------------------------------------------

interface InstalledPluginRecord {
  name: string;
  plugin: BQueryPlugin<unknown>;
  directives: string[];
  cleanups: (() => void)[];
}

/** Set of installed plugin names — prevents double-install. */
const installedPlugins = new Map<string, InstalledPluginRecord>();

/** In-flight installs keyed by name — used to serialise concurrent `use()` calls. */
const inFlightInstalls = new Map<string, Promise<void>>();

/** Custom directive handlers contributed by plugins. */
const customDirectives = new Map<string, CustomDirectiveHandler>();

type PendingComponentRegistration = {
  tagName: string;
  constructor: CustomElementConstructor;
  options?: ElementDefinitionOptions;
};

const attachCustomDirectiveResolver = (): void => {
  registerCustomDirectiveResolver((name) => customDirectives.get(name));
};

attachCustomDirectiveResolver();

const restoreDirectiveSnapshot = (
  directivesSnapshot: ReadonlyMap<string, CustomDirectiveHandler>
): void => {
  customDirectives.clear();
  for (const [name, handler] of directivesSnapshot) {
    customDirectives.set(name, handler);
  }
};

// ---------------------------------------------------------------------------
// Directive name validation
// ---------------------------------------------------------------------------

const DIRECTIVE_NAME_RE = /^[A-Za-z_][\w-]*(?::[A-Za-z_][\w-]*)?$/;

const normaliseDirectiveValue = (
  name: string,
  handler: CustomDirectiveValue
): { handler: CustomDirectiveHandler } => {
  if (typeof handler === 'function') {
    return { handler };
  }
  if (handler && typeof handler === 'object') {
    const lifecycle = handler as CustomDirectiveLifecycle;
    const updated = (handler as { updated?: unknown }).updated;
    if (updated !== undefined) {
      throw new Error(
        `bQuery plugin directive: lifecycle object for "${name}" does not support an "updated" hook`
      );
    }
    const mounted = lifecycle.mounted;
    if (typeof mounted !== 'function') {
      throw new Error(
        `bQuery plugin directive: lifecycle object for "${name}" must include a "mounted" function`
      );
    }
    return {
      handler: (el, expression, ctx, cleanups) => {
        mounted(el, expression, ctx, cleanups);
        if (typeof lifecycle.unmounted === 'function') {
          const fn = lifecycle.unmounted;
          cleanups.push(() => fn(el));
        }
      },
    };
  }
  throw new Error(
    `bQuery plugin directive: handler for "${name}" must be a function or lifecycle object`
  );
};

// ---------------------------------------------------------------------------
// Install context factory
// ---------------------------------------------------------------------------

const createInstallContext = (
  record: InstalledPluginRecord,
  pendingComponents: PendingComponentRegistration[]
): PluginInstallContext => ({
  directive(name: string, handler: CustomDirectiveValue): void {
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
    if (!DIRECTIVE_NAME_RE.test(name)) {
      throw new Error(
        `bQuery plugin directive: name "${name}" is not a valid directive identifier`
      );
    }
    if (customDirectives.has(name)) {
      throw new Error(`bQuery plugin directive: a directive named "${name}" is already registered`);
    }
    const { handler: normalisedHandler } = normaliseDirectiveValue(name, handler);
    customDirectives.set(name, normalisedHandler);
    record.directives.push(name);
  },

  component(
    tagName: string,
    constructor: CustomElementConstructor,
    options?: ElementDefinitionOptions
  ): void {
    if (typeof tagName !== 'string' || tagName.length === 0) {
      throw new Error('bQuery plugin component: tagName must be a non-empty string');
    }
    if (!tagName.includes('-')) {
      throw new Error(
        `bQuery plugin component: tagName "${tagName}" must be a valid custom element name containing a hyphen`
      );
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
    if (
      !customElements.get(tagName) &&
      !pendingComponents.some((entry) => entry.tagName === tagName)
    ) {
      pendingComponents.push({ tagName, constructor, options });
    }
  },

  addFilter<T = unknown>(
    name: string,
    fn: (value: T, ...args: unknown[]) => T,
    priority = 10
  ): void {
    record.cleanups.push(
      registerFilter(
        name,
        fn as (value: unknown, ...args: unknown[]) => unknown,
        priority,
        record.name
      )
    );
  },

  applyFilters<T>(name: string, value: T, ...args: unknown[]): T {
    return freeApplyFilters(name, value, ...args);
  },

  addAction(name: string, fn: (...args: unknown[]) => void, priority = 10): void {
    record.cleanups.push(registerAction(name, fn, priority, record.name));
  },

  doAction(name: string, ...args: unknown[]): void {
    freeDoAction(name, ...args);
  },

  provide<T>(key: InjectionKey<T> | string | symbol, value: T): void {
    registerProvide(key, value, record.name);
  },

  inject<T>(key: InjectionKey<T> | string | symbol): T | undefined {
    return freeInject(key);
  },

  onCleanup(fn: () => void): void {
    if (typeof fn === 'function') record.cleanups.push(fn);
  },
});

// ---------------------------------------------------------------------------
// Dependency resolution
// ---------------------------------------------------------------------------

const checkDependencies = (plugin: BQueryPlugin<unknown>): void => {
  if (!plugin.dependencies || plugin.dependencies.length === 0) return;
  const missing = plugin.dependencies.filter((dep) => !installedPlugins.has(dep));
  if (missing.length === 0) return;

  const message = `bQuery plugin: "${plugin.name}" is missing dependencies: ${missing.join(', ')}`;
  if ((plugin.dependencyMode ?? 'error') === 'warn') {
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn(`[bQuery] ${message}`);
    }
    return;
  }
  throw new Error(message);
};

// ---------------------------------------------------------------------------
// Install / Uninstall
// ---------------------------------------------------------------------------

/**
 * Register a bQuery plugin.
 *
 * 1.14+: returns `void` when the plugin's `install()` is synchronous and a
 * `Promise<void>` when it is asynchronous, preserving the original synchronous
 * contract while supporting awaitable installs.
 *
 * Concurrent calls with the same plugin name during an async install share
 * the in-flight promise so dependent code can safely `await use(plugin)`.
 */
export const use = <TOptions = unknown>(
  plugin: BQueryPlugin<TOptions>,
  options?: TOptions
): void | Promise<void> => {
  attachCustomDirectiveResolver();

  if (!plugin || typeof plugin !== 'object') {
    throw new Error('bQuery plugin: use() expects a plugin object with { name, install }');
  }
  if (typeof plugin.name !== 'string' || plugin.name.length === 0) {
    throw new Error('bQuery plugin: plugin must have a non-empty "name" property');
  }
  if (typeof plugin.install !== 'function') {
    throw new Error(`bQuery plugin: plugin "${plugin.name}" must have an "install" function`);
  }

  if (installedPlugins.has(plugin.name)) return;

  const pending = inFlightInstalls.get(plugin.name);
  if (pending) return pending;

  return runInstall(plugin as BQueryPlugin<unknown>, options);
};

const runInstall = <TOptions>(
  plugin: BQueryPlugin<TOptions>,
  options: TOptions | undefined
): void | Promise<void> => {
  checkDependencies(plugin as BQueryPlugin<unknown>);

  const record: InstalledPluginRecord = {
    name: plugin.name,
    plugin: plugin as BQueryPlugin<unknown>,
    directives: [],
    cleanups: [],
  };

  const pendingComponents: PendingComponentRegistration[] = [];
  const ctx = createInstallContext(record, pendingComponents);
  const directivesSnapshot = new Map(customDirectives);

  const rollback = (): void => {
    restoreDirectiveSnapshot(directivesSnapshot);
    for (const cleanup of record.cleanups) {
      try {
        cleanup();
      } catch {
        // ignore
      }
    }
    removeFiltersByOwner(record.name);
    removeActionsByOwner(record.name);
    removeProvidedByOwner(record.name);
  };

  const finalize = (): void => {
    try {
      for (const entry of pendingComponents) {
        if (!customElements.get(entry.tagName)) {
          customElements.define(entry.tagName, entry.constructor, entry.options);
        }
      }
    } catch (error) {
      rollback();
      throw error;
    }
    installedPlugins.set(plugin.name, record);
  };

  let installResult: void | Promise<void>;
  try {
    installResult = plugin.install(ctx, options);
  } catch (error) {
    rollback();
    throw error;
  }

  if (installResult && typeof (installResult as Promise<void>).then === 'function') {
    const promise = (installResult as Promise<void>).then(
      () => finalize(),
      (error) => {
        rollback();
        throw error;
      }
    );
    inFlightInstalls.set(plugin.name, promise);
    promise.finally(() => inFlightInstalls.delete(plugin.name));
    return promise;
  }

  finalize();
  return;
};

/**
 * Uninstall a previously installed plugin (1.14+).
 *
 * Removes all directives, filters, actions, DI bindings, and runs any
 * `ctx.onCleanup()` callbacks the plugin registered. Components defined via
 * `customElements.define()` cannot be removed by the browser and remain
 * registered, but are no longer tracked.
 *
 * @returns `true` when the plugin was installed and has now been removed,
 *   `false` when no plugin with the given name was registered.
 */
export const unuse = (name: string): boolean => {
  const record = installedPlugins.get(name);
  if (!record) return false;

  for (const cleanup of record.cleanups) {
    try {
      cleanup();
    } catch (error) {
      if (typeof console !== 'undefined' && typeof console.error === 'function') {
        console.error(`[bQuery] plugin "${name}" cleanup threw:`, error);
      }
    }
  }
  removeFiltersByOwner(record.name);
  removeActionsByOwner(record.name);
  removeProvidedByOwner(record.name);

  for (const directiveName of record.directives) {
    customDirectives.delete(directiveName);
  }

  installedPlugins.delete(name);
  return true;
};

/** Alias for {@link unuse}. */
export const uninstall = unuse;

// ---------------------------------------------------------------------------
// Inspection helpers
// ---------------------------------------------------------------------------

export const isInstalled = (name: string): boolean => installedPlugins.has(name);

/**
 * Return a read-only snapshot of installed plugin names.
 *
 * Overload (1.14+): `getInstalledPlugins({ withMetadata: true })` returns
 * structured {@link PluginInfo} entries.
 */
export function getInstalledPlugins(): readonly string[];
export function getInstalledPlugins(options: { withMetadata: true }): readonly PluginInfo[];
export function getInstalledPlugins(options?: {
  withMetadata?: boolean;
}): readonly string[] | readonly PluginInfo[] {
  if (options && options.withMetadata) {
    return [...installedPlugins.values()].map((record) => ({
      name: record.plugin.name,
      version: record.plugin.version,
      description: record.plugin.description,
      dependencies: [...(record.plugin.dependencies ?? [])],
    }));
  }
  return [...installedPlugins.keys()];
}

/** Return metadata for a single installed plugin, or `undefined`. */
export const getPluginInfo = (name: string): PluginInfo | undefined => {
  const record = installedPlugins.get(name);
  if (!record) return undefined;
  return {
    name: record.plugin.name,
    version: record.plugin.version,
    description: record.plugin.description,
    dependencies: [...(record.plugin.dependencies ?? [])],
  };
};

export const getCustomDirective = (name: string): CustomDirectiveHandler | undefined =>
  customDirectives.get(name);

export const getCustomDirectives = (): readonly CustomDirective[] =>
  [...customDirectives.entries()].map(([name, handler]) => ({ name, handler }));

/**
 * Reset all plugin registrations.
 *
 * Calls `unuse()` on every installed plugin so plugin-supplied cleanups run.
 * Also clears the directive registry and re-attaches the resolver.
 */
export const resetPlugins = (): void => {
  for (const name of [...installedPlugins.keys()]) unuse(name);
  installedPlugins.clear();
  customDirectives.clear();
  attachCustomDirectiveResolver();
};

// ---------------------------------------------------------------------------
// Re-exports for top-level use
// ---------------------------------------------------------------------------

export { freeAddFilter as addFilter, freeApplyFilters as applyFilters };
export { freeAddAction as addAction, freeDoAction as doAction };
export { hasProvided };
