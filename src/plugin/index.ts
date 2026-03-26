/**
 * bQuery Plugin System — register plugins that extend bQuery with custom
 * directives and components.
 *
 * @module bquery/plugin
 *
 * @example
 * ```ts
 * import { use, isInstalled, getInstalledPlugins } from '@bquery/bquery/plugin';
 *
 * use({
 *   name: 'my-plugin',
 *   install(ctx, options) {
 *     ctx.directive('tooltip', (el, expr) => { ... });
 *     ctx.component('my-widget', MyWidgetElement);
 *   },
 * });
 * ```
 */

// Types
export type { BQueryPlugin, CustomDirective, CustomDirectiveHandler, PluginInstallContext } from './types';

// Runtime API
export {
  use,
  isInstalled,
  getInstalledPlugins,
  getCustomDirective,
  getCustomDirectives,
  resetPlugins,
} from './registry';
