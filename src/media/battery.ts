/**
 * Reactive battery status.
 *
 * Provides a reactive signal tracking the device's battery status
 * via the Battery Status API.
 *
 * @module bquery/media
 */

import { signal, readonly } from '../reactive/index';
import type { ReadonlySignal } from '../reactive/index';
import type { BatteryState } from './types';

/**
 * BatteryManager interface for the Battery Status API.
 * @internal
 */
interface BatteryManager extends EventTarget {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  level: number;
}

/** Default battery state when API is unavailable. */
const DEFAULT_BATTERY_STATE: BatteryState = {
  supported: false,
  charging: false,
  chargingTime: 0,
  dischargingTime: 0,
  level: 1,
};

/**
 * Returns a reactive signal tracking the device's battery status.
 *
 * Uses the Battery Status API (`navigator.getBattery()`) where available.
 * Falls back gracefully to a default state with `supported: false` when
 * the API is not available.
 *
 * @returns A readonly reactive signal with battery state
 *
 * @example
 * ```ts
 * import { useBattery } from '@bquery/bquery/media';
 * import { effect } from '@bquery/bquery/reactive';
 *
 * const battery = useBattery();
 * effect(() => {
 *   if (battery.value.supported) {
 *     console.log(`Battery: ${(battery.value.level * 100).toFixed(0)}%`);
 *     console.log(`Charging: ${battery.value.charging}`);
 *   }
 * });
 * ```
 */
export const useBattery = (): ReadonlySignal<BatteryState> => {
  const s = signal<BatteryState>({ ...DEFAULT_BATTERY_STATE });

  if (
    typeof navigator !== 'undefined' &&
    'getBattery' in navigator &&
    typeof (navigator as Navigator & { getBattery: () => Promise<BatteryManager> }).getBattery === 'function'
  ) {
    const nav = navigator as Navigator & { getBattery: () => Promise<BatteryManager> };

    nav.getBattery().then((battery) => {
      const update = (): void => {
        s.value = {
          supported: true,
          charging: battery.charging,
          chargingTime: battery.chargingTime,
          dischargingTime: battery.dischargingTime,
          level: battery.level,
        };
      };

      update();

      battery.addEventListener('chargingchange', update);
      battery.addEventListener('chargingtimechange', update);
      battery.addEventListener('dischargingtimechange', update);
      battery.addEventListener('levelchange', update);
    }).catch(() => {
      // Battery API rejected — keep default state
    });
  }

  return readonly(s);
};
