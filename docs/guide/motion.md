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

Subscribe to changes (e.g. user toggles the OS-level preference while the
app is running) via `onReducedMotionChange()`, or use the reactive
`reducedMotionSignal()` in components and `view` bindings:

```ts
import { onReducedMotionChange, prefersReducedMotion, reducedMotionSignal } from '@bquery/bquery/motion';
import { effect } from '@bquery/bquery/reactive';

document.documentElement.dataset.reducedMotion = String(prefersReducedMotion());

const off = onReducedMotionChange((reduced) => {
  document.documentElement.dataset.reducedMotion = String(reduced);
});

const reduced = reducedMotionSignal();
effect(() => console.log('reduced motion is now', reduced.value));
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

Use `grid: [columns, rows]` for 2D layouts, and pass `from: { x, y }` when the
origin should be a specific grid cell.

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
  // Quad / Cubic / Quart / Quint
  easeInQuad,
  easeOutQuad,
  easeInOutQuad,
  easeInCubic,
  easeOutCubic,
  easeInOutCubic,
  easeInQuart,
  easeOutQuart,
  easeInOutQuart,
  easeInQuint,
  easeOutQuint,
  easeInOutQuint,
  // Sine / Expo / Circ
  easeInSine,
  easeOutSine,
  easeInOutSine,
  easeInExpo,
  easeOutExpo,
  easeInOutExpo,
  easeInCirc,
  easeOutCirc,
  easeInOutCirc,
  // Back / Elastic / Bounce
  easeInBack,
  easeOutBack,
  easeInOutBack,
  easeInElastic,
  easeOutElastic,
  easeInOutElastic,
  easeInBounce,
  easeOutBounce,
  easeInOutBounce,
} from '@bquery/bquery/motion';

const value = easeOutCubic(0.5); // 0.875
```

### `cubicBezier()` / `steps()` factories

Mirror CSS `cubic-bezier()` and `steps()` exactly:

```ts
import { cubicBezier, steps } from '@bquery/bquery/motion';

const customEase = cubicBezier(0.42, 0, 0.58, 1);
const stairs = steps(4, 'end'); // matches CSS steps(4, end)
```

### `mix()` and `chain()` composers

```ts
import { mix, chain, easeOutCubic, easeOutBack, easeInQuad, easeOutBounce } from '@bquery/bquery/motion';

const softSpring = mix(easeOutCubic, easeOutBack, 0.4);
const inThenBounce = chain(easeInQuad, easeOutBounce);
```

## Animated values (DOM-free tweens)

`animateValue()` and `tween()` interpolate numbers, number arrays, or
plain-object records of numbers between `from` and `to`. They run via
`requestAnimationFrame` and do not require a DOM element.

```ts
import { animateValue, tween, easeOutCubic } from '@bquery/bquery/motion';

await animateValue({
  from: 0,
  to: 100,
  duration: 500,
  easing: easeOutCubic,
  onUpdate: (v) => (counter.textContent = String(Math.round(v))),
});

const t = tween({
  from: { x: 0, y: 0 },
  to: { x: 100, y: 50 },
  duration: 800,
  onUpdate: ({ x, y }) => (el.style.transform = `translate(${x}px, ${y}px)`),
});
t.pause();
t.seek(0.5);
t.reverse();
t.resume();
await t.finished;
```

## `animateTo()` and `animate()` controls

`animateTo()` turns a CSS property record into keyframes; the standard
`animate()` helper accepts an `AbortSignal` and a `playbackRate` override:

```ts
import { animate, animateTo } from '@bquery/bquery/motion';

await animateTo(card, { opacity: 1, transform: 'translateY(0)' }, {
  duration: 320,
  easing: 'ease-out',
});

const ctrl = new AbortController();
animate(card, {
  keyframes: [{ opacity: 1 }, { opacity: 0 }],
  options: { duration: 400 },
  signal: ctrl.signal,
  playbackRate: 0.5,
});
// ctrl.abort() cancels the animation.
```

## Keyframe presets

```ts
import { keyframePresets } from '@bquery/bquery/motion';

await animate(card, {
  keyframes: keyframePresets.pop(),
  options: { duration: 240, easing: 'ease-out' },
});
```

## Timeline

```ts
import { keyframePresets, timeline } from '@bquery/bquery/motion';

const tl = timeline([
  { target: card, keyframes: keyframePresets.slideInUp(), options: { duration: 240 } },
  { target: badge, keyframes: keyframePresets.pop(), options: { duration: 200 }, at: '+=80' },
]);

await tl.play();
```

### Labels, repeat, yoyo, and playback rate

```ts
const tl = timeline();
tl.add({ target: a, keyframes: [...], options: { duration: 200 } });
tl.addLabel('mid'); // anchor at the end of the previous step
tl.add({ target: b, keyframes: [...], options: { duration: 200 }, at: 'mid+=120' });

tl.repeat(2);        // play 3 times total
tl.yoyo(true);       // alternate direction every iteration
tl.playbackRate(1.5);

tl.onUpdate((t) => console.log('time', t));
console.log('progress:', tl.progress()); // 0..1

const playing = tl.play();
await new Promise((resolve) => setTimeout(resolve, 150));
tl.reverse(); // mid-flight direction flip
await playing;
```

## Scroll progress & in-view

`scrollProgress()` drives a `[0, 1]` value as an element moves through the
viewport; `inView()` resolves a promise the first time the element appears.
At the moment, `scrollProgress()` computes progress relative to the window
viewport; `root`, `rootMargin`, and `offset` are compatibility options and are
not applied yet.

```ts
import { scrollProgress, inView } from '@bquery/bquery/motion';

const stop = scrollProgress(section, {
  onProgress: (p) => (header.style.opacity = String(1 - p)),
});

await inView(card);
card.classList.add('visible');

// Reactive variant
const handle = inView(card, { onChange: (entered) => console.log(entered) });
// handle.cancel() to detach.
```

## Micro-interactions

```ts
import { magnetic, tilt, shake, pulse, countUp } from '@bquery/bquery/motion';

const detachMagnet = magnetic(button, { strength: 0.4, radius: 100 });
const detachTilt = tilt(card, { max: 12, perspective: 800 });

await shake(input, { duration: 350, intensity: 6 });
await pulse(badge, { iterations: 3, scale: 1.12 });
await countUp(counter, 0, 1234, { duration: 1200, suffix: ' visits' });
```

All micro-interactions respect `prefers-reduced-motion` by default.

## Sequence

```ts
import { sequence } from '@bquery/bquery/motion';

await sequence([
  { target: itemA, keyframes: keyframePresets.fadeIn(), options: { duration: 120 } },
  { target: itemB, keyframes: keyframePresets.fadeIn(), options: { duration: 120 } },
]);
```

## Stagger (linear, grid, randomized)

```ts
import { stagger } from '@bquery/bquery/motion';

const center = stagger(50, { from: 'center' });
const grid = stagger(40, { grid: [4, 4], from: { x: 0, y: 0 } });
const rowOnly = stagger(30, { grid: [4, 4], from: { x: 0, y: 0 }, axis: 'x' });
const chaotic = stagger(20, { random: true, randomSeed: 42 });
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
- `velocity(value?)` – read or inject the spring's instantaneous velocity
- `set(value)` – snap to a value without animating (resets velocity)
- `stop()` – stop animation
- `onChange(callback)` – subscribe to updates

Available presets: `gentle`, `snappy`, `bouncy`, `stiff`, `wobbly`, `slow`, `molasses`.

### Multi-dimensional springs

`springVector()` drives multiple springs in lockstep. `to()` resolves only
after every dimension has settled.

```ts
import { springVector, springPresets } from '@bquery/bquery/motion';

const pos = springVector({ x: 0, y: 0 }, springPresets.snappy);
pos.onChange(({ x, y }) => (el.style.transform = `translate(${x}px, ${y}px)`));
await pos.to({ x: 120, y: 40 });
pos.set({ x: 0, y: 0 });
```

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
