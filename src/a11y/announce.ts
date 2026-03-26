/**
 * Screen reader announcement utility using ARIA live regions.
 *
 * Creates and manages off-screen live regions to announce dynamic
 * content changes to assistive technologies.
 *
 * @module bquery/a11y
 */

import type { AnnouncePriority } from './types';

/** Cache for live region containers, keyed by priority. */
const liveRegions = new Map<AnnouncePriority, HTMLElement>();

/**
 * Delay in milliseconds before updating the live region text.
 * This ensures screen readers detect the content change even when
 * the same message is announced consecutively — clearing first and
 * setting after a microtask forces a new live-region mutation event.
 * @internal
 */
const ANNOUNCEMENT_DELAY_MS = 50;

/**
 * Gets or creates a visually-hidden ARIA live region for the given priority.
 *
 * @param priority - The aria-live priority level
 * @returns The live region element
 * @internal
 */
const getOrCreateLiveRegion = (priority: AnnouncePriority): HTMLElement => {
  const existing = liveRegions.get(priority);
  if (existing && existing.isConnected) {
    return existing;
  }

  const el = document.createElement('div');
  el.setAttribute('aria-live', priority);
  el.setAttribute('aria-atomic', 'true');
  el.setAttribute('role', priority === 'assertive' ? 'alert' : 'status');

  // Visually hidden but accessible to screen readers
  Object.assign(el.style, {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: '0',
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: '0',
  });

  document.body.appendChild(el);
  liveRegions.set(priority, el);

  return el;
};

/**
 * Announces a message to screen readers via an ARIA live region.
 *
 * The message is injected into a visually-hidden live region element.
 * Screen readers will pick up the change and announce it to the user.
 *
 * @param message - The text message to announce
 * @param priority - The urgency level: `'polite'` (default) or `'assertive'`
 *
 * @example
 * ```ts
 * import { announceToScreenReader } from '@bquery/bquery/a11y';
 *
 * // Polite announcement (waits for idle)
 * announceToScreenReader('3 search results found');
 *
 * // Assertive announcement (interrupts current speech)
 * announceToScreenReader('Error: Please fix the form', 'assertive');
 * ```
 */
export const announceToScreenReader = (
  message: string,
  priority: AnnouncePriority = 'polite'
): void => {
  if (!message) return;

  const region = getOrCreateLiveRegion(priority);

  // Clear first, then set after a microtask to ensure screen readers
  // detect the change even if the same message is announced twice.
  region.textContent = '';

  // Use setTimeout to ensure the DOM update triggers a live region change event
  setTimeout(() => {
    region.textContent = message;
  }, ANNOUNCEMENT_DELAY_MS);
};

/**
 * Removes all live region elements created by `announceToScreenReader`.
 * Useful for cleanup in tests or when unmounting an application.
 *
 * @example
 * ```ts
 * import { clearAnnouncements } from '@bquery/bquery/a11y';
 *
 * clearAnnouncements();
 * ```
 */
export const clearAnnouncements = (): void => {
  for (const [, el] of liveRegions) {
    el.remove();
  }
  liveRegions.clear();
};
