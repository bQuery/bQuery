# Motion

Motion helpers wrap view transitions, FLIP animations, springs, and modern Web Animations utilities.

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

## Reduced motion

```ts
import { prefersReducedMotion } from '@bquery/bquery/motion';

if (prefersReducedMotion()) {
  // keep it subtle ✨
}
```

## FLIP animations

```ts
import { capturePosition, flip, flipElements, flipList } from '@bquery/bquery/motion';

const first = capturePosition(card);
// ...DOM changes...
await flip(card, first, { duration: 300, easing: 'ease-out' });

await flipList(items, () => {
  container.appendChild(container.firstElementChild!);
});

await flipElements(
  items,
  () => {
    items.reverse().forEach((item) => container.appendChild(item));
  },
  { stagger: (index) => index * 20 }
);
```

### FLIP options

- `duration` (ms)
- `easing` (CSS easing string)
- `onComplete` callback

## Web Animations helper

```ts
import { animate } from '@bquery/bquery/motion';

await animate(card, {
  keyframes: [
    { opacity: 0, transform: 'translateY(8px)' },
    { opacity: 1, transform: 'translateY(0)' },
  ],
  options: { duration: 200, easing: 'ease-out' },
});
```

## Stagger

```ts
import { stagger } from '@bquery/bquery/motion';

const delay = stagger(40, { from: 'center' });
items.forEach((item, index) => {
  item.style.animationDelay = `${delay(index, items.length)}ms`;
});
```

## Easing presets

```ts
import { easingPresets } from '@bquery/bquery/motion';

const ease = easingPresets.easeOutCubic;
```

## Keyframe presets

```ts
import { keyframePresets } from '@bquery/bquery/motion';

await animate(card, {
  keyframes: keyframePresets.pop(),
  options: { duration: 240, easing: 'ease-out' },
});
```

## Sequence

```ts
import { sequence } from '@bquery/bquery/motion';

await sequence([
  { target: itemA, keyframes: keyframePresets.fadeIn(), options: { duration: 120 } },
  { target: itemB, keyframes: keyframePresets.fadeIn(), options: { duration: 120 } },
]);
```

## Timeline

```ts
import { timeline } from '@bquery/bquery/motion';

const tl = timeline([
  { target: card, keyframes: keyframePresets.slideInUp(), options: { duration: 240 } },
  { target: badge, keyframes: keyframePresets.pop(), options: { duration: 200 }, at: '+=80' },
]);

await tl.play();
```

## Scroll animations

```ts
import { scrollAnimate, keyframePresets } from '@bquery/bquery/motion';

const cleanup = scrollAnimate(document.querySelectorAll('.reveal'), {
  keyframes: keyframePresets.fadeIn(),
  options: { duration: 200, easing: 'ease-out' },
  rootMargin: '0px 0px -10% 0px',
});

// later
cleanup();
```

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
