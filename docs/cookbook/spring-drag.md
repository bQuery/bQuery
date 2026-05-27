# Spring-based drag

**Problem.** Make a draggable element snap back with elastic physics rather than a stiff transition.

**Solution.** Combine [`draggable`](/guide/dnd) with a [`spring`](/guide/motion) animation on release.

```ts
import { draggable } from '@bquery/bquery/dnd';
import { spring } from '@bquery/bquery/motion';

const box = document.querySelector('.draggable') as HTMLElement;

const handle = draggable(box, { bounds: 'viewport' });

const snap = spring({ stiffness: 120, damping: 14 });

handle.on('end', () => {
  snap.set({ x: 0, y: 0 });
  snap.subscribe(({ x, y }) => {
    box.style.transform = `translate(${x}px, ${y}px)`;
  });
});
```

**Why it works.** Springs have no fixed duration — they settle naturally; pair them with `bounds: 'viewport'` so the box never escapes the screen.

## Related

- [DnD guide](/guide/dnd)
- [Motion — `spring`](/guide/motion)
- [Workflow — Sortable lists with keyboard a11y](/workflows/sortable-keyboard)
- Longer worked example: [Examples & Recipes — Spring-based drag](/guide/examples#spring-based-drag)
