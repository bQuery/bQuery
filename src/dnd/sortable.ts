/**
 * Sortable list with animated reordering via pointer events.
 *
 * Makes children of a container sortable by dragging. Items are
 * rearranged in the DOM with optional CSS animation.
 *
 * @module bquery/dnd
 */

import type { SortEventData, SortableHandle, SortableOptions } from './types';

/**
 * Gets the sortable items within a container.
 * @internal
 */
const getItems = (
  container: HTMLElement,
  selector: string
): HTMLElement[] => {
  return Array.from(container.querySelectorAll(selector)) as HTMLElement[];
};

/**
 * Finds the closest sortable item to a given Y (or X) position.
 * @internal
 */
const getClosestItem = (
  items: HTMLElement[],
  clientPos: number,
  axis: 'x' | 'y',
  dragged: HTMLElement
): { element: HTMLElement; index: number } | null => {
  let closest: { element: HTMLElement; index: number; distance: number } | null =
    null;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item === dragged) continue;

    const rect = item.getBoundingClientRect();
    const mid = axis === 'y' ? rect.top + rect.height / 2 : rect.left + rect.width / 2;
    const distance = clientPos - mid;

    if (
      closest === null ||
      (distance < 0 && distance > closest.distance) ||
      (closest.distance >= 0 && distance < 0 && Math.abs(distance) < Math.abs(closest.distance))
    ) {
      // Find the item we're just before
      if (distance < 0) {
        closest = { element: item, index: i, distance };
      }
    }
  }

  return closest ? { element: closest.element, index: closest.index } : null;
};

/**
 * Makes the children of a container sortable by dragging.
 *
 * Features:
 * - Pointer event based (touch + mouse)
 * - Animated reordering with configurable duration
 * - Axis constraint (vertical or horizontal)
 * - Optional drag handle
 * - Placeholder element during sort
 * - Callbacks: `onSortStart`, `onSortMove`, `onSortEnd`
 *
 * @param container - The container element whose children will be sortable
 * @param options - Configuration options
 * @returns A handle with `destroy()`, `disable()`, and `enable()` methods
 *
 * @example
 * ```ts
 * import { sortable } from '@bquery/bquery/dnd';
 *
 * const handle = sortable(document.querySelector('#list'), {
 *   items: 'li',
 *   axis: 'y',
 *   animationDuration: 200,
 *   onSortEnd: ({ oldIndex, newIndex }) => {
 *     console.log(`Moved from ${oldIndex} to ${newIndex}`);
 *   },
 * });
 *
 * // Later:
 * handle.destroy();
 * ```
 */
export const sortable = (
  container: HTMLElement,
  options: SortableOptions = {}
): SortableHandle => {
  const {
    items: itemSelector = ':scope > *',
    axis = 'y',
    handle,
    placeholderClass = 'bq-sort-placeholder',
    sortingClass = 'bq-sorting',
    animationDuration = 200,
    onSortStart,
    onSortMove,
    onSortEnd,
  } = options;

  let enabled = !options.disabled;
  let isDragging = false;
  let dragItem: HTMLElement | null = null;
  let placeholder: HTMLElement | null = null;
  let startIndex = -1;
  let startPointerY = 0;
  let startPointerX = 0;
  let itemStartTop = 0;
  let itemStartLeft = 0;

  const createEventData = (
    item: HTMLElement,
    oldIdx: number,
    newIdx: number
  ): SortEventData => ({
    container,
    item,
    oldIndex: oldIdx,
    newIndex: newIdx,
  });

  const onPointerDown = (e: PointerEvent): void => {
    if (!enabled) return;

    const target = e.target as HTMLElement;

    // Find the item being dragged
    const items = getItems(container, itemSelector);
    let item: HTMLElement | null = null;

    for (const it of items) {
      if (it.contains(target)) {
        item = it;
        break;
      }
    }

    if (!item) return;

    // Check handle constraint
    if (handle && !target.closest(handle)) return;

    e.preventDefault();

    isDragging = true;
    dragItem = item;
    startIndex = items.indexOf(item);
    startPointerY = e.clientY;
    startPointerX = e.clientX;

    const rect = item.getBoundingClientRect();
    itemStartTop = rect.top;
    itemStartLeft = rect.left;

    // Create placeholder
    placeholder = document.createElement('div');
    placeholder.classList.add(placeholderClass);
    placeholder.style.width = `${rect.width}px`;
    placeholder.style.height = `${rect.height}px`;
    placeholder.style.boxSizing = 'border-box';

    // Style the dragged item
    item.classList.add(sortingClass);
    item.style.position = 'fixed';
    item.style.width = `${rect.width}px`;
    item.style.height = `${rect.height}px`;
    item.style.left = `${rect.left}px`;
    item.style.top = `${rect.top}px`;
    item.style.zIndex = '999999';
    item.style.pointerEvents = 'none';
    item.style.margin = '0';

    // Insert placeholder where the item was
    item.parentNode?.insertBefore(placeholder, item);

    container.setPointerCapture(e.pointerId);

    onSortStart?.(createEventData(item, startIndex, startIndex));
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (!isDragging || !dragItem || !placeholder) return;

    e.preventDefault();

    const deltaX = e.clientX - startPointerX;
    const deltaY = e.clientY - startPointerY;

    // Move the dragged item
    if (axis === 'y') {
      dragItem.style.top = `${itemStartTop + deltaY}px`;
    } else {
      dragItem.style.left = `${itemStartLeft + deltaX}px`;
    }

    // Find the closest item to determine insertion point
    const items = getItems(container, itemSelector);
    const clientPos = axis === 'y' ? e.clientY : e.clientX;
    const closest = getClosestItem(items, clientPos, axis, dragItem);

    if (closest) {
      // Move placeholder before the closest element
      container.insertBefore(placeholder, closest.element);
    } else {
      // Append to end
      container.appendChild(placeholder);
    }

    const currentIndex = Array.from(container.children).indexOf(placeholder);
    onSortMove?.(createEventData(dragItem, startIndex, currentIndex));
  };

  const onPointerUp = (e: PointerEvent): void => {
    if (!isDragging || !dragItem || !placeholder) return;

    isDragging = false;
    const draggedItem = dragItem;

    // Get final index
    const newIndex = Array.from(container.children).indexOf(placeholder);

    // Animate the item back to the placeholder position
    const placeholderRect = placeholder.getBoundingClientRect();
    const itemRect = draggedItem.getBoundingClientRect();

    if (animationDuration > 0) {
      const deltaX = placeholderRect.left - itemRect.left;
      const deltaY = placeholderRect.top - itemRect.top;

      draggedItem.style.transition = `transform ${animationDuration}ms ease`;
      draggedItem.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

      let finalized = false;
      const timeoutId = window.setTimeout(() => {
        finalize();
      }, animationDuration + 50);

      const finalize = (): void => {
        if (finalized) return;
        finalized = true;
        window.clearTimeout(timeoutId);
        resetDragItem();
        onSortEnd?.(createEventData(draggedItem, startIndex, newIndex));
      };

      draggedItem.addEventListener('transitionend', finalize, { once: true });
    } else {
      resetDragItem();
      onSortEnd?.(createEventData(draggedItem, startIndex, newIndex));
    }

    container.releasePointerCapture(e.pointerId);
  };

  const resetDragItem = (): void => {
    if (!dragItem || !placeholder) return;

    // Insert the real item where the placeholder is
    placeholder.parentNode?.insertBefore(dragItem, placeholder);
    placeholder.remove();
    placeholder = null;

    // Reset styles
    dragItem.classList.remove(sortingClass);
    dragItem.style.position = '';
    dragItem.style.width = '';
    dragItem.style.height = '';
    dragItem.style.left = '';
    dragItem.style.top = '';
    dragItem.style.zIndex = '';
    dragItem.style.pointerEvents = '';
    dragItem.style.margin = '';
    dragItem.style.transition = '';
    dragItem.style.transform = '';

    dragItem = null;
  };

  container.addEventListener('pointerdown', onPointerDown);
  container.addEventListener('pointermove', onPointerMove);
  container.addEventListener('pointerup', onPointerUp);
  container.addEventListener('pointercancel', onPointerUp);

  // Prevent default touch behavior on container
  container.style.touchAction = 'none';

  return {
    destroy: () => {
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('pointercancel', onPointerUp);
      container.style.touchAction = '';

      if (isDragging) {
        resetDragItem();
      }
    },
    disable: () => {
      enabled = false;
    },
    enable: () => {
      enabled = true;
    },
    get enabled() {
      return enabled;
    },
  };
};
