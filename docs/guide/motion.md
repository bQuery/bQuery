# Motion

Motion helpers wrap view transitions, FLIP animations, and spring physics.

```ts
import { transition } from '@bquery/bquery/motion';

await transition(() => {
  // update DOM here
});
```

## View transitions

`transition` accepts either a function or an options object.

```ts
await transition(() => {
  $('#content').text('Updated');
});

await transition({
  update: () => {
    $('#content').text('Updated');
  },
});
```

## FLIP animations

```ts
import { capturePosition, flip, flipList } from '@bquery/bquery/motion';

const first = capturePosition(card);
// ...DOM changes...
await flip(card, first, { duration: 300, easing: 'ease-out' });

await flipList(items, () => {
  container.appendChild(container.firstElementChild!);
});
```

### FLIP options

- `duration` (ms)
- `easing` (CSS easing string)
- `onComplete` callback

## Springs

```ts
import { spring, springPresets } from '@bquery/bquery/motion';

const x = spring(0, springPresets.snappy);
x.onChange((value) => {
  box.style.transform = `translateX(${value}px)`;
});

await x.to(120);
```

### Spring API

- `to(target)` – animate to target
- `current()` – get current value
- `stop()` – stop animation
- `onChange(callback)` – subscribe to updates
