# Drag & Drop

The drag-and-drop module adds pointer-based dragging, droppable zones, and sortable lists with touch support and configurable constraints.

```ts
import { draggable, droppable, sortable } from '@bquery/bquery/dnd';
```

---

## `draggable()`

Makes an element draggable using pointer events with optional axis locking, bounds constraints, drag handles, and ghost previews.

### Signature

```ts
function draggable(
  el: HTMLElement,
  options?: DraggableOptions
): DraggableHandle;
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `el` | `HTMLElement` | The element to make draggable |
| `options` | `DraggableOptions` | Optional configuration (see below) |

### `DraggableOptions`

```ts
interface DraggableOptions {
  /** Restrict drag to a single axis. Default: `'both'` */
  axis?: DragAxis;
  /** Restrict drag within bounds. Accepts `'parent'`, a CSS selector, or a `BoundsRect`. */
  bounds?: DragBounds;
  /** CSS selector for a child drag handle. If set, only this child starts a drag. */
  handle?: string;
  /** Display a ghost clone during drag. Default: `false` */
  ghost?: boolean;
  /** CSS class applied to the ghost clone. Default: `'bq-drag-ghost'` */
  ghostClass?: string;
  /** CSS class applied to the element during drag. Default: `'bq-dragging'` */
  draggingClass?: string;
  /** Disable dragging without destroying the handle. Default: `false` */
  disabled?: boolean;
  /** Called when dragging begins. */
  onDragStart?: (data: DragEventData) => void;
  /** Called on every pointer move during drag. */
  onDrag?: (data: DragEventData) => void;
  /** Called when the drag ends (pointer released). */
  onDragEnd?: (data: DragEventData) => void;
}
```

### Return Value: `DraggableHandle`

```ts
interface DraggableHandle {
  /** Remove all listeners and stop all drag behavior. */
  destroy: () => void;
  /** Temporarily disable dragging. */
  disable: () => void;
  /** Re-enable dragging after `disable()`. */
  enable: () => void;
  /** Whether the draggable is currently enabled. */
  readonly enabled: boolean;
}
```

### Examples

**Basic drag:**

```ts
const card = document.querySelector('#card')!;
const drag = draggable(card);

// Later: clean up
drag.destroy();
```

**Constrained to parent with ghost:**

```ts
const drag = draggable(document.querySelector('#card')!, {
  axis: 'both',
  bounds: 'parent',
  ghost: true,
  onDragEnd: ({ position }) => {
    console.log(`Dropped at (${position.x}, ${position.y})`);
  },
});
```

**Horizontal-only with handle:**

```ts
const drag = draggable(document.querySelector('#slider')!, {
  axis: 'x',
  handle: '.drag-thumb',
  draggingClass: 'sliding',
});
```

**Custom bounds rectangle:**

```ts
const drag = draggable(document.querySelector('#box')!, {
  bounds: { left: 0, top: 0, right: 800, bottom: 600 },
});
```

**Toggle dragging on/off:**

```ts
const drag = draggable(document.querySelector('#card')!);

drag.disable();
console.log(drag.enabled); // false

drag.enable();
console.log(drag.enabled); // true
```

---

## `droppable()`

Defines a drop zone that reacts to dragged elements entering, hovering over, leaving, and being dropped onto it.

### Signature

```ts
function droppable(
  el: HTMLElement,
  options?: DroppableOptions
): DroppableHandle;
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `el` | `HTMLElement` | The drop zone element |
| `options` | `DroppableOptions` | Optional configuration (see below) |

### `DroppableOptions`

```ts
interface DroppableOptions {
  /** CSS class applied when a draggable hovers over the zone. Default: `'bq-drop-over'` */
  overClass?: string;
  /** Accept filter — CSS selector or function. Only matching elements trigger drop events. */
  accept?: string | ((el: HTMLElement) => boolean);
  /** Called when a draggable enters the zone. */
  onDragEnter?: (data: DropEventData) => void;
  /** Called repeatedly while a draggable hovers over the zone. */
  onDragOver?: (data: DropEventData) => void;
  /** Called when a draggable leaves the zone. */
  onDragLeave?: (data: DropEventData) => void;
  /** Called when a draggable is dropped in the zone. */
  onDrop?: (data: DropEventData) => void;
}
```

### Return Value: `DroppableHandle`

```ts
interface DroppableHandle {
  /** Remove all listeners and clean up. */
  destroy: () => void;
}
```

### Examples

**Basic drop zone:**

```ts
const drop = droppable(document.querySelector('#drop-zone')!, {
  onDrop: ({ dragged, zone }) => {
    console.log('Dropped', dragged, 'into', zone);
  },
});

drop.destroy();
```

**Filtered by CSS selector:**

```ts
const drop = droppable(document.querySelector('#trash')!, {
  accept: '.deletable',
  overClass: 'trash-hover',
  onDrop: ({ dragged }) => {
    dragged.remove();
  },
});
```

**Filtered by function:**

```ts
const drop = droppable(document.querySelector('#drop-zone')!, {
  accept: (el) => el.dataset.type === 'image',
  onDragEnter: ({ zone }) => zone.classList.add('highlight'),
  onDragLeave: ({ zone }) => zone.classList.remove('highlight'),
  onDrop: ({ dragged, zone }) => {
    zone.appendChild(dragged);
  },
});
```

---

## `sortable()`

Makes the children of a container sortable by dragging, with animated reordering.

### Signature

```ts
function sortable(
  container: HTMLElement,
  options?: SortableOptions
): SortableHandle;
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `container` | `HTMLElement` | The container whose children become sortable |
| `options` | `SortableOptions` | Optional configuration (see below) |

### `SortableOptions`

```ts
interface SortableOptions {
  /** CSS selector for sortable items. Default: `'> *'` (direct children) */
  items?: string;
  /** Sort axis — `'x'` for horizontal, `'y'` for vertical. Default: `'y'` */
  axis?: 'x' | 'y';
  /** CSS selector for a drag handle within each item. */
  handle?: string;
  /** CSS class applied to the placeholder element. Default: `'bq-sort-placeholder'` */
  placeholderClass?: string;
  /** CSS class applied to the item being sorted. Default: `'bq-sorting'` */
  sortingClass?: string;
  /** Animation duration in milliseconds. Default: `200` */
  animationDuration?: number;
  /** Disable sorting without destroying. Default: `false` */
  disabled?: boolean;
  /** Called when sorting begins. */
  onSortStart?: (data: SortEventData) => void;
  /** Called on each move during sorting. */
  onSortMove?: (data: SortEventData) => void;
  /** Called when sorting ends. */
  onSortEnd?: (data: SortEventData) => void;
}
```

### Return Value: `SortableHandle`

```ts
interface SortableHandle {
  /** Remove all listeners and clean up. */
  destroy: () => void;
  /** Temporarily disable sorting. */
  disable: () => void;
  /** Re-enable sorting after `disable()`. */
  enable: () => void;
  /** Whether sorting is currently enabled. */
  readonly enabled: boolean;
}
```

### Examples

**Vertical list sorting:**

```ts
const sort = sortable(document.querySelector('#todo-list')!, {
  items: 'li',
  axis: 'y',
  onSortEnd: ({ oldIndex, newIndex }) => {
    console.log(`Moved from ${oldIndex} to ${newIndex}`);
  },
});

sort.destroy();
```

**Horizontal sortable with handle:**

```ts
const sort = sortable(document.querySelector('#tabs')!, {
  items: '.tab',
  axis: 'x',
  handle: '.tab-drag-handle',
  animationDuration: 300,
  onSortEnd: ({ oldIndex, newIndex, container }) => {
    console.log('Tab reordered in', container);
  },
});
```

**Toggle sorting on/off:**

```ts
const sort = sortable(document.querySelector('#list')!, { items: 'li' });

sort.disable();
console.log(sort.enabled); // false

sort.enable();
console.log(sort.enabled); // true
```

---

## Supporting Types

### `DragAxis`

```ts
type DragAxis = 'x' | 'y' | 'both';
```

### `DragPosition`

```ts
interface DragPosition {
  x: number;
  y: number;
}
```

### `BoundsRect`

```ts
interface BoundsRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
```

### `DragBounds`

```ts
type DragBounds = 'parent' | string | BoundsRect;
```

- `'parent'` — constrain to the element's offset parent
- A CSS selector string — constrain to the first matching element's bounding rect
- A `BoundsRect` object — constrain to explicit pixel boundaries

### `DragEventData`

```ts
interface DragEventData {
  /** The element being dragged. */
  element: HTMLElement;
  /** Current position (accumulated translation). */
  position: DragPosition;
  /** Movement delta since the last pointer event. */
  delta: DragPosition;
  /** The raw pointer event. */
  event: PointerEvent;
}
```

### `DropEventData`

```ts
interface DropEventData {
  /** The drop zone element. */
  zone: HTMLElement;
  /** The dragged element. */
  dragged: HTMLElement;
  /** The raw pointer event. */
  event: PointerEvent;
}
```

### `SortEventData`

```ts
interface SortEventData {
  /** The sortable container. */
  container: HTMLElement;
  /** The item being sorted. */
  item: HTMLElement;
  /** The item's original index before sorting. */
  oldIndex: number;
  /** The item's new index after sorting. */
  newIndex: number;
}
```

---

## Notes

- Built on pointer events with graceful DOM/environment guards.
- Supports touch devices without requiring external dependencies.
- Ghost offsets and placeholder behavior are covered by the test suite for common edge cases.
- All handles return `destroy()` for lifecycle cleanup — call it when the component unmounts.
- CSS classes (e.g., `bq-dragging`, `bq-drop-over`, `bq-sort-placeholder`) can be customized per instance.
