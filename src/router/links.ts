/**
 * Link helpers for client-side navigation.
 * @module bquery/router
 */

import { getActiveRouter } from './state';
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
    void navigate(path, options).catch((err) => {
      console.error('Navigation failed:', err);
    });
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
export const interceptLinks = (container?: Element): (() => void) => {
  // Provide safe default in DOM environments only
  const targetContainer = container ?? (typeof document !== 'undefined' ? document.body : null);
  if (!targetContainer) {
    // No container available (SSR or invalid input)
    return () => undefined;
  }

  const handler = (e: Event) => {
    // Guard against non-Element targets and non-DOM environments
    if (typeof Element === 'undefined' || !(e.target instanceof Element)) return;
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');

    if (!anchor) return;
    
    // Cross-realm compatible anchor check: use owner document's constructor if available
    const anchorWindow = anchor.ownerDocument.defaultView;
    const AnchorConstructor = anchorWindow?.HTMLAnchorElement ?? HTMLAnchorElement;
    if (!(anchor instanceof AnchorConstructor)) return;
    
    if (anchor.target) return; // Has target attribute
    if (anchor.hasAttribute('download')) return;
    if (typeof window === 'undefined' || anchor.origin !== window.location.origin) return; // External link or non-window environment

    // Get active router config to handle base paths correctly.
    // If no router is active, proceed with no base/hash; navigate() will throw a
    // "No router initialized" error, which is caught and logged below.
    const router = getActiveRouter();
    if (!router) {
      // No active router - trigger navigate(), allowing its error to be logged here
      e.preventDefault();
      void navigate(anchor.pathname + anchor.search + anchor.hash).catch((err) => {
        console.error('Navigation failed:', err);
      });
      return;
    }

    const base = router.base;
    const useHash = router.hash;

    // Detect hash-routing mode: links written as href="#/page"
    // In this case, anchor.hash contains the route path
    let path: string;
    if (useHash && anchor.hash && anchor.hash.startsWith('#/')) {
      // Hash-routing mode: extract path from the hash
      // e.g., href="#/page?foo=bar" → path = "/page?foo=bar"
      path = anchor.hash.slice(1); // Remove leading #
    } else {
      // History mode: use pathname + search + hash
      // Strip base from pathname to avoid duplication (router.push() re-adds it)
      let pathname = anchor.pathname;
      if (base && base !== '/' && pathname.startsWith(base)) {
        pathname = pathname.slice(base.length) || '/';
      }
      path = pathname + anchor.search + anchor.hash;
    }

    e.preventDefault();
    void navigate(path).catch((err) => {
      console.error('Navigation failed:', err);
    });
  };

  targetContainer.addEventListener('click', handler);
  return () => targetContainer.removeEventListener('click', handler);
};
