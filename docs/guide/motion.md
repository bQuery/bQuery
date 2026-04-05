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
  classes: ['page-swap'],
  types: ['navigation'],
  skipOnReducedMotion: true,
  onReady: () => console.log('transition ready'),
  onFinish: () => console.log('transition finished'),
});
```

### Transition options

- `update` – DOM update callback that runs inside the transition
- `classes` – CSS classes applied to `document.documentElement` while the transition is active
- `types` – View Transition type tokens added when the browser supports them
- `skipOnReducedMotion` – fallback to an immediate update if reduced motion is preferred
- `onReady` – callback once the transition is ready to animate
- `onFinish` – callback after the transition completes

## Global transition defaults

You can centralize motion defaults with the platform config helpers:

```ts
import { defineBqueryConfig } from '@bquery/bquery/platform';
import { transition } from '@bquery/bquery/motion';

defineBqueryConfig({
  transitions: {
    skipOnReducedMotion: true,
    classes: ['app-transition'],
    types: ['navigation'],
  },
});

await transition(() => {
  $('#content').text('Configured globally');
});
```

## Reduced motion

```ts
import { prefersReducedMotion } from '@bquery/bquery/motion';

if (prefersReducedMotion()) {
  // keep it subtle ✨
}
```

Override the preference globally when you need deterministic behavior in demos, tests, or admin-controlled experiences:

```ts
import { setReducedMotion } from '@bquery/bquery/motion';

setReducedMotion(true); // force instant motion-safe behavior
setReducedMotion(null); // return to the user's system preference
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

### Individual easing exports

For tree-shaking, you can import individual easing functions:

```ts
import {
  linear,
  easeInQuad,
  easeOutQuad,
  easeInOutQuad,
  easeInCubic,
  easeOutCubic,
  easeInOutCubic,
  easeOutExpo,
  easeOutBack,
} from '@bquery/bquery/motion';

// Use directly
const t = 0.5;
const value = easeOutCubic(t); // 0.875
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

## Morph animations

`morphElement()` animates between two elements using FLIP-style geometry capture and falls back gracefully when the browser cannot animate the transition.

```ts
import { morphElement } from '@bquery/bquery/motion';

await morphElement(sourceCard, targetCard, {
  duration: 220,
  easing: 'ease-out',
});
```

## Parallax

```ts
import { parallax } from '@bquery/bquery/motion';

const stopParallax = parallax(document.querySelector('.hero')!, {
  speed: 0.25,
  direction: 'vertical',
  respectReducedMotion: true,
});

stopParallax();
```

## Typewriter

```ts
import { typewriter } from '@bquery/bquery/motion';

const typing = typewriter(document.querySelector('#headline')!, 'Hello from bQuery', {
  speed: 28,
  cursor: true,
});

await typing.done;
typing.stop();
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

## Combining animations

Many real-world scenarios combine multiple motion helpers. Here are common patterns:

### Page transition with staggered content

```ts
import { transition, animate, stagger, keyframePresets } from '@bquery/bquery/motion';
import { $ } from '@bquery/bquery/core';

async function navigateToPage(content: string) {
  await transition(async () => {
    $('#content').html(content);

    // Stagger-animate the new content items
    const items = document.querySelectorAll('#content .card');
    const delay = stagger(60);
    for (let i = 0; i < items.length; i++) {
      animate(items[i], {
        keyframes: keyframePresets.fadeIn(),
        options: { duration: 300, easing: 'ease-out', delay: delay(i, items.length) },
      });
    }
  });
}
```

### Spring-based interactive element

```ts
import { spring, springPresets } from '@bquery/bquery/motion';

const scale = spring(1, springPresets.snappy);
const button = document.querySelector('#bounce-btn')!;

scale.onChange((val) => {
  button.style.transform = `scale(${val})`;
});

button.addEventListener('pointerdown', () => scale.to(0.92));
button.addEventListener('pointerup', () => scale.to(1));
button.addEventListener('pointerleave', () => scale.to(1));
```

## Tips for beginners

- **Start with `transition()`** — it's the simplest way to animate DOM changes
- **Use `keyframePresets`** instead of writing keyframes manually — they cover most common animations
- **Always check `prefersReducedMotion()`** to respect user preferences — for `transition()` you can use `skipOnReducedMotion: true`, and for other helpers use `respectReducedMotion` where supported
- **`scrollAnimate()` is great for landing pages** — it automatically triggers animations when elements scroll into view
- **Springs feel more natural** than CSS transitions for interactive elements like drag, resize, and button feedback
- **Use `sequence()` or `timeline()`** when you need multiple animations to run in a specific order
