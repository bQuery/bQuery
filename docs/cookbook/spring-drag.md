# Spring-based drag

**Problem.** Make a draggable element snap back with elastic physics rather than a stiff transition.

**Solution.** Combine [`draggable`](/guide/dnd) with a [`springVector`](/guide/motion) animation on release.

```ts
import { draggable } from '@bquery/bquery/dnd';
import { springVector } from '@bquery/bquery/motion';

const box = document.querySelector('.draggable') as HTMLElement;
const snap = springVector({ x: 0, y: 0 }, { stiffness: 120, damping: 14 });

snap.onChange(({ x, y }) => {
  box.style.transform = `translate(${x}px, ${y}px)`;
});

draggable(box, {
  bounds: 'viewport',
  onDrag({ position }) {
    snap.set(position);
  },
  onDragEnd() {
    void snap.to({ x: 0, y: 0 });
  },
});
```

**Why it works.** Springs have no fixed duration — they settle naturally; pair them with `bounds: 'viewport'` so the box never escapes the screen.

## Related

- [DnD guide](/guide/dnd)
- [Motion — `spring`](/guide/motion)
- [Workflow — Sortable lists with keyboard a11y](/workflows/sortable-keyboard)
- Longer worked example: [Examples & Recipes — Spring-based drag](/guide/examples#spring-based-drag)
