/**
 * Reactive geolocation.
 *
 * Provides a reactive signal tracking the device's geographic position
 * via the Geolocation API.
 *
 * @module bquery/media
 */

import { signal, readonly } from '../reactive/index';
import type { GeolocationOptions, GeolocationSignal, GeolocationState } from './types';

/** Default geolocation state. */
const DEFAULT_GEO_STATE: GeolocationState = {
  supported: false,
  loading: false,
  latitude: null,
  longitude: null,
  accuracy: null,
  altitude: null,
  altitudeAccuracy: null,
  heading: null,
  speed: null,
  timestamp: null,
  error: null,
};

/**
 * Returns a reactive signal tracking the device's geographic position.
 *
 * Uses the Geolocation API (`navigator.geolocation`) where available.
 * Can operate in one-shot mode (default) or continuous watch mode.
 *
 * @param options - Configuration for the geolocation request
 * @returns A readonly reactive signal with position data and loading/error state,
 * plus a `destroy()` method to stop an active watcher
 *
 * @example
 * ```ts
 * import { useGeolocation } from '@bquery/bquery/media';
 * import { effect } from '@bquery/bquery/reactive';
 *
 * // One-shot position
 * const geo = useGeolocation();
 * effect(() => {
 *   if (geo.value.loading) return console.log('Getting position...');
 *   if (geo.value.error) return console.error(geo.value.error);
 *   console.log(`Lat: ${geo.value.latitude}, Lng: ${geo.value.longitude}`);
 * });
 *
 * // Continuous watch with high accuracy
 * const geoWatch = useGeolocation({ watch: true, enableHighAccuracy: true });
 * ```
 */
export const useGeolocation = (options: GeolocationOptions = {}): GeolocationSignal => {
  const { enableHighAccuracy = false, maximumAge = 0, timeout = Infinity, watch = false } = options;

  const s = signal<GeolocationState>({ ...DEFAULT_GEO_STATE });

  let destroyWatcher: (() => void) | undefined;

  if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
    s.value = { ...DEFAULT_GEO_STATE, supported: true, loading: true };

    const posOptions: PositionOptions = {
      enableHighAccuracy,
      maximumAge,
      timeout: timeout === Infinity ? undefined : timeout,
    };

    const onSuccess = (pos: GeolocationPosition): void => {
      s.value = {
        supported: true,
        loading: false,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        altitude: pos.coords.altitude,
        altitudeAccuracy: pos.coords.altitudeAccuracy,
        heading: pos.coords.heading,
        speed: pos.coords.speed,
        timestamp: pos.timestamp,
        error: null,
      };
    };

    const onError = (err: GeolocationPositionError): void => {
      s.value = {
        ...s.value,
        loading: false,
        error: err.message,
      };
    };

    if (watch) {
      const watchId = navigator.geolocation.watchPosition(onSuccess, onError, posOptions);
      destroyWatcher = () => {
        navigator.geolocation.clearWatch(watchId);
      };
    } else {
      navigator.geolocation.getCurrentPosition(onSuccess, onError, posOptions);
    }
  }

  const ro = readonly(s) as unknown as GeolocationSignal;
  let destroyed = false;
  Object.defineProperty(ro, 'destroy', {
    enumerable: false,
    configurable: true,
    value(): void {
      if (destroyed) return;
      destroyed = true;
      destroyWatcher?.();
      s.dispose();
    },
  });

  return ro;
};
