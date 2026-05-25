/**
 * Make an element draggable using pointer events.
 *
 * Uses Pointer Events (not HTML5 Drag & Drop) for reliable
 * cross-platform behavior including touch support.
 *
 * @module bquery/dnd
 */

import { announceToScreenReader } from '../a11y/announce';
import type {
  BoundsRect,
  DragAxis,
  DragBounds,
  DragEventData,
  DragPosition,
  DraggableHandle,
  DraggableOptions,
} from './types';

/** Global registry of active draggable elements for drop zone detection. */
const activeDrags = new Map<HTMLElement, { element: HTMLElement; position: DragPosition }>();

/**
 * Returns the currently active drag state, if any.
 * Used internally by `droppable()` to detect drag interactions.
 * @internal
 */
export const getActiveDrag = (): { element: HTMLElement; position: DragPosition } | undefined => {
  const entries = Array.from(activeDrags.values());
  return entries[entries.length - 1];
};

/**
 * Resolves a `DragBounds` value to an absolute `BoundsRect`.
 * @internal
 */
const resolveBounds = (el: HTMLElement, bounds: DragBounds): BoundsRect | null => {
  if (typeof bounds === 'object' && bounds !== null && 'left' in bounds && 'top' in bounds) {
    return bounds as BoundsRect;
  }

  let target: HTMLElement | null = null;

  if (bounds === 'parent') {
    target = el.parentElement;
  } else if (bounds === 'viewport') {
    const elRect = el.getBoundingClientRect();
    const rawLeft = parseFloat(el.style.left || '0');
    const rawTop = parseFloat(el.style.top || '0');
    const leftOffset = Number.isNaN(rawLeft) ? 0 : rawLeft;
    const topOffset = Number.isNaN(rawTop) ? 0 : rawTop;
    const viewportWidth =
      typeof window !== 'undefined' && typeof window.innerWidth === 'number'
        ? window.innerWidth
        : 0;
    const viewportHeight =
      typeof window !== 'undefined' && typeof window.innerHeight === 'number'
        ? window.innerHeight
        : 0;
    return {
      left: -elRect.left + leftOffset,
      top: -elRect.top + topOffset,
      right: viewportWidth - elRect.right + leftOffset,
      bottom: viewportHeight - elRect.bottom + topOffset,
    };
  } else if (typeof bounds === 'string') {
    if (typeof document === 'undefined' || typeof document.querySelector !== 'function') {
      return null;
    }
    target = document.querySelector(bounds) as HTMLElement | null;
  } else if (typeof HTMLElement !== 'undefined' && bounds instanceof HTMLElement) {
    target = bounds;
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
    right: rect.right - elRect.right + leftOffset + (rect.width - elRect.width),
    bottom: rect.bottom - elRect.bottom + topOffset + (rect.height - elRect.height),
  };
};

/**
 * Clamp a position within bounds.
 * @internal
 */
const clampPosition = (pos: DragPosition, bounds: BoundsRect | null): DragPosition => {
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
export const draggable = (el: HTMLElement, options: DraggableOptions = {}): DraggableHandle => {
  const {
    handle,
    ghost = false,
    ghostClass = 'bq-drag-ghost',
    draggingClass = 'bq-dragging',
    onDragStart,
    onDrag,
    onDragEnd,
    grid,
    delay = 0,
    touchStartThreshold = 0,
    keyboard = false,
    keyboardStep = 10,
  } = options;

  let currentAxis: DragAxis = options.axis ?? 'both';
  let currentBounds: DragBounds | undefined = options.bounds;

  let enabled = !options.disabled;
  let isDragging = false;
  let startPointer: DragPosition = { x: 0, y: 0 };
  let currentPosition: DragPosition = { x: 0, y: 0 };
  let previousPosition: DragPosition = { x: 0, y: 0 };
  let ghostEl: HTMLElement | null = null;
  let ghostStartPosition: DragPosition | null = null;
  const previousTouchAction = el.style.touchAction;
  const previousUserSelect = el.style.userSelect;
  const previousTabIndex = el.getAttribute('tabindex');
  const previousAriaGrabbed = el.getAttribute('aria-grabbed');

  // Pending pointer state — used to honor `delay` and `touchStartThreshold`
  // before promoting a pointerdown to an active drag.
  let pendingPointer:
    | {
        pointerId: number;
        startX: number;
        startY: number;
        deadline: number;
        timer: ReturnType<typeof setTimeout> | null;
        originalEvent: PointerEvent;
      }
    | null = null;

  // Keyboard pickup state
  let keyboardActive = false;
  let keyboardPickupPosition: DragPosition = { x: 0, y: 0 };

  const snapToGrid = (pos: DragPosition): DragPosition => {
    if (grid === undefined) return pos;
    const [stepX, stepY] = Array.isArray(grid) ? grid : [grid, grid];
    return {
      x: stepX > 0 ? Math.round(pos.x / stepX) * stepX : pos.x,
      y: stepY > 0 ? Math.round(pos.y / stepY) * stepY : pos.y,
    };
  };

  const applyConstraints = (rawPos: DragPosition): DragPosition => {
    let next = { ...rawPos };
    if (currentAxis === 'x') next.y = currentPosition.y;
    if (currentAxis === 'y') next.x = currentPosition.x;
    next = snapToGrid(next);
    if (currentBounds) {
      const resolved = resolveBounds(el, currentBounds);
      next = clampPosition(next, resolved);
    }
    return next;
  };

  const applyPositionToElement = (): void => {
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
  };

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

  const cancelPendingPointer = (): void => {
    if (pendingPointer?.timer) clearTimeout(pendingPointer.timer);
    pendingPointer = null;
  };

  const beginDrag = (e: PointerEvent): void => {
    isDragging = true;
    startPointer = { x: e.clientX, y: e.clientY };
    previousPosition = { ...currentPosition };

    el.classList.add(draggingClass);
    if (keyboard) el.setAttribute('aria-grabbed', 'true');
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // setPointerCapture may not be available in all test environments.
    }

    if (ghost) {
      const rect = el.getBoundingClientRect();
      ghostStartPosition = { x: rect.left, y: rect.top };
      ghostEl = createGhost();
    }

    activeDrags.set(el, { element: el, position: currentPosition });

    onDragStart?.(createEventData(e));
  };

  const onPointerDown = (e: PointerEvent): void => {
    if (!enabled) return;
    if (keyboardActive) return; // ignore while keyboard drag is in progress

    if (handle) {
      const target = e.target as Element;
      if (!target.closest(handle)) return;
    }

    // Only honor primary pointer (mouse left, primary touch, etc.).
    if (e.isPrimary === false) return;

    e.preventDefault();

    // If no delay/threshold, start immediately.
    if (delay <= 0 && touchStartThreshold <= 0) {
      beginDrag(e);
      return;
    }

    // Otherwise defer until the deadline passes or the threshold is met.
    pendingPointer = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      deadline: Date.now() + delay,
      timer: null,
      originalEvent: e,
    };

    if (delay > 0) {
      pendingPointer.timer = setTimeout(() => {
        if (!pendingPointer) return;
        const original = pendingPointer.originalEvent;
        pendingPointer.timer = null;
        // Only promote if threshold is also satisfied (or none was set).
        if (touchStartThreshold <= 0) {
          pendingPointer = null;
          beginDrag(original);
        }
      }, delay);
    }
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (pendingPointer && pendingPointer.pointerId === e.pointerId) {
      const dx = e.clientX - pendingPointer.startX;
      const dy = e.clientY - pendingPointer.startY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const deadlinePassed = Date.now() >= pendingPointer.deadline;
      const thresholdMet = touchStartThreshold <= 0 || distance >= touchStartThreshold;
      if (deadlinePassed && thresholdMet) {
        const original = pendingPointer.originalEvent;
        cancelPendingPointer();
        beginDrag(original);
        // Re-process this move under the active drag.
      } else {
        return;
      }
    }

    if (!isDragging) return;

    e.preventDefault();
    previousPosition = { ...currentPosition };

    const rawX = currentPosition.x + (e.clientX - startPointer.x);
    const rawY = currentPosition.y + (e.clientY - startPointer.y);

    // Advance the start pointer for the next delta tick.
    startPointer = { x: e.clientX, y: e.clientY };

    currentPosition = applyConstraints({ x: rawX, y: rawY });

    activeDrags.set(el, { element: el, position: currentPosition });
    applyPositionToElement();

    onDrag?.(createEventData(e));
  };

  const onPointerUp = (e: PointerEvent): void => {
    if (pendingPointer && pendingPointer.pointerId === e.pointerId) {
      cancelPendingPointer();
      return;
    }

    if (!isDragging) return;

    isDragging = false;
    el.classList.remove(draggingClass);
    if (keyboard) el.setAttribute('aria-grabbed', 'false');
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
      activeDrags.delete(el);
      onDragEnd?.(createEventData(e));
    }
  };

  // ─── Keyboard support ────────────────────────────────────────────────────
  const synthesizeKeyboardEventData = (key: KeyboardEvent): DragEventData => ({
    element: el,
    position: { ...currentPosition },
    delta: {
      x: currentPosition.x - previousPosition.x,
      y: currentPosition.y - previousPosition.y,
    },
    // Cast: pointer-shaped callbacks accept the keyboard event as the
    // underlying input device for keyboard-driven drags. Authors that care
    // about the device should branch on `event.type`.
    event: key as unknown as PointerEvent,
  });

  const onKeyDown = (e: KeyboardEvent): void => {
    if (!enabled || !keyboard) return;
    if (isDragging || pendingPointer) return;

    const isPickupKey = e.key === ' ' || e.key === 'Enter';
    const isCancelKey = e.key === 'Escape';
    const isArrowKey =
      e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight';

    if (!keyboardActive) {
      if (isPickupKey) {
        e.preventDefault();
        keyboardActive = true;
        keyboardPickupPosition = { ...currentPosition };
        previousPosition = { ...currentPosition };
        activeDrags.set(el, { element: el, position: currentPosition });
        el.classList.add(draggingClass);
        el.setAttribute('aria-grabbed', 'true');
        announceToScreenReader(
          'Picked up draggable item. Use arrow keys to move. Press space or enter to drop, escape to cancel.'
        );
        onDragStart?.(synthesizeKeyboardEventData(e));
      }
      return;
    }

    // keyboardActive
    if (isPickupKey) {
      e.preventDefault();
      keyboardActive = false;
      el.classList.remove(draggingClass);
      el.setAttribute('aria-grabbed', 'false');
      activeDrags.delete(el);
      announceToScreenReader('Dropped at new position.');
      onDragEnd?.(synthesizeKeyboardEventData(e));
      return;
    }
    if (isCancelKey) {
      e.preventDefault();
      keyboardActive = false;
      previousPosition = { ...currentPosition };
      currentPosition = { ...keyboardPickupPosition };
      applyPositionToElement();
      el.classList.remove(draggingClass);
      el.setAttribute('aria-grabbed', 'false');
      activeDrags.delete(el);
      announceToScreenReader('Drag cancelled, returned to original position.');
      onDragEnd?.(synthesizeKeyboardEventData(e));
      return;
    }
    if (isArrowKey) {
      e.preventDefault();
      previousPosition = { ...currentPosition };
      const next = { ...currentPosition };
      if (e.key === 'ArrowUp') next.y -= keyboardStep;
      if (e.key === 'ArrowDown') next.y += keyboardStep;
      if (e.key === 'ArrowLeft') next.x -= keyboardStep;
      if (e.key === 'ArrowRight') next.x += keyboardStep;
      currentPosition = applyConstraints(next);
      activeDrags.set(el, { element: el, position: currentPosition });
      applyPositionToElement();
      onDrag?.(synthesizeKeyboardEventData(e));
    }
  };

  // Attach listeners
  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onPointerUp);

  if (keyboard) {
    el.addEventListener('keydown', onKeyDown);
    if (previousTabIndex === null) el.setAttribute('tabindex', '0');
    el.setAttribute('aria-grabbed', 'false');
  }

  // Prevent default drag behavior
  el.style.touchAction = 'none';
  el.style.userSelect = 'none';

  const dHandle: DraggableHandle = {
    destroy: () => {
      cancelPendingPointer();
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      if (keyboard) {
        el.removeEventListener('keydown', onKeyDown);
        if (previousTabIndex === null) el.removeAttribute('tabindex');
        else el.setAttribute('tabindex', previousTabIndex);
        if (previousAriaGrabbed === null) el.removeAttribute('aria-grabbed');
        else el.setAttribute('aria-grabbed', previousAriaGrabbed);
      }
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
    moveTo: (position: DragPosition) => {
      previousPosition = { ...currentPosition };
      currentPosition = applyConstraints(position);
      if (isDragging || keyboardActive) {
        activeDrags.set(el, { element: el, position: currentPosition });
      } else {
        activeDrags.delete(el);
      }
      applyPositionToElement();
    },
    reset: () => {
      previousPosition = { ...currentPosition };
      currentPosition = { x: 0, y: 0 };
      if (isDragging || keyboardActive) {
        activeDrags.set(el, { element: el, position: currentPosition });
      } else {
        activeDrags.delete(el);
      }
      el.style.transform = '';
      if (ghost && ghostEl) {
        applyPositionToElement();
      }
    },
    getPosition: () => ({ ...currentPosition }),
    setBounds: (bounds: DragBounds | undefined) => {
      currentBounds = bounds;
    },
    setAxis: (axisValue: DragAxis) => {
      currentAxis = axisValue;
    },
  };

  return dHandle;
};
