/**
 * Make an element draggable using pointer events.
 *
 * Uses Pointer Events (not HTML5 Drag & Drop) for reliable
 * cross-platform behavior including touch support.
 *
 * @module bquery/dnd
 */

import type {
  BoundsRect,
  DragBounds,
  DragEventData,
  DragPosition,
  DraggableHandle,
  DraggableOptions,
} from './types';

/** Global registry of active draggable elements for drop zone detection. */
const activeDrags = new Map<
  HTMLElement,
  { element: HTMLElement; position: DragPosition }
>();

/**
 * Returns the currently active drag state, if any.
 * Used internally by `droppable()` to detect drag interactions.
 * @internal
 */
export const getActiveDrag = ():
  | { element: HTMLElement; position: DragPosition }
  | undefined => {
  const entries = Array.from(activeDrags.values());
  return entries[entries.length - 1];
};

/**
 * Resolves a `DragBounds` value to an absolute `BoundsRect`.
 * @internal
 */
const resolveBounds = (
  el: HTMLElement,
  bounds: DragBounds
): BoundsRect | null => {
  if (typeof bounds === 'object') {
    return bounds;
  }

  let target: HTMLElement | null = null;

  if (bounds === 'parent') {
    target = el.parentElement;
  } else {
    target = document.querySelector(bounds) as HTMLElement | null;
  }

  if (!target) return null;

  const rect = target.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const rawLeft = parseFloat(el.style.left || '0');
  const rawTop = parseFloat(el.style.top || '0');
  const leftOffset = Number.isNaN(rawLeft) ? 0 : rawLeft;
  const topOffset = Number.isNaN(rawTop) ? 0 : rawTop;

  return {
    left: rect.left - elRect.left + leftOffset,
    top: rect.top - elRect.top + topOffset,
    right:
      rect.right -
      elRect.right +
      leftOffset +
      (rect.width - elRect.width),
    bottom:
      rect.bottom -
      elRect.bottom +
      topOffset +
      (rect.height - elRect.height),
  };
};

/**
 * Clamp a position within bounds.
 * @internal
 */
const clampPosition = (
  pos: DragPosition,
  bounds: BoundsRect | null
): DragPosition => {
  if (!bounds) return pos;
  return {
    x: Math.max(bounds.left, Math.min(bounds.right, pos.x)),
    y: Math.max(bounds.top, Math.min(bounds.bottom, pos.y)),
  };
};

/**
 * Makes an element draggable using pointer events.
 *
 * Features:
 * - Touch and mouse support via Pointer Events
 * - Axis locking (`x`, `y`, or `both`)
 * - Bounds constraint (parent, selector, or explicit rect)
 * - Optional drag handle
 * - Ghost/clone preview during drag
 * - Callbacks: `onDragStart`, `onDrag`, `onDragEnd`
 *
 * @param el - The element to make draggable
 * @param options - Configuration options
 * @returns A handle with `destroy()`, `disable()`, and `enable()` methods
 *
 * @example
 * ```ts
 * import { draggable } from '@bquery/bquery/dnd';
 *
 * const handle = draggable(document.querySelector('#box'), {
 *   axis: 'both',
 *   bounds: 'parent',
 *   onDragEnd: ({ position }) => {
 *     console.log('Dropped at', position.x, position.y);
 *   },
 * });
 *
 * // Later:
 * handle.destroy();
 * ```
 */
export const draggable = (
  el: HTMLElement,
  options: DraggableOptions = {}
): DraggableHandle => {
  const {
    axis = 'both',
    bounds,
    handle,
    ghost = false,
    ghostClass = 'bq-drag-ghost',
    draggingClass = 'bq-dragging',
    onDragStart,
    onDrag,
    onDragEnd,
  } = options;

  let enabled = !options.disabled;
  let isDragging = false;
  let startPointer: DragPosition = { x: 0, y: 0 };
  let currentPosition: DragPosition = { x: 0, y: 0 };
  let previousPosition: DragPosition = { x: 0, y: 0 };
  let ghostEl: HTMLElement | null = null;
  let ghostStartPosition: DragPosition | null = null;
  const previousTouchAction = el.style.touchAction;
  const previousUserSelect = el.style.userSelect;

  const createEventData = (event: PointerEvent): DragEventData => ({
    element: el,
    position: { ...currentPosition },
    delta: {
      x: currentPosition.x - previousPosition.x,
      y: currentPosition.y - previousPosition.y,
    },
    event,
  });

  const createGhost = (): HTMLElement => {
    const clone = el.cloneNode(true) as HTMLElement;
    const rect = el.getBoundingClientRect();
    clone.classList.add(ghostClass);
    clone.style.position = 'fixed';
    clone.style.left = `${rect.left}px`;
    clone.style.top = `${rect.top}px`;
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    clone.style.pointerEvents = 'none';
    clone.style.zIndex = '999999';
    clone.style.opacity = '0.7';
    clone.style.margin = '0';
    document.body.appendChild(clone);
    return clone;
  };

  const removeGhost = (): void => {
    if (ghostEl) {
      ghostEl.remove();
      ghostEl = null;
    }
    ghostStartPosition = null;
  };

  const onPointerDown = (e: PointerEvent): void => {
    if (!enabled) return;

    // Check handle constraint
    if (handle) {
      const target = e.target as Element;
      if (!target.closest(handle)) return;
    }

    e.preventDefault();
    isDragging = true;
    startPointer = { x: e.clientX, y: e.clientY };
    previousPosition = { ...currentPosition };

    el.classList.add(draggingClass);
    el.setPointerCapture(e.pointerId);

    if (ghost) {
      const rect = el.getBoundingClientRect();
      ghostStartPosition = { x: rect.left, y: rect.top };
      ghostEl = createGhost();
    }

    // Register in global active drags
    activeDrags.set(el, { element: el, position: currentPosition });

    onDragStart?.(createEventData(e));
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (!isDragging) return;

    e.preventDefault();
    previousPosition = { ...currentPosition };

    let newX = currentPosition.x + (e.clientX - startPointer.x);
    let newY = currentPosition.y + (e.clientY - startPointer.y);

    // Reset start pointer to current for delta calculation
    startPointer = { x: e.clientX, y: e.clientY };

    // Apply axis constraint
    if (axis === 'x') newY = currentPosition.y;
    if (axis === 'y') newX = currentPosition.x;

    let newPos: DragPosition = { x: newX, y: newY };

    // Apply bounds constraint
    if (bounds) {
      const resolvedBounds = resolveBounds(el, bounds);
      newPos = clampPosition(newPos, resolvedBounds);
    }

    currentPosition = newPos;

    // Update active drag position
    activeDrags.set(el, { element: el, position: currentPosition });

    // Apply the position
    if (ghost && ghostEl) {
      const start = ghostStartPosition ?? {
        x: el.getBoundingClientRect().left,
        y: el.getBoundingClientRect().top,
      };
      ghostEl.style.left = `${start.x + currentPosition.x}px`;
      ghostEl.style.top = `${start.y + currentPosition.y}px`;
    } else {
      el.style.transform = `translate(${currentPosition.x}px, ${currentPosition.y}px)`;
    }

    onDrag?.(createEventData(e));
  };

  const onPointerUp = (e: PointerEvent): void => {
    if (!isDragging) return;

    isDragging = false;
    el.classList.remove(draggingClass);
    try {
      if (
        typeof el.releasePointerCapture === 'function' &&
        (typeof el.hasPointerCapture !== 'function' || el.hasPointerCapture(e.pointerId))
      ) {
        el.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Pointer capture may already be released in some interrupted drag flows.
    } finally {
      removeGhost();

      // Remove from active drags
      activeDrags.delete(el);

      onDragEnd?.(createEventData(e));
    }
  };

  // Attach listeners
  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onPointerUp);

  // Prevent default drag behavior
  el.style.touchAction = 'none';
  el.style.userSelect = 'none';

  return {
    destroy: () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      removeGhost();
      activeDrags.delete(el);
      el.style.touchAction = previousTouchAction;
      el.style.userSelect = previousUserSelect;
      el.classList.remove(draggingClass);
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
