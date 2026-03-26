/**
 * Define drop zones for draggable elements.
 *
 * Drop zones detect when draggable elements enter, move over,
 * leave, or are dropped onto them using pointer event hit-testing.
 *
 * @module bquery/dnd
 */

import type { DropEventData, DroppableHandle, DroppableOptions } from './types';
import { getActiveDrag } from './draggable';

/**
 * Checks whether a dragged element is accepted by the drop zone.
 * @internal
 */
const isAccepted = (
  dragged: HTMLElement,
  accept: DroppableOptions['accept']
): boolean => {
  if (!accept) return true;
  if (typeof accept === 'string') return dragged.matches(accept);
  return accept(dragged);
};

/**
 * Defines an element as a drop zone.
 *
 * Drop zones respond to draggable elements being moved over them
 * by firing callbacks and applying CSS classes. They work with
 * the `draggable()` function from this module.
 *
 * @param el - The drop zone element
 * @param options - Configuration options
 * @returns A handle with a `destroy()` method
 *
 * @example
 * ```ts
 * import { droppable } from '@bquery/bquery/dnd';
 *
 * const handle = droppable(document.querySelector('#dropzone'), {
 *   accept: '.draggable-item',
 *   overClass: 'drop-active',
 *   onDrop: ({ dragged }) => {
 *     console.log('Dropped:', dragged);
 *   },
 * });
 *
 * // Later:
 * handle.destroy();
 * ```
 */
export const droppable = (
  el: HTMLElement,
  options: DroppableOptions = {}
): DroppableHandle => {
  const {
    overClass = 'bq-drop-over',
    accept,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop,
  } = options;

  let isOver = false;
  let currentDragged: HTMLElement | null = null;

  const createEventData = (
    dragged: HTMLElement,
    event: PointerEvent
  ): DropEventData => ({
    zone: el,
    dragged,
    event,
  });

  const handlePointerMove = (e: PointerEvent): void => {
    // Check if the pointer is over this drop zone
    const rect = el.getBoundingClientRect();
    const isInside =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;

    // Resolve the current dragged element via the shared drag registry.
    const dragged = getActiveDrag()?.element ?? null;
    if (!dragged || dragged === el) return;

    if (!isAccepted(dragged, accept)) return;

    if (isInside && !isOver) {
      isOver = true;
      currentDragged = dragged;
      el.classList.add(overClass);
      onDragEnter?.(createEventData(dragged, e));
    } else if (isInside && isOver) {
      onDragOver?.(createEventData(dragged, e));
    } else if (!isInside && isOver) {
      isOver = false;
      el.classList.remove(overClass);
      onDragLeave?.(createEventData(dragged, e));
      currentDragged = null;
    }
  };

  const handlePointerUp = (e: PointerEvent): void => {
    if (isOver && currentDragged) {
      onDrop?.(createEventData(currentDragged, e));
      isOver = false;
      el.classList.remove(overClass);
      currentDragged = null;
    }
  };

  // Listen on document to track pointer globally
  document.addEventListener('pointermove', handlePointerMove);
  document.addEventListener('pointerup', handlePointerUp);

  return {
    destroy: () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      el.classList.remove(overClass);
    },
  };
};
