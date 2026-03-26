/**
 * Auto-generated skip navigation link utility.
 *
 * Creates a visually-hidden (but keyboard-focusable) "Skip to content"
 * link that becomes visible on focus, letting keyboard users bypass
 * repeated navigation.
 *
 * @module bquery/a11y
 */

import type { SkipLinkHandle, SkipLinkOptions } from './types';

/** Default CSS for the skip link — visually hidden until focused. */
const DEFAULT_STYLES = `
  position: absolute;
  top: -9999px;
  left: -9999px;
  z-index: 999999;
  padding: 0.5em 1em;
  background: #000;
  color: #fff;
  font-size: 1rem;
  text-decoration: none;
  border-radius: 0 0 4px 0;
  outline: 2px solid #4A90D9;
  outline-offset: 2px;
`;

const FOCUSED_STYLES = `
  top: 0;
  left: 0;
`;

/**
 * Creates a skip navigation link that jumps to the specified target.
 *
 * The link is visually hidden by default and becomes visible when
 * it receives keyboard focus. This follows the WCAG 2.4.1 "Bypass Blocks"
 * success criterion.
 *
 * @param targetSelector - CSS selector for the main content area (e.g. `'#main'`, `'main'`)
 * @param options - Configuration options
 * @returns A handle with `destroy()` method and reference to the created element
 *
 * @example
 * ```ts
 * import { skipLink } from '@bquery/bquery/a11y';
 *
 * // Creates a "Skip to main content" link pointing to <main>
 * const handle = skipLink('#main-content');
 *
 * // Custom text
 * const handle2 = skipLink('#content', { text: 'Jump to content' });
 *
 * // Remove when no longer needed
 * handle.destroy();
 * ```
 */
export const skipLink = (
  targetSelector: string,
  options: SkipLinkOptions = {}
): SkipLinkHandle => {
  const { text = 'Skip to main content', className = 'bq-skip-link' } = options;
  const normalizedTargetSelector = targetSelector.startsWith('#') ? targetSelector : `#${targetSelector}`;

  const link = document.createElement('a');
  link.href = normalizedTargetSelector;
  link.textContent = text;
  link.className = className;
  link.setAttribute('style', DEFAULT_STYLES);

  link.addEventListener('focus', () => {
    link.setAttribute('style', DEFAULT_STYLES + FOCUSED_STYLES);
  });

  link.addEventListener('blur', () => {
    link.setAttribute('style', DEFAULT_STYLES);
  });

  link.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.querySelector(normalizedTargetSelector) as HTMLElement | null;
    if (target) {
      // Make the target focusable if it isn't already
      if (!target.hasAttribute('tabindex')) {
        target.setAttribute('tabindex', '-1');
      }
      target.focus();
    }
  });

  // Insert as the first child of <body>
  if (document.body.firstChild) {
    document.body.insertBefore(link, document.body.firstChild);
  } else {
    document.body.appendChild(link);
  }

  return {
    destroy: () => {
      link.remove();
    },
    element: link,
  };
};
