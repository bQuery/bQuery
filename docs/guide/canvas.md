# Canvas

The `@bquery/bquery/canvas` module gives bQuery a chainable, signal-friendly
API over the HTML `<canvas>` element. It pairs an immediate-mode wrapper with
an opt-in retained-mode scene graph, a reactive render loop, and a RAF frame
loop that respects `prefers-reduced-motion`.

The module is tree-shakeable, has zero runtime dependencies, and is SSR-safe:
no DOM references run at import time.

## Quickstart

```ts
import { $canvas } from '@bquery/bquery/canvas';
import { signal } from '@bquery/bquery/reactive';

const angle = signal(0);

const canvas = $canvas('#stage').size(400, 300).autoResize('parent');

canvas.render(() => {
  canvas.clear('white');
  canvas
    .save()
    .translate(200, 150)
    .rotate(angle.value);
  canvas.rect(-40, -40, 80, 80, { fill: 'tomato' });
  canvas.restore();
});

canvas.frame(({ delta }) => {
  angle.value += delta * 0.001; // tracked signal → render() re-runs
});
```

## Selectors and wrappers

| Selector / factory                              | Returns                  | Behavior                                                                 |
| ----------------------------------------------- | ------------------------ | ------------------------------------------------------------------------ |
| `$canvas(target)`                               | `BQueryCanvas`           | Throws when the selector misses or the element is not a `<canvas>`.      |
| `$$canvas(target)`                              | `BQueryCanvasCollection` | Never throws; iterates with `.each()`, `.map()`, broadcast `.clear()` / `.render()`. |
| `createCanvas({ width, height, dpr, ariaLabel })` | `BQueryCanvas`         | Detached canvas; mount later with `.appendTo(parent)`.                   |

## Sizing and DPR

`BQueryCanvas` keeps the backing store in sync with the active device pixel
ratio so callers can think in CSS pixels:

```ts
canvas.size(400, 300);   // CSS pixels; backing store scales to DPR
canvas.setDpr(2);        // force a specific DPR (e.g. snapshots)
canvas.viewport();       // → { width, height, dpr }
canvas.autoResize('parent'); // wires a ResizeObserver
canvas.stopAutoResize();
```

When `autoResize('window')` is used, a `resize` listener is wired instead of
`ResizeObserver`. Disposers are cleaned up by `canvas.dispose()` or
`stopAutoResize()`.

## Immediate-mode drawing

All draw methods return `this` so calls can be chained jQuery-style:

```ts
canvas
  .clear('#0b1020')
  .style({ fill: '#fff', stroke: '#0af', lineWidth: 2 })
  .rect(20, 20, 100, 80, { fill: '#ff5' })
  .roundRect(140, 20, 100, 80, 16, { stroke: '#fff' })
  .circle(70, 180, 40, { fill: '#0af' })
  .text('hello canvas', 20, 260, { fill: '#fff', font: '20px sans-serif' });
```

`.path(builder, options?)` accepts a fluent path builder:

```ts
canvas.path(
  p => {
    p.moveTo(10, 10).lineTo(60, 90).quadraticCurveTo(120, 0, 180, 90).closePath();
  },
  { fill: 'red', stroke: 'black' }
);
```

`.text(content, x, y)` always renders `content` as plain text — HTML is never
interpolated. The module deliberately does not provide an HTML-template API
on the canvas surface.

## Reactive render loop

`render(fn)` registers a callback inside an `effect()`. Any signal `.value`
read inside `fn` schedules a re-render; `.peek()` reads without subscribing.

```ts
const handle = canvas.render(() => {
  canvas.clear('white');
  canvas.text(`count: ${count.value}`, 10, 30);
});

handle.pause();   // skip re-renders while paused
handle.resume();  // flush a pending invalidate (if any)
handle.invalidate(); // force a manual re-run
handle.dispose();
```

Options:

- `clearEachFrame: false` — disable the implicit `clear()` before each call.
- `reactive: false` — run once without subscribing to signals.

## RAF frame loop

`frame(fn)` schedules a `requestAnimationFrame` loop. Signal reads inside
`fn` are intentionally **not** tracked — use this for purely imperative
per-frame work (typically `frame()` mutates signals that a `render()`
callback subscribes to).

```ts
const handle = canvas.frame(({ delta, elapsed, fps, frame }) => {
  // delta in milliseconds; fps is an exponential moving average
  angle.value += delta * 0.001;
});

handle.pause();
handle.resume();
handle.dispose();
```

By default `frame()` respects `prefers-reduced-motion: reduce` and skips
animation callbacks while the preference is active. Pass
`{ respectReducedMotion: false }` to opt out.

## Pointer events and hit-testing

`canvas.on(type, fn)` normalizes pointer coordinates into canvas-local CSS
pixels:

```ts
canvas.on('pointermove', e => {
  console.log(e.x, e.y, e.buttons, e.isOver);
});

canvas.once('click', e => console.log('clicked at', e.x, e.y));
canvas.off('pointermove');
```

For path-level hit-testing use `canvas.hitTest(point, path, mode?)` which
delegates to `isPointInPath` / `isPointInStroke`, and
`canvas.hitTestRect(point, rect)` for axis-aligned bbox tests.

## Images

```ts
import { loadImage } from '@bquery/bquery/canvas';

const img = await loadImage('/hero.png', {
  crossOrigin: 'anonymous',     // required to avoid tainting the canvas
  referrerPolicy: 'no-referrer',
});

canvas.image(img, 0, 0, { width: 200, height: 120 });
```

`canvas.image(url, ...)` accepts a URL directly. If the image is not yet in
the cache, the draw is skipped and the canvas invalidates itself once the
image resolves (so a `render()` callback re-runs and paints the image).

## Scene graph (opt-in)

The retained-mode scene graph layers declarative nodes on top of the
immediate-mode wrapper:

```ts
import {
  $canvas,
  circleNode,
  createScene,
  groupNode,
  rectNode,
} from '@bquery/bquery/canvas';

const canvas = $canvas('#stage').size(400, 300);
const scene = createScene(canvas);

scene.add(rectNode({ id: 'bg', x: 0, y: 0, width: 400, height: 300, fill: '#0b1020' }));
scene.add(
  groupNode({
    transform: { translateX: 200, translateY: 150 },
    children: [
      circleNode({ id: 'ball', x: 0, y: 0, radius: 40, fill: '#0af', interactive: true,
        onClick: (_, node) => console.log('clicked', node.id) }),
    ],
  })
);

scene.render();
```

Each node carries `transform`, `zIndex`, `opacity`, `visible`, `interactive`,
and pointer callbacks. `scene.hitTest(point)` returns the front-most
interactive node at the given canvas coordinates.

## Offscreen and worker rendering

`offscreen(width, height)` returns an `OffscreenCanvas` when available and a
detached `<canvas>` otherwise. `renderOnWorker(canvas, worker)` is a thin
adapter that transfers control of a canvas to a Worker via
`HTMLCanvasElement.transferControlToOffscreen()`:

```ts
import { renderOnWorker } from '@bquery/bquery/canvas';

const worker = new Worker(new URL('./paint-worker.ts', import.meta.url), { type: 'module' });
const handle = renderOnWorker(canvas, worker, {
  initMessage: { dpr: window.devicePixelRatio },
});
handle.post({ type: 'resize', width: 800, height: 600 });
```

After transferring control, the main thread can no longer draw on the canvas
directly.

## SSR

`@bquery/bquery/canvas` imports cleanly in Node, Bun, and Deno: no `document`,
`window`, `HTMLCanvasElement`, or `OffscreenCanvas` is referenced at module
evaluation. Calling `createCanvas()` outside a browser-like runtime throws
with an actionable message.

## Accessibility

Canvas content is opaque to assistive technologies. Provide an `aria-label`
on the element (use `createCanvas({ ariaLabel: '...' })` or set it manually)
and include accessible fallback markup as child content of `<canvas>` where
possible. Reduced-motion preferences are honored by `frame()` by default.

## Security

- `.text(content, ...)` only accepts strings/numbers; HTML is never injected.
- `loadImage(url, options)` uses raw string assignment for `<img>.src`, which
  is not a Trusted Types sink. Cross-origin images must opt in via
  `crossOrigin: 'anonymous'` to avoid tainting the canvas — otherwise
  `snapshot()` will throw a wrapped `SecurityError` with an actionable
  message.
- The module never uses `eval`, `new Function()`, or string-template DSLs.

## Utilities

```ts
import {
  imageDataSignal,
  measureText,
  offscreen,
  pickPixel,
  toBlob,
  toDataURL,
} from '@bquery/bquery/canvas';

const blob = await toBlob(canvas, { type: 'image/webp', quality: 0.85 });
const url = toDataURL(canvas);
const pixel = pickPixel(canvas, 10, 10); // → { r, g, b, a }
const text = measureText(canvas.ctx, 'hello', '14px serif');
const off = offscreen(256, 256);
const data = imageDataSignal(canvas); // reactive ImageData wrapper
```
