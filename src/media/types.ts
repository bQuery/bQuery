/**
 * Type definitions for the bQuery media module.
 *
 * @module bquery/media
 */

import type { ReadonlySignal } from '../reactive/index';

/**
 * Readonly media signal with an explicit cleanup hook.
 *
 * Some media utilities subscribe to browser APIs such as resize events or
 * geolocation watchers. Call `destroy()` when the signal is no longer needed
 * to release those underlying subscriptions.
 */
export interface MediaSignalHandle<T> extends ReadonlySignal<T> {
  /** Releases any underlying browser listeners or observers. Safe to call multiple times. */
  destroy(): void;
}

/**
 * Viewport information returned by {@link useViewport}.
 */
export interface ViewportState {
  /** Current viewport width in pixels. */
  width: number;
  /** Current viewport height in pixels. */
  height: number;
  /** Current orientation: `'portrait'` or `'landscape'`. */
  orientation: 'portrait' | 'landscape';
}

/**
 * Viewport signal handle returned by {@link useViewport}.
 */
export type ViewportSignal = MediaSignalHandle<ViewportState>;

/**
 * Network connection information returned by {@link useNetworkStatus}.
 */
export interface NetworkState {
  /** Whether the browser is online. */
  online: boolean;
  /** Effective connection type (e.g., `'4g'`, `'3g'`, `'2g'`, `'slow-2g'`). */
  effectiveType: string;
  /** Estimated downlink speed in megabits per second. */
  downlink: number;
  /** Estimated round-trip time in milliseconds. */
  rtt: number;
}

/**
 * Network status signal handle returned by {@link useNetworkStatus}.
 */
export type NetworkSignal = MediaSignalHandle<NetworkState>;

/**
 * Battery status information returned by {@link useBattery}.
 */
export interface BatteryState {
  /** Whether the battery API is supported. */
  supported: boolean;
  /** Whether the device is charging. */
  charging: boolean;
  /** Time in seconds until the battery is fully charged, or `Infinity`. */
  chargingTime: number;
  /** Time in seconds until the battery is discharged, or `Infinity`. */
  dischargingTime: number;
  /** Battery level as a value between 0 and 1. */
  level: number;
}

/**
 * Battery signal handle returned by {@link useBattery}.
 */
export type BatterySignal = MediaSignalHandle<BatteryState>;

/**
 * Geolocation state returned by {@link useGeolocation}.
 */
export interface GeolocationState {
  /** Whether the geolocation API is supported. */
  supported: boolean;
  /** Whether position data is being loaded. */
  loading: boolean;
  /** Current latitude, or `null` if unavailable. */
  latitude: number | null;
  /** Current longitude, or `null` if unavailable. */
  longitude: number | null;
  /** Position accuracy in meters, or `null`. */
  accuracy: number | null;
  /** Altitude in meters, or `null`. */
  altitude: number | null;
  /** Altitude accuracy in meters, or `null`. */
  altitudeAccuracy: number | null;
  /** Heading in degrees, or `null`. */
  heading: number | null;
  /** Speed in meters per second, or `null`. */
  speed: number | null;
  /** Timestamp of the position, or `null`. */
  timestamp: number | null;
  /** Error message, or `null` if no error. */
  error: string | null;
}

/**
 * Geolocation signal handle returned by {@link useGeolocation}.
 */
export type GeolocationSignal = MediaSignalHandle<GeolocationState>;

/**
 * Options for {@link useGeolocation}.
 */
export interface GeolocationOptions {
  /** Whether to enable high-accuracy mode. */
  enableHighAccuracy?: boolean;
  /** Maximum age of cached position in milliseconds. */
  maximumAge?: number;
  /** Timeout for position requests in milliseconds. */
  timeout?: number;
  /** Whether to watch for continuous position updates. */
  watch?: boolean;
}

/**
 * Device motion state returned by {@link useDeviceMotion}.
 */
export interface DeviceMotionState {
  /** Acceleration including gravity (x, y, z). */
  acceleration: { x: number | null; y: number | null; z: number | null };
  /** Acceleration including gravity along each axis. */
  accelerationIncludingGravity: { x: number | null; y: number | null; z: number | null };
  /** Rotation rate around each axis in degrees per second. */
  rotationRate: { alpha: number | null; beta: number | null; gamma: number | null };
  /** Interval in milliseconds between data updates. */
  interval: number;
}

/**
 * Device motion signal handle returned by {@link useDeviceMotion}.
 */
export type DeviceMotionSignal = MediaSignalHandle<DeviceMotionState>;

/**
 * Device orientation state returned by {@link useDeviceOrientation}.
 */
export interface DeviceOrientationState {
  /** Rotation around the z-axis (0–360). */
  alpha: number | null;
  /** Rotation around the x-axis (−180–180). */
  beta: number | null;
  /** Rotation around the y-axis (−90–90). */
  gamma: number | null;
  /** Whether the orientation is absolute. */
  absolute: boolean;
}

/**
 * Device orientation signal handle returned by {@link useDeviceOrientation}.
 */
export type DeviceOrientationSignal = MediaSignalHandle<DeviceOrientationState>;

/**
 * Breakpoint definition map.
 * Keys are breakpoint names, values are minimum widths in pixels.
 */
export type BreakpointMap = Record<string, number>;

/**
 * Clipboard API wrapper.
 */
export interface ClipboardAPI {
  /** Read text from the clipboard. */
  read: () => Promise<string>;
  /** Write text to the clipboard. */
  write: (text: string) => Promise<void>;
}
