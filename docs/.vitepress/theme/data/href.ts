import { withBase } from 'vitepress';

/**
 * Resolve a link for use in a hand-written `href`.
 *
 * VitePress rewrites links it finds in markdown, but not the ones in theme
 * components, so internal paths have to be passed through `withBase()` or the
 * site breaks when it is served from a sub-path (`VITEPRESS_BASE`).
 */
export function href(link: string): string {
  return /^(?:[a-z]+:|\/\/)/i.test(link) ? link : withBase(link);
}

/** True for links that leave the docs site. */
export function isExternal(link: string): boolean {
  return /^(?:https?:|\/\/)/i.test(link);
}
