/**
 * Roving tab index utility for arrow-key navigation within groups.
 *
 * Implements the WAI-ARIA roving tabindex pattern: only one item
 * in the group has tabindex="0" (the active item), while all others
 * have tabindex="-1". Arrow keys move focus between items.
 *
 * @module bquery/a11y
 */

import type { RovingTabIndexHandle, RovingTabIndexOptions } from './types';

/**
 * Sets up roving tab index navigation for a group of elements.
 *
 * Only the active item receives `tabindex="0"`, making it the only
 * tabbable element in the group. Arrow keys move focus between items,
 * and Home/End jump to the first/last item.
 *
 * @param container - The parent element containing the navigable items
 * @param itemSelector - CSS selector for the navigable items within the container
 * @param options - Configuration options
 * @returns A handle with `destroy()`, `focusItem()`, and `activeIndex()`
 *
 * @example
 * ```ts
 * import { rovingTabIndex } from '@bquery/bquery/a11y';
 *
 * const toolbar = document.querySelector('[role="toolbar"]');
 * const handle = rovingTabIndex(toolbar, 'button', {
 *   orientation: 'horizontal',
 *   wrap: true,
 * });
 *
 * // Later, clean up
 * handle.destroy();
 * ```
 */
export const rovingTabIndex = (
  container: HTMLElement,
  itemSelector: string,
  options: RovingTabIndexOptions = {}
): RovingTabIndexHandle => {
  const { wrap = true, orientation = 'vertical', onActivate } = options;

  let currentIndex = 0;
  const originalTabIndexes = new Map<HTMLElement, string | null>();

  const getItems = (): HTMLElement[] => {
    return Array.from(container.querySelectorAll(itemSelector)) as HTMLElement[];
  };

  const trackItems = (items: HTMLElement[]): void => {
    for (const item of items) {
      if (!originalTabIndexes.has(item)) {
        originalTabIndexes.set(item, item.getAttribute('tabindex'));
      }
    }
  };

  const setActiveItem = (index: number): void => {
    const items = getItems();
    if (items.length === 0) return;
    trackItems(items);

    // Clamp index
    const clampedIndex = Math.max(0, Math.min(index, items.length - 1));

    // Update tabindex on all items
    for (let i = 0; i < items.length; i++) {
      items[i].setAttribute('tabindex', i === clampedIndex ? '0' : '-1');
    }

    currentIndex = clampedIndex;
    items[clampedIndex].focus();
    onActivate?.(items[clampedIndex], clampedIndex);
  };

  const isRelevantKey = (key: string): boolean => {
    if (key === 'Home' || key === 'End') return true;

    switch (orientation) {
      case 'horizontal':
        return key === 'ArrowLeft' || key === 'ArrowRight';
      case 'vertical':
        return key === 'ArrowUp' || key === 'ArrowDown';
      case 'both':
        return (
          key === 'ArrowLeft' ||
          key === 'ArrowRight' ||
          key === 'ArrowUp' ||
          key === 'ArrowDown'
        );
      default:
        return false;
    }
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (!isRelevantKey(event.key)) return;

    const items = getItems();
    if (items.length === 0) return;

    event.preventDefault();

    let nextIndex = currentIndex;

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        nextIndex = currentIndex + 1;
        if (nextIndex >= items.length) {
          nextIndex = wrap ? 0 : items.length - 1;
        }
        break;

      case 'ArrowUp':
      case 'ArrowLeft':
        nextIndex = currentIndex - 1;
        if (nextIndex < 0) {
          nextIndex = wrap ? items.length - 1 : 0;
        }
        break;

      case 'Home':
        nextIndex = 0;
        break;

      case 'End':
        nextIndex = items.length - 1;
        break;
    }

    setActiveItem(nextIndex);
  };

  // Initialize: set tabindex on all items
  const items = getItems();
  trackItems(items);
  for (let i = 0; i < items.length; i++) {
    items[i].setAttribute('tabindex', i === 0 ? '0' : '-1');
  }

  container.addEventListener('keydown', handleKeyDown);

  return {
    destroy: () => {
      container.removeEventListener('keydown', handleKeyDown);
      // Restore original tabindex values
      const allItems = getItems();
      for (const item of allItems) {
        const originalTabIndex = originalTabIndexes.get(item);
        if (originalTabIndex === null || originalTabIndex === undefined) {
          item.removeAttribute('tabindex');
        } else {
          item.setAttribute('tabindex', originalTabIndex);
        }
      }
      originalTabIndexes.clear();
    },

    focusItem: (index: number) => {
      setActiveItem(index);
    },

    activeIndex: () => currentIndex,
  };
};
