/**
 * Reactive polling composable for periodic data fetching.
 *
 * @module bquery/reactive
 */

import { computed } from './computed';
import { effect } from './effect';
import { signal } from './core';
import { untrack } from './untrack';
import {
  useFetch,
  type AsyncDataState,
  type FetchInput,
  type UseFetchOptions,
} from './async-data';

/** Options for usePolling(). */
export interface UsePollingOptions<TResponse = unknown, TData = TResponse>
  extends UseFetchOptions<TResponse, TData> {
  /** Polling interval in milliseconds. */
  interval: number;
  /** Whether polling is initially enabled (default: true). Can be a reactive getter. */
  enabled?: boolean | (() => boolean);
  /** Pause polling when the document is hidden (default: true). */
  pauseOnHidden?: boolean;
  /** Pause polling when the browser is offline (default: true). */
  pauseOnOffline?: boolean;
}

/** Extended return value from usePolling(). */
export interface PollingState<TData> extends AsyncDataState<TData> {
  /** Pause polling. */
  pause: () => void;
  /** Resume polling. */
  resume: () => void;
  /** Reactive boolean indicating whether polling is currently active. */
  isActive: { readonly value: boolean; peek(): boolean };
}

/**
 * Reactive polling composable that periodically fetches data.
 *
 * @template TResponse - Raw parsed response type
 * @template TData - Stored response type after optional transformation
 * @param input - Request URL, Request object, or lazy input factory
 * @param options - Polling and fetch options
 * @returns Extended fetch state with pause(), resume(), and isActive
 *
 * @example
 * ```ts
 * import { usePolling } from '@bquery/bquery/reactive';
 *
 * const notifications = usePolling<Notification[]>('/api/notifications', {
 *   interval: 30_000,
 *   pauseOnHidden: true,
 *   pauseOnOffline: true,
 * });
 *
 * // Manually pause/resume
 * notifications.pause();
 * notifications.resume();
 * ```
 */
export const usePolling = <TResponse = unknown, TData = TResponse>(
  input: FetchInput,
  options: UsePollingOptions<TResponse, TData>
): PollingState<TData> => {
  const {
    interval,
    enabled: enabledOption = true,
    pauseOnHidden = true,
    pauseOnOffline = true,
    immediate = true,
    ...fetchOptions
  } = options;

  const manuallyPaused = signal(false);
  const documentHidden = signal(false);
  const browserOffline = signal(false);

  const enabledGetter =
    typeof enabledOption === 'function' ? enabledOption : () => enabledOption;

  const isActive = computed(
    () =>
      enabledGetter() &&
      !manuallyPaused.value &&
      !(pauseOnHidden && documentHidden.value) &&
      !(pauseOnOffline && browserOffline.value)
  );

  // Create the underlying useFetch with immediate control
  const fetchState = useFetch<TResponse, TData>(input, {
    ...fetchOptions,
    immediate,
  });

  let intervalId: ReturnType<typeof setInterval> | undefined;
  let cleanups: Array<() => void> = [];

  const startPolling = (): void => {
    stopPolling();
    intervalId = setInterval(() => {
      void fetchState.execute();
    }, interval);
  };

  const stopPolling = (): void => {
    if (intervalId !== undefined) {
      clearInterval(intervalId);
      intervalId = undefined;
    }
  };

  // Watch isActive and start/stop polling accordingly
  const stopWatcher = effect(() => {
    const active = isActive.value;
    untrack(() => {
      if (active) {
        startPolling();
      } else {
        stopPolling();
      }
    });
  });

  // Listen for visibility changes
  if (pauseOnHidden && typeof document !== 'undefined') {
    const onVisibilityChange = (): void => {
      documentHidden.value = document.hidden;
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    cleanups.push(() => document.removeEventListener('visibilitychange', onVisibilityChange));
  }

  // Listen for online/offline changes
  if (pauseOnOffline && typeof window !== 'undefined') {
    const onOnline = (): void => {
      browserOffline.value = false;
    };
    const onOffline = (): void => {
      browserOffline.value = true;
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    cleanups.push(() => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    });
    browserOffline.value = typeof navigator !== 'undefined' ? !navigator.onLine : false;
  }

  const originalDispose = fetchState.dispose;

  const dispose = (): void => {
    stopPolling();
    stopWatcher();
    for (const cleanup of cleanups) cleanup();
    cleanups = [];
    originalDispose();
  };

  return {
    ...fetchState,
    pause: () => {
      manuallyPaused.value = true;
    },
    resume: () => {
      manuallyPaused.value = false;
    },
    isActive,
    dispose,
  };
};
