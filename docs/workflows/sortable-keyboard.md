# Drag-and-drop sortable lists with keyboard a11y

A reorderable list that works equally well with a mouse, a finger, and a keyboard. Powered by [DnD](/guide/dnd) and [A11y](/guide/a11y).

## 1. Reactive list state

```ts
// src/sortable.ts
import { signal } from '@bquery/bquery/reactive';

export const items = signal([
  { id: 'a', label: 'Read PRs' },
  { id: 'b', label: 'Reply to comments' },
  { id: 'c', label: 'Write release notes' },
  { id: 'd', label: 'Ship 1.14.0' },
]);
```

## 2. Wire the sortable container

```ts
import { useSortable } from '@bquery/bquery/dnd';
import { createLiveRegion } from '@bquery/bquery/a11y';

const region = createLiveRegion({ politeness: 'polite' });

export function attachSortable(container: HTMLElement) {
  return useSortable(container, {
    items, // signal — reordered in place
    keyboard: true,
    keyboardStep: 1,
    delay: 100,
    touchStartThreshold: 8,
    bounds: 'viewport',
    onMove({ from, to, item }) {
      region.announce(`${item.label} moved from position ${from + 1} to ${to + 1}.`);
    },
  });
}
```

`useSortable` mutates the `items` signal in place when a reorder happens, so every subscriber (UI, persistence, analytics) sees the change.

## 3. Declarative markup

```html
<ul id="task-list" role="list">
  <li
    bq-for="item in items"
    :key="item.id"
    tabindex="0"
    role="listitem"
    bq-aria="{ grabbed: item.id === sortable.activeId.value }"
  >
    <span aria-hidden="true">⠿</span>
    <span bq-text="item.label"></span>
  </li>
</ul>
```

Important a11y bits:

- `tabindex="0"` makes each row focusable so keyboard sortable mode can take over.
- `role="listitem"` keeps semantics intact for assistive tech.
- `aria-grabbed` toggles via [`bq-aria`](/guide/view#directive-reference-1-14-0) as the user activates an item.

## 4. Keyboard interaction model

| Key               | Action                                                 |
| ----------------- | ------------------------------------------------------ |
| `Space` / `Enter` | Pick up / drop the focused item.                       |
| `↑` / `↓`         | Move the picked-up item one position (`keyboardStep`). |
| `Home` / `End`    | Move to first / last position.                         |
| `Escape`          | Cancel the in-progress drag.                           |

`useSortable({ keyboard: true })` wires all of this automatically and emits the same `onMove` payload as pointer drags, so the live region speaks the same announcement regardless of input device.

## 5. Visual feedback with reduced-motion respect

```ts
import { animate } from '@bquery/bquery/motion';
import { prefersReducedMotion } from '@bquery/bquery/a11y';

sortable.on('drop', ({ element }) => {
  if (prefersReducedMotion.value) return;
  animate(element, { transform: ['scale(1.02)', 'scale(1)'] }, { duration: 180 });
});
```

## What you exercised

- **Keyboard parity** — sortable lists move with arrow keys, not only pointers.
- **Live region announcements** — every reorder is spoken without forcing focus.
- **Reactive list mutation** — `items.value` updates in place; UI, persistence, and undo stacks see the same diff.
- **Reduced-motion guard** — animations skip when the user prefers reduced motion.

## Next steps

- Persist `items` via [Store](/guide/store) so the order survives reloads.
- Sync the list across tabs with [`useBroadcastChannel`](/guide/media).
- Combine with [Forms](/guide/forms) for sortable form fieldsets.
