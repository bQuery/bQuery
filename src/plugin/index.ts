/**
 * bQuery Plugin System — register plugins that extend bQuery with custom
 * directives, components, hooks (filters / actions), and DI bindings.
 *
 * Targeting **Stable** in 1.15.0: the hook-bus, DI container, install
 * lifecycle, and directive-registration surface are frozen for one minor
 * cycle. Everything a plugin registers through the install context is tracked
 * and removed symmetrically on `uninstall()`. Use `definePlugin()` to author
 * plugins with inferred option types.
 *
 * @module bquery/plugin
 *
 * @example
 * ```ts
 * import { use, addFilter, applyFilters, provide, inject } from '@bquery/bquery/plugin';
 *
 * use({
 *   name: 'my-plugin',
 *   version: '1.0.0',
 *   install(ctx, options) {
 *     ctx.directive('tooltip', { mounted: (el, expr) => { ... } });
 *     ctx.component('my-widget', MyWidgetElement);
 *     ctx.addFilter('view:render', (html) => html.replace(/foo/g, 'bar'));
 *     ctx.provide('logger', console);
 *     ctx.onCleanup(() => console.log('plugin removed'));
 *   },
 * });
 * ```
 */

// Types
export type {
  BQueryPlugin,
  CustomDirective,
  CustomDirectiveHandler,
  CustomDirectiveLifecycle,
  CustomDirectiveValue,
  PluginInfo,
  PluginInstallContext,
} from './types';

// Runtime API
export {
  addAction,
  addFilter,
  applyFilters,
  doAction,
  getCustomDirective,
  getCustomDirectives,
  getInstalledPlugins,
  getPluginInfo,
  hasProvided,
  isInstalled,
  resetPlugins,
  uninstall,
  unuse,
  use,
} from './registry';

// 1.14+ — Free-standing hooks API for non-plugin code
export {
  listActions,
  listFilters,
  removeAction,
  removeFilter,
  resetHooks,
} from './hooks';

// 1.14+ — Dependency injection
export { createInjectionKey, inject, provide, resetDi } from './di';
export type { InjectionKey } from './di';

// 1.15+ — Authoring helper (targeting Stable)
export { definePlugin } from './define';
