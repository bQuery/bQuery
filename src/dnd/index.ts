/**
 * bQuery Drag & Drop module.
 *
 * Provides pointer-event-based drag-and-drop, drop zones, and sortable
 * lists with built-in touch support, axis locking, bounds constraints,
 * keyboard accessibility, and animated reordering.
 *
 * Targeting **Stable** in 1.15.0: the surface is frozen for one minor cycle.
 * The keyboard model (pick up / move / drop / cancel via Space/Enter, arrows,
 * and Escape) and `aria-grabbed` state are a documented contract, and drag
 * announcements route through the shared `a11y` live-region announcer.
 *
 * @module bquery/dnd
 *
 * @example
 * ```ts
 * import { draggable, droppable, sortable } from '@bquery/bquery/dnd';
 *
 * // Make an element draggable
 * const drag = draggable(document.querySelector('#box'), {
 *   axis: 'both',
 *   bounds: 'parent',
 *   ghost: true,
 *   onDragEnd: ({ position }) => console.log(position),
 * });
 *
 * // Define a drop zone
 * const drop = droppable(document.querySelector('#zone'), {
 *   accept: '.draggable',
 *   onDrop: ({ dragged }) => console.log('Dropped!', dragged),
 * });
 *
 * // Make a list sortable
 * const sort = sortable(document.querySelector('#list'), {
 *   items: 'li',
 *   axis: 'y',
 *   onSortEnd: ({ oldIndex, newIndex }) => {
 *     console.log(`Moved from ${oldIndex} to ${newIndex}`);
 *   },
 * });
 *
 * // Cleanup when done
 * drag.destroy();
 * drop.destroy();
 * sort.destroy();
 * ```
 */

export { draggable } from './draggable';
export { droppable } from './droppable';
export { sortable } from './sortable';

export {
  draggablePosition,
  sortableOrder,
  useDraggable,
  useDroppable,
  useSortable,
} from './reactive';

export type {
  BoundsRect,
  DragAxis,
  DragBounds,
  DragEventData,
  DragPosition,
  DraggableHandle,
  DraggableOptions,
  DropEventData,
  DroppableHandle,
  DroppableOptions,
  SortEventData,
  SortableHandle,
  SortableOptions,
  UseDraggableReturn,
  UseDroppableReturn,
  UseSortableReturn,
} from './types';
