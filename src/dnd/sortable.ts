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
const getItems = (container: HTMLElement, selector: string): HTMLElement[] => {
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
  let closest: { element: HTMLElement; index: number; distance: number } | null = null;

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
export const sortable = (container: HTMLElement, options: SortableOptions = {}): SortableHandle => {
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

  const createEventData = (item: HTMLElement, oldIdx: number, newIdx: number): SortEventData => ({
    container,
    item,
    oldIndex: oldIdx,
    newIndex: newIdx,
  });

  const getReorderIndex = (
    anchor: HTMLElement,
    dragged: HTMLElement | null,
    sortableItems: readonly HTMLElement[]
  ): number => {
    let index = 0;

    for (const child of Array.from(container.children)) {
      if (child === anchor) return index;
      if (child === dragged) continue;
      if (sortableItems.includes(child as HTMLElement)) index += 1;
    }

    return index;
  };

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

    const currentIndex = getReorderIndex(placeholder, dragItem, items);
    onSortMove?.(createEventData(dragItem, startIndex, currentIndex));
  };

  const onPointerUp = (e: PointerEvent): void => {
    if (!isDragging || !dragItem || !placeholder) return;

    isDragging = false;
    const draggedItem = dragItem;

    // Get final index
    const items = getItems(container, itemSelector);
    const newIndex = getReorderIndex(placeholder, draggedItem, items);

    // Animate the item back to the placeholder position
    const placeholderRect = placeholder.getBoundingClientRect();
    const itemRect = draggedItem.getBoundingClientRect();

    if (animationDuration > 0) {
      const deltaX = placeholderRect.left - itemRect.left;
      const deltaY = placeholderRect.top - itemRect.top;

      draggedItem.style.transition = `transform ${animationDuration}ms ease`;
      draggedItem.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

      let finalized = false;
      let timeoutId: number | null = null;
      const finalize = (): void => {
        if (finalized) return;
        finalized = true;
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
          timeoutId = null;
        }
        resetDragItem();
        onSortEnd?.(createEventData(draggedItem, startIndex, newIndex));
      };
      timeoutId = window.setTimeout(() => {
        finalize();
      }, animationDuration + 50);

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
    getItems: () => getItems(container, itemSelector),
    move: (fromIndex: number, toIndex: number) => {
      const list = getItems(container, itemSelector);
      if (list.length === 0) return;
      const clampedFrom = Math.max(0, Math.min(fromIndex, list.length - 1));
      const clampedTo = Math.max(0, Math.min(toIndex, list.length - 1));
      if (clampedFrom === clampedTo) return;
      const item = list[clampedFrom];
      // Insert before the target index. When moving forward, account for the
      // fact that `item` is removed before re-insertion: insert before the
      // element that is currently at `clampedTo + 1` if moving down, or at
      // `clampedTo` if moving up.
      const reference =
        clampedFrom < clampedTo ? (list[clampedTo + 1] ?? null) : list[clampedTo];
      container.insertBefore(item, reference);
      onSortEnd?.(createEventData(item, clampedFrom, clampedTo));
    },
    setOrder: (indices: readonly number[]) => {
      const list = getItems(container, itemSelector);
      if (indices.length !== list.length) {
        throw new Error(
          `sortable.setOrder: indices length (${indices.length}) must equal item count (${list.length})`
        );
      }
      // Validate permutation.
      const seen = new Set<number>();
      for (const i of indices) {
        if (i < 0 || i >= list.length || !Number.isInteger(i) || seen.has(i)) {
          throw new Error(
            `sortable.setOrder: indices must be a permutation of [0, …, ${list.length - 1}]`
          );
        }
        seen.add(i);
      }
      // Append in the requested order; appendChild moves the node, so we end
      // up with the desired permutation regardless of original DOM position.
      for (const i of indices) {
        container.appendChild(list[i]);
      }
      const newIndex = indices.findIndex((oldIndex, index) => oldIndex !== index);
      if (newIndex !== -1) {
        const oldIndex = indices[newIndex];
        onSortEnd?.(createEventData(list[oldIndex], oldIndex, newIndex));
      }
    },
  };
};
