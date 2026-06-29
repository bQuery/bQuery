/**
 * Authoring helper for bQuery plugins.
 * @module bquery/plugin
 */

import type { BQueryPlugin } from './types';

/**
 * Identity helper that declares a plugin while preserving its literal shape and
 * inferring the `install` options type. Purely a typing/authoring convenience —
 * it returns the plugin object unchanged — that gives third-party authors a
 * single, stable entry point to target.
 *
 * Everything a plugin registers through the install `context` (directives,
 * components, filters, actions, DI bindings) is tracked automatically and torn
 * down on `uninstall(name)` / `unuse(name)`; use `context.onCleanup()` for any
 * additional teardown the plugin needs.
 *
 * @param plugin - The plugin definition (`name` + `install`, plus optional
 *   `version` / `description` / `dependencies`)
 * @returns The same plugin object, with `TOptions` inferred for `use()`
 *
 * @example
 * ```ts
 * import { definePlugin, use } from '@bquery/bquery/plugin';
 *
 * export default definePlugin({
 *   name: 'my-plugin',
 *   version: '1.0.0',
 *   async install(ctx, options: { prefix: string }) {
 *     ctx.provide('logger', console);
 *     ctx.directive('my:thing', (el) => { el.textContent = options.prefix; });
 *     ctx.addFilter('view:render', (html: string) => html);
 *     ctx.onCleanup(() => console.log('removed'));
 *   },
 * });
 * ```
 */
export const definePlugin = <TOptions = void>(
  plugin: BQueryPlugin<TOptions>
): BQueryPlugin<TOptions> => plugin;
