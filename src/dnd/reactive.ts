/**
 * Reactive composables for the bQuery Drag & Drop module.
 *
 * `useDraggable`, `useDroppable`, and `useSortable` wrap their imperative
 * counterparts and expose signals for the values most often consumed
 * reactively (position, isDragging, isOver, active dragged element, ordered
 * items). When called inside an active reactive scope, the composables
 * register a cleanup callback so the underlying handle is destroyed
 * automatically when the scope is disposed.
 *
 * `draggablePosition` and `sortableOrder` adapt raw imperative handles into
 * signals for cases where the composables cannot be used (e.g. when the
 * handle's lifetime is managed externally).
 *
 * @module bquery/dnd
 */

import { getCurrentScope, onScopeDispose, readonly, signal } from '../reactive/index';
import type { ReadonlySignal } from '../reactive/index';
import { draggable } from './draggable';
import { droppable } from './droppable';
import { sortable } from './sortable';
import type {
  DragPosition,
  DraggableHandle,
  DraggableOptions,
  DroppableOptions,
  SortableHandle,
  SortableOptions,
  UseDraggableReturn,
  UseDroppableReturn,
  UseSortableReturn,
} from './types';

/**
 * Reactive composable returning signals for the position and drag-active
 * state of a {@link draggable} target.
 *
 * The underlying handle is destroyed automatically when the surrounding
 * reactive scope is disposed (via `onScopeDispose`). Outside a scope, call
 * `handle.destroy()` manually.
 *
 * @example
 * ```ts
 * import { effectScope } from '@bquery/bquery/reactive';
 * import { useDraggable } from '@bquery/bquery/dnd';
 *
 * const scope = effectScope();
 * scope.run(() => {
 *   const { position, isDragging } = useDraggable(boxEl, { bounds: 'parent' });
 *   // position.value, isDragging.value
 * });
 * scope.stop(); // releases the draggable
 * ```
 */
export const useDraggable = (el: HTMLElement, options: DraggableOptions = {}): UseDraggableReturn => {
  const position = signal<DragPosition>({ x: 0, y: 0 });
  const isDragging = signal(false);

  const userOnDragStart = options.onDragStart;
  const userOnDrag = options.onDrag;
  const userOnDragEnd = options.onDragEnd;

  const handle = draggable(el, {
    ...options,
    onDragStart: (data) => {
      isDragging.value = true;
      position.value = { ...data.position };
      userOnDragStart?.(data);
    },
    onDrag: (data) => {
      position.value = { ...data.position };
      userOnDrag?.(data);
    },
    onDragEnd: (data) => {
      isDragging.value = false;
      position.value = { ...data.position };
      userOnDragEnd?.(data);
    },
  });

  const syncPosition = (): void => {
    position.value = handle.getPosition();
  };

  const originalMoveTo = handle.moveTo;
  handle.moveTo = (nextPosition) => {
    originalMoveTo(nextPosition);
    syncPosition();
  };

  const originalReset = handle.reset;
  handle.reset = () => {
    originalReset();
    syncPosition();
  };

  registerScopeCleanup(() => handle.destroy());

  return {
    position: readonly(position),
    isDragging: readonly(isDragging),
    handle,
  };
};

/**
 * Reactive composable returning signals for the hover state of a
 * {@link droppable} zone.
 *
 * @example
 * ```ts
 * const { isOver, activeDragged } = useDroppable(zoneEl, { accept: '.task' });
 * effect(() => {
 *   if (isOver.value) console.log('hovering with', activeDragged.value);
 * });
 * ```
 */
export const useDroppable = (el: HTMLElement, options: DroppableOptions = {}): UseDroppableReturn => {
  const isOver = signal(false);
  const activeDragged = signal<HTMLElement | null>(null);

  const userOnDragEnter = options.onDragEnter;
  const userOnDragLeave = options.onDragLeave;
  const userOnDrop = options.onDrop;

  const handle = droppable(el, {
    ...options,
    onDragEnter: (data) => {
      isOver.value = true;
      activeDragged.value = data.dragged;
      userOnDragEnter?.(data);
    },
    onDragLeave: (data) => {
      isOver.value = false;
      activeDragged.value = null;
      userOnDragLeave?.(data);
    },
    onDrop: (data) => {
      isOver.value = false;
      activeDragged.value = null;
      userOnDrop?.(data);
    },
  });

  registerScopeCleanup(() => handle.destroy());

  return {
    isOver: readonly(isOver),
    activeDragged: readonly(activeDragged),
    handle,
  };
};

/**
 * Reactive composable returning signals for the current item order and
 * drag-active state of a {@link sortable} container.
 *
 * The order signal updates whenever a sort completes (`onSortEnd`) and on
 * initial setup. It reflects the DOM order returned by
 * `handle.getItems()` at the time of each event.
 *
 * @example
 * ```ts
 * const { order, isDragging } = useSortable(listEl, { items: 'li' });
 * effect(() => console.log(order.value.map((el) => el.textContent)));
 * ```
 */
export const useSortable = (
  container: HTMLElement,
  options: SortableOptions = {}
): UseSortableReturn => {
  const order = signal<HTMLElement[]>([]);
  const isDragging = signal(false);

  const userOnSortStart = options.onSortStart;
  const userOnSortEnd = options.onSortEnd;

  let handle: SortableHandle;
  handle = sortable(container, {
    ...options,
    onSortStart: (data) => {
      isDragging.value = true;
      userOnSortStart?.(data);
    },
    onSortEnd: (data) => {
      isDragging.value = false;
      order.value = handle.getItems();
      userOnSortEnd?.(data);
    },
  });

  order.value = handle.getItems();

  registerScopeCleanup(() => handle.destroy());

  return {
    order: readonly(order),
    isDragging: readonly(isDragging),
    handle,
  };
};

/**
 * Wraps an existing {@link DraggableHandle} so its current position is
 * observable as a signal. Polls `handle.getPosition()` at the cadence of
 * native pointer events on the captured element by reading it once per
 * tick of a passive `pointermove` listener.
 *
 * @remarks
 * Prefer {@link useDraggable} for new code — this adapter exists for cases
 * where the draggable handle is created externally and you only need a
 * reactive position view. When called outside a reactive scope, the adapter's
 * listeners are still removed when `handle.destroy()` is called.
 */
export const draggablePosition = (
  el: HTMLElement,
  handle: DraggableHandle
): ReadonlySignal<DragPosition> => {
  const position = signal<DragPosition>(handle.getPosition());

  const sync = (): void => {
    const next = handle.getPosition();
    const current = position.peek();
    if (current.x !== next.x || current.y !== next.y) {
      position.value = next;
    }
  };

  // Mirror native pointer activity so reactive consumers stay in sync.
  el.addEventListener('pointermove', sync, { passive: true });
  el.addEventListener('pointerup', sync, { passive: true });

  const cleanup = (): void => {
    el.removeEventListener('pointermove', sync);
    el.removeEventListener('pointerup', sync);
  };

  wrapHandleDestroy(handle, cleanup);
  registerScopeCleanup(cleanup);

  return readonly(position);
};

/**
 * Wraps an existing {@link SortableHandle} so its current item order is
 * observable as a signal. The signal value is refreshed by listening for
 * `pointerup` events on the container, which is when sorts conclude.
 *
 * @remarks
 * Prefer {@link useSortable} for new code — this adapter exists for cases
 * where the sortable handle is created externally and you only need a
 * reactive order view. When called outside a reactive scope, the adapter's
 * listener is still removed when `handle.destroy()` is called.
 */
export const sortableOrder = (
  container: HTMLElement,
  handle: SortableHandle
): ReadonlySignal<HTMLElement[]> => {
  const order = signal<HTMLElement[]>(handle.getItems());

  const sync = (): void => {
    order.value = handle.getItems();
  };

  container.addEventListener('pointerup', sync, { passive: true });

  const cleanup = (): void => {
    container.removeEventListener('pointerup', sync);
  };

  wrapHandleDestroy(handle, cleanup);
  registerScopeCleanup(cleanup);

  return readonly(order);
};

/**
 * Registers `fn` as a scope-disposal cleanup when called inside an active
 * reactive scope. When called outside a scope, this is a no-op — callers are
 * expected to invoke `handle.destroy()` themselves.
 *
 * @internal
 */
const registerScopeCleanup = (fn: () => void): void => {
  if (getCurrentScope() === undefined) return;
  onScopeDispose(fn);
};

/**
 * Chains adapter-specific cleanup into an imperative handle's `destroy()`
 * lifecycle so listener removal still happens outside reactive scopes.
 *
 * @internal
 */
const wrapHandleDestroy = <T extends { destroy: () => void }>(handle: T, cleanup: () => void): void => {
  let cleaned = false;
  const runCleanup = (): void => {
    if (cleaned) return;
    cleaned = true;
    cleanup();
  };
  const originalDestroy = handle.destroy.bind(handle);
  handle.destroy = () => {
    runCleanup();
    originalDestroy();
  };
};
