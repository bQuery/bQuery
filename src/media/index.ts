/**
 * bQuery Media module — reactive browser and device API signals.
 *
 * Provides reactive wrappers around browser media queries, viewport,
 * network status, battery, geolocation, device sensors, clipboard,
 * and browser Observer APIs (IntersectionObserver, ResizeObserver,
 * MutationObserver).
 *
 * Targeting **Stable** in 1.15.0: the composable surface is frozen for one
 * minor cycle. Every composable is SSR-safe — on the server it stays at its
 * documented fallback with no listeners attached — and exposes an idempotent
 * `destroy()` (plus `{ signal }` auto-teardown on 1.14+ composables).
 *
 * @module bquery/media
 *
 * @example
 * ```ts
 * import { mediaQuery, breakpoints, useViewport, useNetworkStatus, clipboard, useIntersectionObserver } from '@bquery/bquery/media';
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
 *
 * // Intersection observer
 * const io = useIntersectionObserver(document.querySelector('#el'));
 * effect(() => console.log('Visible:', io.value.isIntersecting));
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
export { clipboard, clipboardText } from './clipboard';

// Observers
export { useIntersectionObserver, useMutationObserver, useResizeObserver } from './observers';

// 1.14+ — User-preference media queries
export {
  usePreferredColorScheme,
  usePreferredContrast,
  usePreferredReducedTransparency,
} from './preferences';

// 1.14+ — Browser & navigator state
export {
  useBroadcastChannel,
  useDocumentFocus,
  useEventListener,
  useIdle,
  useMediaDevices,
  useOnlineStatus,
  usePageVisibility,
  usePermission,
  usePreferredLanguage,
  usePreferredLanguages,
  useShare,
  useShareSupported,
  useStorage,
  useWakeLock,
  useWindowFocus,
} from './browser-state';

// 1.14+ — DOM-target composables
export {
  useActiveElement,
  useElementBounding,
  useElementSize,
  useElementVisibility,
  useFocus,
  useFocusWithin,
  useHover,
  usePointer,
  useScroll,
} from './dom-targets';

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
  IntersectionObserverOptions,
  IntersectionObserverSignal,
  IntersectionObserverState,
  MediaSignalHandle,
  MutationObserverOptions,
  MutationObserverSignal,
  MutationObserverState,
  NetworkSignal,
  NetworkState,
  ResizeObserverOptions,
  ResizeObserverSignal,
  ResizeObserverState,
  ViewportSignal,
  ViewportState,
} from './types';

// 1.14+ — Clipboard text options
export type { ClipboardTextOptions } from './clipboard';

// 1.14+ — Extended types
export type {
  BroadcastChannelHandle,
  ShareHandle,
  StorageHandle,
  UseIdleOptions,
  UseEventListenerOptions,
  UseStorageOptions,
  WakeLockHandle,
} from './browser-state';

export type {
  ElementBoundingRect,
  ElementSize,
  PointerState,
  ScrollState,
  UseScrollOptions,
} from './dom-targets';

export type { AbortableOptions } from './internal';
