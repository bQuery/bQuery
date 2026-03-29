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
