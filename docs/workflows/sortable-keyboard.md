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
import { createLiveRegion, prefersReducedMotion } from '@bquery/bquery/a11y';
import { animate } from '@bquery/bquery/motion';

const region = createLiveRegion({ priority: 'polite' });
const reducedMotion = prefersReducedMotion();

export function attachSortable(container: HTMLElement) {
  return useSortable(container, {
    items: 'li',
    handle: '.drag-handle',
    delay: 100,
    touchStartThreshold: 8,
    onSortEnd({ item, oldIndex, newIndex }) {
      if (oldIndex === newIndex) return;

      const next = [...items.value];
      const [moved] = next.splice(oldIndex, 1);
      if (!moved) return;
      next.splice(newIndex, 0, moved);
      items.value = next;

      region.announce(`${moved.label} moved from position ${oldIndex + 1} to ${newIndex + 1}.`);

      if (!reducedMotion.value) {
        animate(item, { transform: ['scale(1.02)', 'scale(1)'] }, { duration: 180 });
      }
    },
  });
}
```

`useSortable()` keeps the DOM order reactive through its `order` signal. In `onSortEnd`, mirror that reorder back into your backing `items` signal so UI, persistence, and analytics stay in sync with the rendered order.

## 3. Declarative markup

```html
<ul id="task-list" role="list" aria-describedby="task-list-help">
  <li
    bq-for="item in items"
    :key="item.id"
    tabindex="0"
    role="listitem"
  >
    <button type="button" class="drag-handle" aria-label="Reorder item">⠿</button>
    <span bq-text="item.label"></span>
  </li>
</ul>

<p id="task-list-help">Press ArrowUp or ArrowDown on a focused item to move it.</p>
```

Important a11y bits:

- `tabindex="0"` makes each row focusable for custom keyboard reorder shortcuts.
- `role="listitem"` keeps semantics intact for assistive tech.
- `aria-describedby` points screen readers at a short interaction hint.
- `handle: '.drag-handle'` keeps pointer drags on the grip while the row itself stays keyboard-focusable.

## 4. Keyboard interaction model

```ts
const sortable = attachSortable(document.querySelector('#task-list')!);

document.querySelector('#task-list')!.addEventListener('keydown', (event) => {
  const row = (event.target as HTMLElement).closest('li');
  if (!row) return;

  const index = sortable.order.value.indexOf(row);
  if (index === -1) return;

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    sortable.handle.move(index, index - 1);
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    sortable.handle.move(index, index + 1);
  }
});
```

| Key               | Action                                                 |
| ----------------- | ------------------------------------------------------ |
| `↑`               | Move the focused item one slot earlier.                |
| `↓`               | Move the focused item one slot later.                  |

Because `handle.move()` also triggers `onSortEnd`, pointer drags and keyboard reorders reuse the same live-region announcement and `items` signal update.

## 5. Visual feedback with reduced-motion respect

```ts
onSortEnd({ item, oldIndex, newIndex }) {
  if (oldIndex === newIndex || reducedMotion.value) return;
  animate(item, { transform: ['scale(1.02)', 'scale(1)'] }, { duration: 180 });
}
```

## What you exercised

- **Keyboard parity** — focused rows move with arrow keys, not only pointers.
- **Live region announcements** — every reorder is spoken without forcing focus.
- **Reactive data sync** — `onSortEnd` mirrors DOM reorders back into `items.value`.
- **Reduced-motion guard** — animations skip when the user prefers reduced motion.

## Next steps

- Persist `items` via [Store](/guide/store) so the order survives reloads.
- Sync the list across tabs with [`useBroadcastChannel`](/guide/media).
- Combine with [Forms](/guide/forms) for sortable form fieldsets.
