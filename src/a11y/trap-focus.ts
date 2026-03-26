/**
 * Focus trapping utility for modals, dialogs, and popover content.
 *
 * Constrains keyboard focus within a container so that Tab and Shift+Tab
 * cycle only through the container's focusable elements.
 *
 * @module bquery/a11y
 */

import type { FocusTrapHandle, TrapFocusOptions } from './types';

/** Selector for elements that can receive focus. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
  'details > summary',
  'audio[controls]',
  'video[controls]',
].join(', ');

/**
 * Gets all focusable elements within a container.
 *
 * @param container - The container element
 * @returns Array of focusable elements
 * @internal
 */
export const getFocusableElements = (container: Element): HTMLElement[] => {
  const elements = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)) as HTMLElement[];
  return elements.filter(
    (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1 && el.getClientRects().length > 0
  );
};

/**
 * Resolves an element from a string selector or returns the element directly.
 * @internal
 */
const resolveElement = (
  target: HTMLElement | string | undefined,
  container: Element
): HTMLElement | null => {
  if (!target) return null;
  if (typeof target === 'string') {
    return container.querySelector(target) as HTMLElement | null;
  }
  return target;
};

/**
 * Traps keyboard focus within a container element.
 *
 * When activated, Tab and Shift+Tab will cycle only through focusable
 * elements within the container. Useful for modals, dialogs, and
 * dropdown menus.
 *
 * @param container - The DOM element to trap focus within
 * @param options - Configuration options
 * @returns A handle with a `release()` method to deactivate the trap
 *
 * @example
 * ```ts
 * import { trapFocus } from '@bquery/bquery/a11y';
 *
 * const dialog = document.querySelector('#my-dialog');
 * const trap = trapFocus(dialog, { escapeDeactivates: true });
 *
 * // Later, release the trap
 * trap.release();
 * ```
 */
export const trapFocus = (
  container: HTMLElement,
  options: TrapFocusOptions = {}
): FocusTrapHandle => {
  const { escapeDeactivates = true, onEscape, initialFocus, returnFocus } = options;

  const previouslyFocused = document.activeElement as HTMLElement | null;
  let active = true;

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (!active) return;

    if (event.key === 'Escape' && escapeDeactivates) {
      event.preventDefault();
      handle.release();
      onEscape?.();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusable = getFocusableElements(container);
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey) {
      // Shift+Tab: if at first element, wrap to last
      if (document.activeElement === first || !container.contains(document.activeElement)) {
        event.preventDefault();
        last.focus();
      }
    } else {
      // Tab: if at last element, wrap to first
      if (document.activeElement === last || !container.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  // Attach the event listener
  document.addEventListener('keydown', handleKeyDown, true);

  // Set initial focus
  const initialEl = resolveElement(initialFocus, container);
  if (initialEl) {
    initialEl.focus();
  } else {
    const focusable = getFocusableElements(container);
    if (focusable.length > 0) {
      focusable[0].focus();
    }
  }

  const handle: FocusTrapHandle = {
    get active() {
      return active;
    },

    release: () => {
      if (!active) return;
      active = false;
      document.removeEventListener('keydown', handleKeyDown, true);

      // Return focus
      const returnEl = resolveElement(returnFocus, document.body);
      if (returnEl) {
        returnEl.focus();
      } else if (previouslyFocused && previouslyFocused.focus) {
        previouslyFocused.focus();
      }
    },
  };

  return handle;
};

/**
 * Releases all active focus traps.
 * This is a convenience function — in most cases, use the `release()`
 * method on the individual trap handle.
 *
 * @deprecated Prefer using the handle returned by `trapFocus()` directly.
 */
export const releaseFocus = (handle: FocusTrapHandle): void => {
  handle.release();
};
