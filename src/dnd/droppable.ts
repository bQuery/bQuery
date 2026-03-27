/**
 * Define drop zones for draggable elements.
 *
 * Drop zones detect when draggable elements enter, move over,
 * leave, or are dropped onto them using pointer event hit-testing.
 *
 * @module bquery/dnd
 */

import { getActiveDrag } from './draggable';
import type { DropEventData, DroppableHandle, DroppableOptions } from './types';

type DroppableListener = {
  handlePointerMove: (event: PointerEvent) => void;
  handlePointerUp: (event: PointerEvent) => void;
};

const droppableListeners = new Set<DroppableListener>();
let queuedPointerMove: PointerEvent | null = null;
let pointerMoveFrame: number | null = null;

const hasDroppableEnvironment = (): boolean => {
  return (
    typeof document !== 'undefined' &&
    typeof document.addEventListener === 'function' &&
    typeof document.removeEventListener === 'function' &&
    typeof requestAnimationFrame === 'function' &&
    typeof cancelAnimationFrame === 'function'
  );
};

const dispatchPointerMove = (event: PointerEvent): void => {
  for (const listener of droppableListeners) {
    listener.handlePointerMove(event);
  }
};

const flushPointerMove = (): void => {
  pointerMoveFrame = null;
  const event = queuedPointerMove;
  queuedPointerMove = null;
  if (!event) return;
  dispatchPointerMove(event);
};

const handleDocumentPointerMove = (event: PointerEvent): void => {
  queuedPointerMove = event;
  if (pointerMoveFrame === null) {
    pointerMoveFrame = requestAnimationFrame(flushPointerMove);
  }
};

const handleDocumentPointerUp = (event: PointerEvent): void => {
  if (pointerMoveFrame !== null) {
    cancelAnimationFrame(pointerMoveFrame);
    pointerMoveFrame = null;
    queuedPointerMove = null;
  }

  for (const listener of droppableListeners) {
    listener.handlePointerUp(event);
  }
};

const registerDroppableListener = (listener: DroppableListener): void => {
  if (droppableListeners.size === 0) {
    document.addEventListener('pointermove', handleDocumentPointerMove);
    document.addEventListener('pointerup', handleDocumentPointerUp);
  }

  droppableListeners.add(listener);
};

const unregisterDroppableListener = (listener: DroppableListener): void => {
  droppableListeners.delete(listener);

  if (droppableListeners.size !== 0) return;

  document.removeEventListener('pointermove', handleDocumentPointerMove);
  document.removeEventListener('pointerup', handleDocumentPointerUp);
  if (pointerMoveFrame !== null) {
    cancelAnimationFrame(pointerMoveFrame);
    pointerMoveFrame = null;
  }
  queuedPointerMove = null;
};

/**
 * Checks whether a dragged element is accepted by the drop zone.
 * @internal
 */
const isAccepted = (dragged: HTMLElement, accept: DroppableOptions['accept']): boolean => {
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
export const droppable = (el: HTMLElement, options: DroppableOptions = {}): DroppableHandle => {
  const {
    overClass = 'bq-drop-over',
    accept,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop,
  } = options;

  if (!hasDroppableEnvironment()) {
    return {
      destroy: () => {},
    };
  }

  let isOver = false;
  let currentDragged: HTMLElement | null = null;

  const createEventData = (dragged: HTMLElement, event: PointerEvent): DropEventData => ({
    zone: el,
    dragged,
    event,
  });

  const isPointerInside = (event: PointerEvent): boolean => {
    const rect = el.getBoundingClientRect();
    return (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    );
  };

  const resolveDraggedElement = (): HTMLElement | null => {
    return getActiveDrag()?.element ?? currentDragged;
  };

  const clearOverState = (event: PointerEvent, dragged = currentDragged): void => {
    if (!isOver) return;
    isOver = false;
    el.classList.remove(overClass);
    if (dragged) {
      onDragLeave?.(createEventData(dragged, event));
    }
    currentDragged = null;
  };

  const handlePointerMove = (e: PointerEvent): void => {
    const dragged = getActiveDrag()?.element ?? null;
    const isInside = isPointerInside(e);
    const acceptsDragged = dragged !== null && dragged !== el && isAccepted(dragged, accept);

    if (!acceptsDragged || !isInside) {
      clearOverState(e, dragged ?? currentDragged);
      return;
    }

    if (!isOver) {
      isOver = true;
      currentDragged = dragged;
      el.classList.add(overClass);
      onDragEnter?.(createEventData(dragged, e));
    } else {
      onDragOver?.(createEventData(dragged, e));
    }
  };

  const handlePointerUp = (e: PointerEvent): void => {
    const dragged = resolveDraggedElement();
    const isInside = isPointerInside(e);
    const acceptsDragged = dragged !== null && dragged !== el && isAccepted(dragged, accept);

    if (isInside && acceptsDragged && dragged) {
      onDrop?.(createEventData(dragged, e));
    }

    if (isOver) {
      isOver = false;
      el.classList.remove(overClass);
    }
    currentDragged = null;
  };

  const listener: DroppableListener = { handlePointerMove, handlePointerUp };
  registerDroppableListener(listener);

  return {
    destroy: () => {
      unregisterDroppableListener(listener);
      el.classList.remove(overClass);
      currentDragged = null;
    },
  };
};
