/**
 * Link helpers for client-side navigation.
 * @module bquery/router
 */

import { navigate } from './navigation';

// ============================================================================
// Router Link Helper
// ============================================================================

/**
 * Creates click handler for router links.
 * Attach to anchor elements to enable client-side navigation.
 *
 * @param path - Target path
 * @param options - Navigation options
 * @returns Click event handler
 *
 * @example
 * ```ts
 * import { link } from 'bquery/router';
 * import { $ } from 'bquery/core';
 *
 * $('#nav-home').on('click', link('/'));
 * $('#nav-about').on('click', link('/about'));
 * ```
 */
export const link = (path: string, options: { replace?: boolean } = {}): ((e: Event) => void) => {
  return (e: Event) => {
    e.preventDefault();
    navigate(path, options);
  };
};

/**
 * Intercepts all link clicks within a container for client-side routing.
 * Only intercepts links with matching origins and no target attribute.
 *
 * @param container - The container element to intercept links in
 * @returns Cleanup function to remove the listener
 *
 * @example
 * ```ts
 * import { interceptLinks } from 'bquery/router';
 *
 * // Intercept all links in the app
 * const cleanup = interceptLinks(document.body);
 *
 * // Later, remove the interceptor
 * cleanup();
 * ```
 */
export const interceptLinks = (container: Element = document.body): (() => void) => {
  const handler = (e: Event) => {
    // Guard against non-Element targets (Text nodes, etc.)
    if (!(e.target instanceof Element)) return;
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');

    if (!anchor) return;
    if (anchor.target) return; // Has target attribute
    if (anchor.hasAttribute('download')) return;
    if (anchor.origin !== window.location.origin) return; // External link

    // Detect hash-routing mode: links written as href="#/page"
    // In this case, anchor.hash contains the route path
    let path: string;
    if (anchor.hash && anchor.hash.startsWith('#/')) {
      // Hash-routing mode: extract path from the hash
      // e.g., href="#/page?foo=bar" → path = "/page?foo=bar"
      path = anchor.hash.slice(1); // Remove leading #
    } else {
      // History mode or regular anchor: use pathname + search + hash
      path = anchor.pathname + anchor.search + anchor.hash;
    }

    e.preventDefault();
    navigate(path);
  };

  container.addEventListener('click', handler);
  return () => container.removeEventListener('click', handler);
};
