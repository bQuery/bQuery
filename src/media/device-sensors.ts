/**
 * Reactive device motion and orientation sensors.
 *
 * Provides reactive signals for accelerometer, gyroscope, and
 * compass data via the DeviceMotion and DeviceOrientation APIs.
 *
 * @module bquery/media
 */

import { signal, readonly } from '../reactive/index';
import type {
  DeviceMotionSignal,
  DeviceMotionState,
  DeviceOrientationSignal,
  DeviceOrientationState,
} from './types';

/** Default device motion state. */
const DEFAULT_MOTION_STATE: DeviceMotionState = {
  acceleration: { x: null, y: null, z: null },
  accelerationIncludingGravity: { x: null, y: null, z: null },
  rotationRate: { alpha: null, beta: null, gamma: null },
  interval: 0,
};

/** Default device orientation state. */
const DEFAULT_ORIENTATION_STATE: DeviceOrientationState = {
  alpha: null,
  beta: null,
  gamma: null,
  absolute: false,
};

/**
 * Returns a reactive signal tracking device motion (accelerometer + gyroscope).
 *
 * Uses the `devicemotion` event to provide acceleration, acceleration
 * including gravity, and rotation rate data.
 *
 * @returns A readonly reactive signal with motion sensor data and a `destroy()`
 * method to remove the underlying event listener
 *
 * @example
 * ```ts
 * import { useDeviceMotion } from '@bquery/bquery/media';
 * import { effect } from '@bquery/bquery/reactive';
 *
 * const motion = useDeviceMotion();
 * effect(() => {
 *   const { acceleration } = motion.value;
 *   console.log(`Acceleration: x=${acceleration.x}, y=${acceleration.y}, z=${acceleration.z}`);
 * });
 * ```
 */
export const useDeviceMotion = (): DeviceMotionSignal => {
  const s = signal<DeviceMotionState>({ ...DEFAULT_MOTION_STATE });
  let cleanup: (() => void) | undefined;

  if (typeof window !== 'undefined') {
    const handler = (e: DeviceMotionEvent): void => {
      s.value = {
        acceleration: {
          x: e.acceleration?.x ?? null,
          y: e.acceleration?.y ?? null,
          z: e.acceleration?.z ?? null,
        },
        accelerationIncludingGravity: {
          x: e.accelerationIncludingGravity?.x ?? null,
          y: e.accelerationIncludingGravity?.y ?? null,
          z: e.accelerationIncludingGravity?.z ?? null,
        },
        rotationRate: {
          alpha: e.rotationRate?.alpha ?? null,
          beta: e.rotationRate?.beta ?? null,
          gamma: e.rotationRate?.gamma ?? null,
        },
        interval: e.interval ?? 0,
      };
    };

    window.addEventListener('devicemotion', handler);
    cleanup = () => {
      window.removeEventListener('devicemotion', handler);
    };
  }

  const ro = readonly(s) as unknown as DeviceMotionSignal;
  let destroyed = false;
  Object.defineProperty(ro, 'destroy', {
    enumerable: false,
    configurable: true,
    value(): void {
      if (destroyed) return;
      destroyed = true;
      cleanup?.();
      s.dispose();
    },
  });

  return ro;
};

/**
 * Returns a reactive signal tracking device orientation (compass/gyroscope).
 *
 * Uses the `deviceorientation` event to provide alpha (compass heading),
 * beta (front-to-back tilt), and gamma (left-to-right tilt) data.
 *
 * @returns A readonly reactive signal with orientation data and a `destroy()`
 * method to remove the underlying event listener
 *
 * @example
 * ```ts
 * import { useDeviceOrientation } from '@bquery/bquery/media';
 * import { effect } from '@bquery/bquery/reactive';
 *
 * const orientation = useDeviceOrientation();
 * effect(() => {
 *   console.log(`Compass heading: ${orientation.value.alpha}°`);
 *   console.log(`Tilt: ${orientation.value.beta}° / ${orientation.value.gamma}°`);
 * });
 * ```
 */
export const useDeviceOrientation = (): DeviceOrientationSignal => {
  const s = signal<DeviceOrientationState>({ ...DEFAULT_ORIENTATION_STATE });
  let cleanup: (() => void) | undefined;

  if (typeof window !== 'undefined') {
    const handler = (e: DeviceOrientationEvent): void => {
      s.value = {
        alpha: e.alpha ?? null,
        beta: e.beta ?? null,
        gamma: e.gamma ?? null,
        absolute: e.absolute ?? false,
      };
    };

    window.addEventListener('deviceorientation', handler);
    cleanup = () => {
      window.removeEventListener('deviceorientation', handler);
    };
  }

  const ro = readonly(s) as unknown as DeviceOrientationSignal;
  let destroyed = false;
  Object.defineProperty(ro, 'destroy', {
    enumerable: false,
    configurable: true,
    value(): void {
      if (destroyed) return;
      destroyed = true;
      cleanup?.();
      s.dispose();
    },
  });

  return ro;
};
