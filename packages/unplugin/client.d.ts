/**
 * Ambient types for the modules `@bquery/unplugin` provides. Reference them
 * once, e.g. in `src/env.d.ts`:
 *
 * ```ts
 * /// <reference types="@bquery/unplugin/client" />
 * ```
 *
 * @module @bquery/unplugin/client
 */

declare module 'virtual:bquery/routes' {
  import type {
    CreateFileRoutesOptions,
    FileRoute,
    RouteDefinition,
    RouteManifest,
    RouteManifestEntry,
  } from '@bquery/bquery/router';

  /** The generated manifest: root-relative file path → (lazy) route module. */
  export const manifest: RouteManifest;
  /** Layout modules keyed by layout id (the layout directory's pattern). */
  export const layouts: Record<string, RouteManifestEntry>;
  /** Options the manifest was passed to `createFileRoutes()` with. */
  export const options: CreateFileRoutesOptions;
  /** Route definitions for `createRouter({ routes })` and the SSR bridge. */
  export const routes: RouteDefinition[];
  /** Normalised file routes (for `mountFileRoutes()` on the server). */
  export const entries: FileRoute[];
  export default routes;
}

declare module 'virtual:bquery/messages' {
  import type { I18nInstance, Messages } from '@bquery/bquery/i18n';

  /** Every configured catalog keyed by locale. */
  export const messages: Messages;
  /** The configured locales, source locale first. */
  export const locales: string[];
  /**
   * Registers an instance for catalog hot reloading in Vite dev: edited
   * catalogs are merged with `mergeMessages()`, then `onUpdate` runs (e.g. to
   * re-render). A no-op outside Vite dev. Returns the instance.
   */
  export function hotReload<T extends Pick<I18nInstance, 'mergeMessages'>>(
    i18n: T,
    onUpdate?: (messages: Messages) => void
  ): T;
  export default messages;
}

declare module '*.view.html' {
  /** The template markup; importing also registers its precompiled expressions. */
  const template: string;
  export default template;
}

declare module '*.html?bq-view' {
  /** The template markup; importing also registers its precompiled expressions. */
  const template: string;
  export default template;
}
