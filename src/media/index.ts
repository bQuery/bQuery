/**
 * bQuery Media module — reactive browser and device API signals.
 *
 * Provides reactive wrappers around browser media queries, viewport,
 * network status, battery, geolocation, device sensors, and clipboard.
 *
 * @module bquery/media
 *
 * @example
 * ```ts
 * import { mediaQuery, breakpoints, useViewport, useNetworkStatus, clipboard } from '@bquery/bquery/media';
 * import { effect } from '@bquery/bquery/reactive';
 *
 * // Reactive media query
 * const isDark = mediaQuery('(prefers-color-scheme: dark)');
 *
 * // Named breakpoints
 * const bp = breakpoints({ sm: 640, md: 768, lg: 1024, xl: 1280 });
 *
 * // Viewport tracking
 * const viewport = useViewport();
 * effect(() => console.log(viewport.value.width));
 *
 * // Network status
 * const net = useNetworkStatus();
 * effect(() => console.log('Online:', net.value.online));
 *
 * // Clipboard
 * await clipboard.write('Hello!');
 * const text = await clipboard.read();
 * ```
 */

// Media query
export { mediaQuery } from './media-query';

// Breakpoints
export { breakpoints } from './breakpoints';

// Viewport
export { useViewport } from './viewport';

// Network
export { useNetworkStatus } from './network';

// Battery
export { useBattery } from './battery';

// Geolocation
export { useGeolocation } from './geolocation';

// Device sensors
export { useDeviceMotion, useDeviceOrientation } from './device-sensors';

// Clipboard
export { clipboard } from './clipboard';

// Types
export type {
  BatterySignal,
  BatteryState,
  BreakpointMap,
  ClipboardAPI,
  DeviceMotionSignal,
  DeviceMotionState,
  DeviceOrientationSignal,
  DeviceOrientationState,
  GeolocationOptions,
  GeolocationSignal,
  GeolocationState,
  MediaSignalHandle,
  NetworkSignal,
  NetworkState,
  ViewportSignal,
  ViewportState,
} from './types';
