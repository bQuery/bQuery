# Media

The media module exposes reactive wrappers around browser and device APIs.

```ts
import {
  breakpoints,
  clipboard,
  mediaQuery,
  useBattery,
  useDeviceMotion,
  useDeviceOrientation,
  useGeolocation,
  useNetworkStatus,
  useViewport,
} from '@bquery/bquery/media';
```

## Media queries and breakpoints

```ts
const isDark = mediaQuery('(prefers-color-scheme: dark)');
const bp = breakpoints({ sm: 640, md: 768, lg: 1024 });

console.log(isDark.value, bp.md.value);

isDark.destroy();
bp.sm.destroy();
bp.md.destroy();
bp.lg.destroy();
bp.destroyAll();
```

## Viewport and network state

```ts
const viewport = useViewport();
const network = useNetworkStatus();

console.log(viewport.value.width, viewport.value.orientation);
console.log(network.value.online, network.value.effectiveType);

viewport.destroy();
network.destroy();
```

## Battery and geolocation

```ts
const battery = useBattery();
const geo = useGeolocation({ watch: true, enableHighAccuracy: true });

console.log(battery.value.level, battery.value.charging);
console.log(geo.value.latitude, geo.value.longitude, geo.value.error);

battery.destroy();
geo.destroy();
```

## Device sensors

```ts
const motion = useDeviceMotion();
const orientation = useDeviceOrientation();

console.log(motion.value.acceleration.x);
console.log(orientation.value.alpha);

motion.destroy();
orientation.destroy();
```

## Clipboard helpers

```ts
await clipboard.write('Copied from bQuery');
const text = await clipboard.read();
console.log(text);
```

All media signals expose `destroy()` so you can release listeners cleanly when a view or component goes away. Breakpoint collections also expose `destroyAll()` for bulk cleanup, with a `destroy()` alias when none of your breakpoint names use that key.

## Observer composables

Reactive wrappers for the browser's `IntersectionObserver`, `ResizeObserver`, and `MutationObserver` APIs.

### Intersection observer

Track whether an element is visible inside a scrollable ancestor or the viewport.

```ts
import { useIntersectionObserver } from '@bquery/bquery/media';
import { effect } from '@bquery/bquery/reactive';

const el = document.querySelector('#lazy-image')!;
const io = useIntersectionObserver(el, { threshold: 0.5 });

effect(() => {
  if (io.value.isIntersecting) {
    console.log('Element is at least 50% visible');
  }
});

// Add or remove targets at any time
const another = document.querySelector('#banner')!;
io.observe(another);
io.unobserve(another);

io.destroy();
```

You can also pass an array of elements or call `useIntersectionObserver()` with no arguments and add targets later via `observe()`.

### Resize observer

Track the content-box (or border-box) size of one or more elements.

```ts
import { useResizeObserver } from '@bquery/bquery/media';
import { effect } from '@bquery/bquery/reactive';

const panel = document.querySelector('#panel')!;
const size = useResizeObserver(panel);

effect(() => {
  console.log(`Panel: ${size.value.width}×${size.value.height}`);
});

size.destroy();
```

Pass `{ box: 'border-box' }` as the second argument to observe border-box dimensions instead.

### Mutation observer

React to DOM mutations (attribute changes, child-list edits, character data).

```ts
import { useMutationObserver } from '@bquery/bquery/media';
import { effect } from '@bquery/bquery/reactive';

const el = document.querySelector('#dynamic-content')!;
const mo = useMutationObserver(el, { childList: true, subtree: true });

effect(() => {
  console.log(`${mo.value.count} mutation batches so far`);
  for (const m of mo.value.mutations) {
    console.log(m.type, m.target);
  }
});

// Manually flush pending records
const pending = mo.takeRecords();

mo.destroy();
```

When no options are given, `useMutationObserver` defaults to `{ attributes: true }`.
