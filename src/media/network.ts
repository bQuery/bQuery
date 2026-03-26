/**
 * Reactive network status.
 *
 * Provides a reactive signal tracking the browser's network connectivity
 * and connection quality via the Network Information API.
 *
 * @module bquery/media
 */

import { signal, readonly } from '../reactive/index';
import type { NetworkSignal, NetworkState } from './types';

/**
 * Navigator connection interface for the Network Information API.
 * @internal
 */
interface NavigatorConnection extends EventTarget {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

/**
 * Extended Navigator with connection property.
 * @internal
 */
interface NavigatorWithConnection extends Navigator {
  connection?: NavigatorConnection;
}

/**
 * Reads current network state from browser APIs.
 * @internal
 */
const getNetworkState = (): NetworkState => {
  const online =
    typeof navigator !== 'undefined' && navigator.onLine !== undefined
      ? navigator.onLine
      : true;

  const nav = typeof navigator !== 'undefined'
    ? (navigator as NavigatorWithConnection)
    : undefined;
  const conn = nav?.connection;

  return {
    online,
    effectiveType: conn?.effectiveType ?? 'unknown',
    downlink: conn?.downlink ?? 0,
    rtt: conn?.rtt ?? 0,
  };
};

/**
 * Returns a reactive signal tracking network connectivity and quality.
 *
 * Tracks whether the browser is online/offline and, where supported,
 * the effective connection type, downlink speed, and round-trip time
 * via the Network Information API.
 *
 * @returns A readonly reactive signal with `{ online, effectiveType, downlink, rtt }`
 * and a `destroy()` method to remove attached listeners
 *
 * @example
 * ```ts
 * import { useNetworkStatus } from '@bquery/bquery/media';
 * import { effect } from '@bquery/bquery/reactive';
 *
 * const net = useNetworkStatus();
 * effect(() => {
 *   if (!net.value.online) {
 *     console.warn('You are offline!');
 *   }
 *   console.log(`Connection: ${net.value.effectiveType}, RTT: ${net.value.rtt}ms`);
 * });
 * ```
 */
export const useNetworkStatus = (): NetworkSignal => {
  const s = signal<NetworkState>(getNetworkState());
  let cleanup: (() => void) | undefined;

  if (typeof window !== 'undefined') {
    const update = (): void => {
      s.value = getNetworkState();
    };

    window.addEventListener('online', update);
    window.addEventListener('offline', update);

    const nav =
      typeof navigator !== 'undefined'
        ? (navigator as NavigatorWithConnection)
        : undefined;
    if (nav?.connection) {
      nav.connection.addEventListener('change', update);
    }

    cleanup = () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      nav?.connection?.removeEventListener('change', update);
    };
  }

  const ro = readonly(s) as NetworkSignal;
  let destroyed = false;
  ro.destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    cleanup?.();
    s.dispose();
  };

  return ro;
};
