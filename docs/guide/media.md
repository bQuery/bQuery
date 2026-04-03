# Media

The media module exposes reactive wrappers and helpers around browser and device APIs. Many composables return reactive signals that update automatically when the underlying browser state changes, typically as a `MediaSignalHandle` with a `destroy()` method for cleanup. Some utilities return helper objects with their own APIs instead.

```ts
import {
  breakpoints,
  clipboard,
  mediaQuery,
  useBattery,
  useDeviceMotion,
  useDeviceOrientation,
  useGeolocation,
  useIntersectionObserver,
  useMutationObserver,
  useNetworkStatus,
  useResizeObserver,
  useViewport,
} from '@bquery/bquery/media';
```

---

## Media Queries

### `mediaQuery()`

Creates a reactive boolean signal that tracks whether a CSS media query matches.

```ts
function mediaQuery(query: string): MediaSignalHandle<boolean>;
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | `string` | A valid CSS media query string |

```ts
const isDark = mediaQuery('(prefers-color-scheme: dark)');
const isWide = mediaQuery('(min-width: 1024px)');
const isPortrait = mediaQuery('(orientation: portrait)');

import { effect } from '@bquery/bquery/reactive';

effect(() => {
  console.log('Dark mode:', isDark.value);
  console.log('Wide screen:', isWide.value);
});

// Clean up listeners
isDark.destroy();
isWide.destroy();
isPortrait.destroy();
```

---

## Breakpoints

### `breakpoints()`

Defines named breakpoints and returns reactive boolean signals for each. Each signal is `true` when the viewport width is at least the specified value.

```ts
function breakpoints<T extends BreakpointMap>(
  bp: T
): BreakpointSignals<T>;
```

```ts
type BreakpointMap = Record<string, number>;
```

The return object has a signal for each key, plus `destroyAll()` for bulk cleanup and a `destroy()` alias.

```ts
const bp = breakpoints({ sm: 640, md: 768, lg: 1024, xl: 1280 });

import { effect } from '@bquery/bquery/reactive';

effect(() => {
  if (bp.xl.value) {
    console.log('Extra-large viewport');
  } else if (bp.lg.value) {
    console.log('Large viewport');
  } else if (bp.md.value) {
    console.log('Medium viewport');
  } else {
    console.log('Small viewport');
  }
});

// Clean up all breakpoint listeners
bp.destroyAll();

// Or destroy individually
bp.sm.destroy();
```

---

## Viewport

### `useViewport()`

Returns a reactive signal tracking the current viewport dimensions and orientation.

```ts
function useViewport(): ViewportSignal;
```

#### `ViewportState`

```ts
interface ViewportState {
  /** Current viewport width in pixels. */
  width: number;
  /** Current viewport height in pixels. */
  height: number;
  /** Current orientation. */
  orientation: 'portrait' | 'landscape';
}
```

```ts
const viewport = useViewport();

import { effect } from '@bquery/bquery/reactive';

effect(() => {
  console.log(`Viewport: ${viewport.value.width}×${viewport.value.height}`);
  console.log(`Orientation: ${viewport.value.orientation}`);
});

viewport.destroy();
```

---

## Network Status

### `useNetworkStatus()`

Returns a reactive signal tracking network connectivity and quality.

```ts
function useNetworkStatus(): NetworkSignal;
```

#### `NetworkState`

```ts
interface NetworkState {
  /** Whether the browser is online. */
  online: boolean;
  /** Connection type (e.g., `'4g'`, `'3g'`, `'2g'`, `'slow-2g'`). */
  effectiveType: string;
  /** Estimated downlink speed in Mbps. */
  downlink: number;
  /** Estimated round-trip time in milliseconds. */
  rtt: number;
}
```

```ts
const network = useNetworkStatus();

import { effect } from '@bquery/bquery/reactive';

effect(() => {
  if (!network.value.online) {
    console.warn('No internet connection');
  } else {
    console.log(`Connection: ${network.value.effectiveType}, RTT: ${network.value.rtt}ms`);
  }
});

network.destroy();
```

---

## Battery

### `useBattery()`

Returns a reactive signal tracking the device's battery status via the Battery Status API.

```ts
function useBattery(): BatterySignal;
```

#### `BatteryState`

```ts
interface BatteryState {
  /** Whether the Battery API is supported. */
  supported: boolean;
  /** Whether the device is currently charging. */
  charging: boolean;
  /** Seconds until fully charged, or `Infinity`. */
  chargingTime: number;
  /** Seconds until fully discharged, or `Infinity`. */
  dischargingTime: number;
  /** Battery level from 0 to 1. */
  level: number;
}
```

```ts
const battery = useBattery();

import { effect } from '@bquery/bquery/reactive';

effect(() => {
  if (battery.value.supported) {
    console.log(`Battery: ${Math.round(battery.value.level * 100)}%`);
    console.log(`Charging: ${battery.value.charging}`);
  } else {
    console.log('Battery API not supported');
  }
});

battery.destroy();
```

---

## Geolocation

### `useGeolocation()`

Returns a reactive signal tracking the device's geographic position.

```ts
function useGeolocation(
  options?: GeolocationOptions
): GeolocationSignal;
```

#### `GeolocationOptions`

```ts
interface GeolocationOptions {
  /** Enable high-accuracy mode (GPS). Default: `false` */
  enableHighAccuracy?: boolean;
  /** Maximum age of cached position in milliseconds. Default: `0` */
  maximumAge?: number;
  /** Timeout for position request in milliseconds. Default: `Infinity` */
  timeout?: number;
  /** Watch for continuous position updates. Default: `false` */
  watch?: boolean;
}
```

#### `GeolocationState`

```ts
interface GeolocationState {
  /** Whether the Geolocation API is supported. */
  supported: boolean;
  /** Whether position data is being loaded. */
  loading: boolean;
  /** Current latitude, or `null` if unavailable. */
  latitude: number | null;
  /** Current longitude, or `null` if unavailable. */
  longitude: number | null;
  /** Position accuracy in meters. */
  accuracy: number | null;
  /** Altitude in meters, or `null`. */
  altitude: number | null;
  /** Altitude accuracy in meters, or `null`. */
  altitudeAccuracy: number | null;
  /** Heading in degrees (0–360), or `null`. */
  heading: number | null;
  /** Speed in meters per second, or `null`. */
  speed: number | null;
  /** Position timestamp. */
  timestamp: number | null;
  /** Error message, or `null`. */
  error: string | null;
}
```

#### Examples

**Single position request:**

```ts
const geo = useGeolocation();

import { effect } from '@bquery/bquery/reactive';

effect(() => {
  if (geo.value.loading) {
    console.log('Getting position...');
  } else if (geo.value.error) {
    console.error('Geolocation error:', geo.value.error);
  } else {
    console.log(`Position: ${geo.value.latitude}, ${geo.value.longitude}`);
    console.log(`Accuracy: ${geo.value.accuracy}m`);
  }
});

geo.destroy();
```

**Continuous tracking (watch mode):**

```ts
const geo = useGeolocation({
  watch: true,
  enableHighAccuracy: true,
  timeout: 10000,
});

effect(() => {
  if (geo.value.latitude !== null) {
    updateMapMarker(geo.value.latitude, geo.value.longitude!);
  }
});

geo.destroy();
```

---

## Device Sensors

### `useDeviceMotion()`

Returns a reactive signal tracking device motion data from the accelerometer and gyroscope.

```ts
function useDeviceMotion(): DeviceMotionSignal;
```

#### `DeviceMotionState`

```ts
interface DeviceMotionState {
  /** Acceleration in m/s² without gravity. */
  acceleration: { x: number | null; y: number | null; z: number | null };
  /** Acceleration in m/s² including gravity. */
  accelerationIncludingGravity: { x: number | null; y: number | null; z: number | null };
  /** Rotation rate in degrees/second. */
  rotationRate: { alpha: number | null; beta: number | null; gamma: number | null };
  /** Interval between updates in milliseconds. */
  interval: number;
}
```

```ts
const motion = useDeviceMotion();

effect(() => {
  const { x, y, z } = motion.value.acceleration;
  console.log(`Acceleration: x=${x}, y=${y}, z=${z}`);
});

motion.destroy();
```

### `useDeviceOrientation()`

Returns a reactive signal tracking device orientation data from the compass and gyroscope.

```ts
function useDeviceOrientation(): DeviceOrientationSignal;
```

#### `DeviceOrientationState`

```ts
interface DeviceOrientationState {
  /** Rotation around the z-axis (0–360°). Compass heading. */
  alpha: number | null;
  /** Rotation around the x-axis (−180° to 180°). Front-back tilt. */
  beta: number | null;
  /** Rotation around the y-axis (−90° to 90°). Left-right tilt. */
  gamma: number | null;
  /** Whether the orientation is absolute (relative to Earth). */
  absolute: boolean;
}
```

```ts
const orientation = useDeviceOrientation();

effect(() => {
  console.log(`Compass heading: ${orientation.value.alpha}°`);
  console.log(`Tilt: ${orientation.value.beta}° / ${orientation.value.gamma}°`);
});

orientation.destroy();
```

---

## Clipboard

### `clipboard`

A singleton object wrapping the Clipboard API for simple async read/write access.

```ts
const clipboard: ClipboardAPI;
```

#### `ClipboardAPI`

```ts
interface ClipboardAPI {
  /** Read text from the clipboard. */
  read: () => Promise<string>;
  /** Write text to the clipboard. */
  write: (text: string) => Promise<void>;
}
```

```ts
// Write to clipboard
await clipboard.write('Hello from bQuery!');

// Read from clipboard
const text = await clipboard.read();
console.log(text); // 'Hello from bQuery!'
```

---

## Observer Composables

Reactive wrappers for the browser's `IntersectionObserver`, `ResizeObserver`, and `MutationObserver` APIs. Each returns a signal that follows the `MediaSignalHandle` pattern with additional observer-specific methods.

### Intersection Observer

#### `useIntersectionObserver()`

Tracks whether elements are visible inside a scrollable ancestor or the viewport.

```ts
function useIntersectionObserver(
  target?: Element | Element[] | null,
  options?: IntersectionObserverOptions
): IntersectionObserverSignal;
```

#### `IntersectionObserverOptions`

```ts
interface IntersectionObserverOptions {
  /** Root element for intersection testing. Default: browser viewport (`null`) */
  root?: Element | Document | null;
  /** Margin around the root. Default: `undefined` (CSS margin syntax, e.g., `'10px 20px'`) */
  rootMargin?: string;
  /** Visibility thresholds (0–1). Default: `undefined` (fires at 0) */
  threshold?: number | number[];
}
```

#### `IntersectionObserverState`

```ts
interface IntersectionObserverState {
  /** Whether the target is currently intersecting the root. */
  isIntersecting: boolean;
  /** Intersection ratio (0–1). */
  intersectionRatio: number;
  /** The most recent `IntersectionObserverEntry`, or `null`. */
  entry: IntersectionObserverEntry | null;
}
```

#### `IntersectionObserverSignal`

```ts
interface IntersectionObserverSignal extends MediaSignalHandle<IntersectionObserverState> {
  /** Start observing an additional target. */
  observe(target: Element): void;
  /** Stop observing a target. */
  unobserve(target: Element): void;
}
```

#### Examples

**Lazy-load an image:**

```ts
const img = document.querySelector('#lazy-image')!;
const io = useIntersectionObserver(img, { threshold: 0.1 });

effect(() => {
  if (io.value.isIntersecting) {
    img.setAttribute('src', img.dataset.src!);
    io.destroy();
  }
});
```

**Track visibility ratio:**

```ts
const banner = document.querySelector('#banner')!;
const io = useIntersectionObserver(banner, {
  threshold: [0, 0.25, 0.5, 0.75, 1.0],
});

effect(() => {
  console.log(`Banner ${Math.round(io.value.intersectionRatio * 100)}% visible`);
});

io.destroy();
```

**Observe multiple elements dynamically:**

```ts
const io = useIntersectionObserver(null, { threshold: 0.5 });

document.querySelectorAll('.card').forEach((card) => {
  io.observe(card);
});

effect(() => {
  if (io.value.isIntersecting) {
    console.log('A card entered the viewport');
  }
});

io.destroy();
```

### Resize Observer

#### `useResizeObserver()`

Tracks the size of one or more elements.

```ts
function useResizeObserver(
  target?: Element | Element[] | null,
  options?: ResizeObserverOptions
): ResizeObserverSignal;
```

#### `ResizeObserverOptions`

```ts
interface ResizeObserverOptions {
  /** Box model to observe. Default: `'content-box'` */
  box?: ResizeObserverBoxOptions;
}
```

#### `ResizeObserverState`

```ts
interface ResizeObserverState {
  /** Width in pixels (based on the configured box model). */
  width: number;
  /** Height in pixels (based on the configured box model). */
  height: number;
  /** The most recent `ResizeObserverEntry`, or `null`. */
  entry: ResizeObserverEntry | null;
}
```

#### `ResizeObserverSignal`

```ts
interface ResizeObserverSignal extends MediaSignalHandle<ResizeObserverState> {
  /** Start observing an additional target. */
  observe(target: Element): void;
  /** Stop observing a target. */
  unobserve(target: Element): void;
}
```

#### Examples

**Track panel dimensions:**

```ts
const panel = document.querySelector('#panel')!;
const size = useResizeObserver(panel);

effect(() => {
  console.log(`Panel: ${size.value.width}×${size.value.height}`);
});

size.destroy();
```

**Border-box measurement:**

```ts
const box = document.querySelector('#box')!;
const size = useResizeObserver(box, { box: 'border-box' });

effect(() => {
  console.log(`Border-box: ${size.value.width}×${size.value.height}`);
});

size.destroy();
```

**Responsive layout logic:**

```ts
const container = document.querySelector('#container')!;
const size = useResizeObserver(container);

effect(() => {
  const cols = size.value.width > 800 ? 3 : size.value.width > 500 ? 2 : 1;
  container.style.setProperty('--columns', String(cols));
});

size.destroy();
```

### Mutation Observer

#### `useMutationObserver()`

Tracks DOM mutations (attribute changes, child-list edits, character data) on observed nodes.

```ts
function useMutationObserver(
  target?: Node | null,
  options?: MutationObserverOptions
): MutationObserverSignal;
```

#### `MutationObserverOptions`

```ts
interface MutationObserverOptions {
  /** Watch for attribute changes. Default: `true` */
  attributes?: boolean;
  /** Watch for child additions/removals. Default: `false` */
  childList?: boolean;
  /** Watch for text content changes. Default: `false` */
  characterData?: boolean;
  /** Watch the entire subtree. Default: `false` */
  subtree?: boolean;
  /** Record old attribute values. Default: `false` */
  attributeOldValue?: boolean;
  /** Record old character data values. Default: `false` */
  characterDataOldValue?: boolean;
  /** Only watch specific attributes. */
  attributeFilter?: string[];
}
```

#### `MutationObserverState`

```ts
interface MutationObserverState {
  /** Mutations from the most recent callback. */
  mutations: MutationRecord[];
  /** Total number of mutation callback batches received. */
  count: number;
}
```

#### `MutationObserverSignal`

```ts
interface MutationObserverSignal extends MediaSignalHandle<MutationObserverState> {
  /** Start observing an additional target. */
  observe(target: Node): void;
  /** Manually flush pending mutation records. */
  takeRecords(): MutationRecord[];
}
```

#### Examples

**Watch for child changes:**

```ts
const list = document.querySelector('#todo-list')!;
const mo = useMutationObserver(list, { childList: true, subtree: true });

effect(() => {
  console.log(`${mo.value.count} mutation batches`);
  for (const m of mo.value.mutations) {
    console.log(m.type, m.addedNodes.length, 'added');
  }
});

mo.destroy();
```

**Watch specific attributes:**

```ts
const el = document.querySelector('#widget')!;
const mo = useMutationObserver(el, {
  attributes: true,
  attributeFilter: ['data-state', 'aria-expanded'],
  attributeOldValue: true,
});

effect(() => {
  for (const m of mo.value.mutations) {
    console.log(`${m.attributeName}: ${m.oldValue} → ${(m.target as HTMLElement).getAttribute(m.attributeName!)}`);
  }
});

mo.destroy();
```

**Flush pending records manually:**

```ts
const mo = useMutationObserver(document.body, { childList: true });

// Make some DOM changes
document.body.appendChild(document.createElement('div'));

// Flush before the next microtask
const pending = mo.takeRecords();
console.log(pending.length, 'pending mutations');

mo.destroy();
```

---

## Common Patterns

### Cleanup on unmount

All media signals expose `destroy()` so you can release listeners when a view or component goes away:

```ts
import { effect } from '@bquery/bquery/reactive';

const viewport = useViewport();
const network = useNetworkStatus();

// Use in effects...
effect(() => {
  console.log(viewport.value.width, network.value.online);
});

// Clean up when done
viewport.destroy();
network.destroy();
```

### Combining signals

```ts
const bp = breakpoints({ sm: 640, md: 768, lg: 1024 });
const network = useNetworkStatus();

effect(() => {
  if (!network.value.online) {
    showOfflineBanner();
  } else if (bp.sm.value && !bp.md.value) {
    loadMobileLayout();
  } else {
    loadDesktopLayout();
  }
});
```

---

## Notes

- All media signals return readonly signal handles — you cannot write to `.value`.
- Breakpoint collections expose `destroyAll()` for bulk cleanup, with a `destroy()` alias when none of your breakpoint names use that key.
- Observer composables follow the `MediaSignalHandle` pattern with non-enumerable `observe`/`unobserve`/`takeRecords`/`destroy` methods.
- `useResizeObserver` reads `borderBoxSize` or `devicePixelContentBoxSize` when the corresponding box option is configured, with a `contentRect` fallback when box-specific sizes are unavailable.
- When no mutation observer options are given, `useMutationObserver` defaults to `{ attributes: true }`.
