/**
 * bQuery Drag & Drop module.
 *
 * Provides pointer-event-based drag-and-drop, drop zones, and sortable
 * lists with built-in touch support, axis locking, bounds constraints,
 * and animated reordering.
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
} from './types';
