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

let skipTargetIdCounter = 0;
const generatedSkipTargetRefs = new Map<string, { count: number; target: HTMLElement }>();
/** Matches a bare element id value (not a general CSS selector). */
const BARE_ID_SELECTOR_RE = /^[A-Za-z][\w-]*$/;

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
  let trackedGeneratedTargetId: string | undefined;
  const isBareIdSelector = BARE_ID_SELECTOR_RE.test(targetSelector);
  const releaseTrackedGeneratedTargetId = (): void => {
    if (!trackedGeneratedTargetId) return;

    const entry = generatedSkipTargetRefs.get(trackedGeneratedTargetId);
    const remainingRefs = (entry?.count ?? 0) - 1;
    if (remainingRefs <= 0) {
      generatedSkipTargetRefs.delete(trackedGeneratedTargetId);
      if (entry?.target.isConnected && entry.target.id === trackedGeneratedTargetId) {
        entry.target.removeAttribute('id');
      }
    } else {
      generatedSkipTargetRefs.set(trackedGeneratedTargetId, {
        count: remainingRefs,
        target: entry!.target,
      });
    }

    trackedGeneratedTargetId = undefined;
  };
  const trackGeneratedTargetId = (target: HTMLElement, id: string): void => {
    if (trackedGeneratedTargetId === id) return;
    releaseTrackedGeneratedTargetId();
    const entry = generatedSkipTargetRefs.get(id);
    generatedSkipTargetRefs.set(id, {
      count: (entry?.count ?? 0) + 1,
      target,
    });
    trackedGeneratedTargetId = id;
  };
  const resolveTarget = (): HTMLElement | null => {
    if (targetSelector.startsWith('#')) {
      return document.querySelector(targetSelector) as HTMLElement | null;
    }

    return (
      (isBareIdSelector ? document.getElementById(targetSelector) : null) ??
      (document.querySelector(targetSelector) as HTMLElement | null)
    );
  };

  const ensureTargetId = (target: HTMLElement): string => {
    if (target.id) {
      const generatedTarget = generatedSkipTargetRefs.get(target.id);
      if (generatedTarget?.target === target) {
        trackGeneratedTargetId(target, target.id);
      }
      return target.id;
    }

    skipTargetIdCounter += 1;
    const generatedTargetId = `bq-skip-target-${skipTargetIdCounter}`;
    target.id = generatedTargetId;
    trackGeneratedTargetId(target, generatedTargetId);
    return generatedTargetId;
  };

  const link = document.createElement('a');
  const initialTarget = resolveTarget();
  link.href = targetSelector.startsWith('#')
    ? targetSelector
    : initialTarget
      ? `#${ensureTargetId(initialTarget)}`
      : `#${targetSelector}`;
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
    const target = resolveTarget();
    if (target) {
      link.href = `#${ensureTargetId(target)}`;
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
      releaseTrackedGeneratedTargetId();
      link.remove();
    },
    element: link,
  };
};
