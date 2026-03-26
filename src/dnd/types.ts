/**
 * Type definitions for the bQuery Drag & Drop module.
 *
 * @module bquery/dnd
 */

// ─── Shared Types ────────────────────────────────────────────────────────────

/**
 * Axis constraint for draggable elements.
 * - `'x'` — horizontal only
 * - `'y'` — vertical only
 * - `'both'` — free movement (default)
 */
export type DragAxis = 'x' | 'y' | 'both';

/**
 * Position coordinates in pixels.
 */
export interface DragPosition {
  /** Horizontal position in pixels. */
  x: number;
  /** Vertical position in pixels. */
  y: number;
}

/**
 * A bounding rectangle used to constrain drag movement.
 */
export interface BoundsRect {
  /** Minimum X coordinate (left edge). */
  left: number;
  /** Minimum Y coordinate (top edge). */
  top: number;
  /** Maximum X coordinate (right edge). */
  right: number;
  /** Maximum Y coordinate (bottom edge). */
  bottom: number;
}

/**
 * Bounds constraint for draggable elements.
 * - `'parent'` — constrain to parent element's bounds
 * - A CSS selector string — constrain to the matched element's bounds
 * - A `BoundsRect` — constrain to explicit coordinates
 */
export type DragBounds = 'parent' | string | BoundsRect;

/**
 * Data passed to all drag event callbacks.
 */
export interface DragEventData {
  /** The dragged element. */
  element: HTMLElement;
  /** Current position relative to the initial position (0,0 at start). */
  position: DragPosition;
  /** Movement delta since the last event. */
  delta: DragPosition;
  /** The original pointer event. */
  event: PointerEvent;
}

// ─── Draggable ───────────────────────────────────────────────────────────────

/**
 * Configuration options for `draggable()`.
 */
export interface DraggableOptions {
  /**
   * Axis constraint for movement.
   * @default 'both'
   */
  axis?: DragAxis;

  /**
   * Bounds constraint. Restricts the element's movement to within the
   * specified area.
   */
  bounds?: DragBounds;

  /**
   * CSS selector for a drag handle. If provided, only pointer events
   * on matching child elements will initiate a drag.
   */
  handle?: string;

  /**
   * Whether to show a ghost/clone preview during drag instead of
   * moving the original element. The ghost follows the pointer while
   * the original stays in place.
   * @default false
   */
  ghost?: boolean;

  /**
   * CSS class applied to the ghost element.
   * @default 'bq-drag-ghost'
   */
  ghostClass?: string;

  /**
   * CSS class applied to the element while it is being dragged.
   * @default 'bq-dragging'
   */
  draggingClass?: string;

  /**
   * Whether the element is initially disabled for dragging.
   * @default false
   */
  disabled?: boolean;

  /**
   * Called when a drag operation starts.
   */
  onDragStart?: (data: DragEventData) => void;

  /**
   * Called continuously during drag movement.
   */
  onDrag?: (data: DragEventData) => void;

  /**
   * Called when a drag operation ends.
   */
  onDragEnd?: (data: DragEventData) => void;
}

/**
 * Handle returned by `draggable()` for controlling the drag behavior.
 */
export interface DraggableHandle {
  /** Remove all event listeners and clean up. */
  destroy: () => void;
  /** Disable dragging. */
  disable: () => void;
  /** Re-enable dragging. */
  enable: () => void;
  /** Whether dragging is currently enabled. */
  readonly enabled: boolean;
}

// ─── Droppable ───────────────────────────────────────────────────────────────

/**
 * Data passed to droppable event callbacks.
 */
export interface DropEventData {
  /** The drop zone element. */
  zone: HTMLElement;
  /** The dragged element entering/leaving/dropping onto the zone. */
  dragged: HTMLElement;
  /** The original pointer event. */
  event: PointerEvent;
}

/**
 * Configuration options for `droppable()`.
 */
export interface DroppableOptions {
  /**
   * CSS class applied to the zone while a draggable element is over it.
   * @default 'bq-drop-over'
   */
  overClass?: string;

  /**
   * CSS selector or predicate to filter which dragged elements are
   * accepted. If a string, only elements matching the selector can
   * be dropped. If a function, return `true` to accept.
   */
  accept?: string | ((el: HTMLElement) => boolean);

  /**
   * Called when a dragged element enters the drop zone.
   */
  onDragEnter?: (data: DropEventData) => void;

  /**
   * Called while a dragged element is over the drop zone.
   */
  onDragOver?: (data: DropEventData) => void;

  /**
   * Called when a dragged element leaves the drop zone.
   */
  onDragLeave?: (data: DropEventData) => void;

  /**
   * Called when a dragged element is dropped onto the zone.
   */
  onDrop?: (data: DropEventData) => void;
}

/**
 * Handle returned by `droppable()` for controlling the drop zone.
 */
export interface DroppableHandle {
  /** Remove all event listeners and clean up. */
  destroy: () => void;
}

// ─── Sortable ────────────────────────────────────────────────────────────────

/**
 * Data passed to sortable event callbacks.
 */
export interface SortEventData {
  /** The container element. */
  container: HTMLElement;
  /** The item being moved. */
  item: HTMLElement;
  /** The old index before the move. */
  oldIndex: number;
  /** The new index after the move. */
  newIndex: number;
}

/**
 * Configuration options for `sortable()`.
 */
export interface SortableOptions {
  /**
   * CSS selector for the sortable items within the container.
   * @default '> *'
   */
  items?: string;

  /**
   * Axis constraint for sorting.
   * @default 'y'
   */
  axis?: 'x' | 'y';

  /**
   * CSS selector for a drag handle within each item. If provided,
   * only pointer events on handle elements initiate sorting.
   */
  handle?: string;

  /**
   * CSS class applied to the placeholder element during sorting.
   * @default 'bq-sort-placeholder'
   */
  placeholderClass?: string;

  /**
   * CSS class applied to the item being sorted.
   * @default 'bq-sorting'
   */
  sortingClass?: string;

  /**
   * Duration of the reorder animation in milliseconds.
   * @default 200
   */
  animationDuration?: number;

  /**
   * Whether sorting is initially disabled.
   * @default false
   */
  disabled?: boolean;

  /**
   * Called when sorting starts.
   */
  onSortStart?: (data: SortEventData) => void;

  /**
   * Called when an item is moved to a new position.
   */
  onSortMove?: (data: SortEventData) => void;

  /**
   * Called when sorting ends and the item is placed.
   */
  onSortEnd?: (data: SortEventData) => void;
}

/**
 * Handle returned by `sortable()` for controlling the sortable list.
 */
export interface SortableHandle {
  /** Remove all event listeners and clean up. */
  destroy: () => void;
  /** Disable sorting. */
  disable: () => void;
  /** Re-enable sorting. */
  enable: () => void;
  /** Whether sorting is currently enabled. */
  readonly enabled: boolean;
}
