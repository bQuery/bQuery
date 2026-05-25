/**
 * Reactive helpers tracking navigator/window-level browser state (1.14+):
 * preferred language(s), online status, page visibility, document/window focus,
 * idle, share/wake-lock/permission helpers, and broadcast channels.
 *
 * @module bquery/media
 */

import { createMediaSignal, createWritableMediaSignal, hasDom, type AbortableOptions } from './internal';
import type { MediaSignalHandle } from './types';

// ---------------------------------------------------------------------------
// Language
// ---------------------------------------------------------------------------

/**
 * Reactive signal tracking `navigator.language`.
 *
 * Updates when the browser fires the `languagechange` event.
 */
export const usePreferredLanguage = (
  options?: AbortableOptions
): MediaSignalHandle<string> => {
  const read = (): string =>
    typeof navigator !== 'undefined' && typeof navigator.language === 'string'
      ? navigator.language
      : 'en';

  return createMediaSignal<string>(
    read(),
    (set) => {
      const handler = (): void => set(read());
      window.addEventListener('languagechange', handler);
      return () => window.removeEventListener('languagechange', handler);
    },
    options
  );
};

/**
 * Reactive signal tracking `navigator.languages` as a readonly array.
 */
export const usePreferredLanguages = (
  options?: AbortableOptions
): MediaSignalHandle<readonly string[]> => {
  const read = (): readonly string[] => {
    if (typeof navigator === 'undefined') return ['en'];
    if (Array.isArray(navigator.languages)) return [...navigator.languages];
    if (typeof navigator.language === 'string') return [navigator.language];
    return ['en'];
  };

  return createMediaSignal<readonly string[]>(
    read(),
    (set) => {
      const handler = (): void => set(read());
      window.addEventListener('languagechange', handler);
      return () => window.removeEventListener('languagechange', handler);
    },
    options
  );
};

// ---------------------------------------------------------------------------
// Online status
// ---------------------------------------------------------------------------

/**
 * Reactive boolean tracking `navigator.onLine`.
 *
 * Slimmer alternative to {@link useNetworkStatus} for the common
 * "online vs offline" use case.
 */
export const useOnlineStatus = (options?: AbortableOptions): MediaSignalHandle<boolean> => {
  const read = (): boolean =>
    typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
      ? navigator.onLine
      : true;

  return createMediaSignal<boolean>(
    read(),
    (set) => {
      const update = (): void => set(read());
      window.addEventListener('online', update);
      window.addEventListener('offline', update);
      return () => {
        window.removeEventListener('online', update);
        window.removeEventListener('offline', update);
      };
    },
    options
  );
};

// ---------------------------------------------------------------------------
// Page visibility & focus
// ---------------------------------------------------------------------------

/**
 * Reactive signal tracking `document.visibilityState`.
 */
export const usePageVisibility = (
  options?: AbortableOptions
): MediaSignalHandle<'visible' | 'hidden'> => {
  const read = (): 'visible' | 'hidden' =>
    hasDom() && document.visibilityState === 'hidden' ? 'hidden' : 'visible';

  return createMediaSignal<'visible' | 'hidden'>(
    read(),
    (set) => {
      const handler = (): void => set(read());
      document.addEventListener('visibilitychange', handler);
      return () => document.removeEventListener('visibilitychange', handler);
    },
    options
  );
};

/**
 * Reactive boolean tracking `document.hasFocus()`.
 */
export const useDocumentFocus = (options?: AbortableOptions): MediaSignalHandle<boolean> => {
  const read = (): boolean => (hasDom() && typeof document.hasFocus === 'function' ? document.hasFocus() : true);

  return createMediaSignal<boolean>(
    read(),
    (set) => {
      const focus = (): void => set(true);
      const blur = (): void => set(false);
      window.addEventListener('focus', focus);
      window.addEventListener('blur', blur);
      return () => {
        window.removeEventListener('focus', focus);
        window.removeEventListener('blur', blur);
      };
    },
    options
  );
};

/**
 * Reactive boolean tracking whether the top-level window currently has focus.
 *
 * Equivalent to {@link useDocumentFocus} but named for symmetry with
 * `useWindowFocus()`-style APIs found in other ecosystems.
 */
export const useWindowFocus = useDocumentFocus;

// ---------------------------------------------------------------------------
// Idle
// ---------------------------------------------------------------------------

/**
 * Options for {@link useIdle}.
 */
export interface UseIdleOptions extends AbortableOptions {
  /**
   * Events that reset the idle timer.
   * @default ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel']
   */
  events?: readonly string[];
  /** When `true`, treat `document.visibilityState === 'hidden'` as activity. @default true */
  watchVisibility?: boolean;
  /** Initial value when DOM is unavailable. @default false */
  initial?: boolean;
}

const DEFAULT_IDLE_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'wheel',
] as const;

/**
 * Reactive boolean that becomes `true` when no user input has occurred
 * within `timeoutMs`.
 *
 * @example
 * ```ts
 * const idle = useIdle(60_000);
 * effect(() => idle.value && console.log('User is idle'));
 * ```
 */
export const useIdle = (
  timeoutMs: number,
  options?: UseIdleOptions
): MediaSignalHandle<boolean> => {
  const initial = options?.initial ?? false;
  const events = options?.events ?? DEFAULT_IDLE_EVENTS;
  const watchVisibility = options?.watchVisibility !== false;

  return createMediaSignal<boolean>(
    initial,
    (set) => {
      let timer: ReturnType<typeof setTimeout> | undefined;

      const reset = (): void => {
        if (timer !== undefined) clearTimeout(timer);
        set(false);
        timer = setTimeout(() => set(true), Math.max(0, timeoutMs));
      };

      for (const event of events) {
        window.addEventListener(event, reset, { passive: true });
      }
      if (watchVisibility) {
        document.addEventListener('visibilitychange', reset);
      }
      reset();

      return () => {
        if (timer !== undefined) clearTimeout(timer);
        for (const event of events) window.removeEventListener(event, reset);
        if (watchVisibility) document.removeEventListener('visibilitychange', reset);
      };
    },
    options
  );
};

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

/**
 * Reactive signal tracking a `navigator.permissions.query()` result.
 *
 * Returns `'unsupported'` when the Permissions API is not available.
 */
export const usePermission = (
  name: PermissionName | string,
  options?: AbortableOptions
): MediaSignalHandle<PermissionState | 'unsupported'> => {
  return createMediaSignal<PermissionState | 'unsupported'>(
    'unsupported',
    (set) => {
      const navAny = navigator as Navigator & {
        permissions?: { query: (descriptor: { name: string }) => Promise<PermissionStatus> };
      };
      if (!navAny.permissions || typeof navAny.permissions.query !== 'function') return;

      let status: PermissionStatus | undefined;
      let onChange: (() => void) | undefined;
      let cancelled = false;

      navAny.permissions
        .query({ name: name as string })
        .then((s) => {
          if (cancelled) return;
          status = s;
          set(s.state);
          onChange = (): void => {
            if (status) set(status.state);
          };
          status.addEventListener?.('change', onChange);
        })
        .catch(() => {
          if (!cancelled) set('unsupported');
        });

      return () => {
        cancelled = true;
        if (status && onChange) status.removeEventListener?.('change', onChange);
      };
    },
    options
  );
};

// ---------------------------------------------------------------------------
// Wake Lock
// ---------------------------------------------------------------------------

/**
 * Handle returned by {@link useWakeLock}.
 */
export interface WakeLockHandle {
  /** Reactive signal — `true` while a wake lock is currently held. */
  readonly isActive: MediaSignalHandle<boolean>;
  /** Whether the Screen Wake Lock API is supported in this environment. */
  readonly isSupported: boolean;
  /** Request a wake lock of the given type (default `'screen'`). */
  request(type?: 'screen'): Promise<void>;
  /** Release the currently held wake lock. */
  release(): Promise<void>;
  /** Release and tear down. Idempotent. */
  destroy(): void;
}

interface WakeLockSentinelLike {
  released: boolean;
  release(): Promise<void>;
  addEventListener?: (event: 'release', handler: () => void) => void;
  removeEventListener?: (event: 'release', handler: () => void) => void;
}

interface WakeLockApiLike {
  request(type: 'screen'): Promise<WakeLockSentinelLike>;
}

/**
 * Reactive wrapper over the Screen Wake Lock API.
 */
export const useWakeLock = (options?: AbortableOptions): WakeLockHandle => {
  const nav =
    typeof navigator !== 'undefined'
      ? (navigator as Navigator & { wakeLock?: WakeLockApiLike })
      : undefined;
  const isSupported = !!nav?.wakeLock;

  let sentinel: WakeLockSentinelLike | undefined;
  let onRelease: (() => void) | undefined;
  let abortSignal: AbortSignal | undefined;
  let onAbort: (() => void) | undefined;
  let destroyed = false;

  const active = createWritableMediaSignal<boolean>(false);

  const clearAbortListener = (): void => {
    if (abortSignal && onAbort) {
      abortSignal.removeEventListener('abort', onAbort);
    }
    abortSignal = undefined;
    onAbort = undefined;
  };

  const request = async (type: 'screen' = 'screen'): Promise<void> => {
    if (destroyed) return;
    if (!isSupported || !nav?.wakeLock) {
      throw new Error('bQuery media: Screen Wake Lock API is not supported in this environment.');
    }
    if (sentinel && !sentinel.released) return;
    sentinel = await nav.wakeLock.request(type);
    active.set(true);
    onRelease = (): void => active.set(false);
    sentinel.addEventListener?.('release', onRelease);
  };

  const release = async (): Promise<void> => {
    if (!sentinel) return;
    try {
      if (sentinel.released === false) await sentinel.release();
    } finally {
      active.set(false);
      if (onRelease) sentinel.removeEventListener?.('release', onRelease);
      sentinel = undefined;
      onRelease = undefined;
    }
  };

  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    clearAbortListener();
    void release().catch(() => undefined);
    active.destroy();
  };

  if (options?.signal) {
    abortSignal = options.signal;
    if (abortSignal.aborted) destroy();
    else {
      onAbort = (): void => {
        destroy();
      };
      abortSignal.addEventListener('abort', onAbort, { once: true });
    }
  }

  return {
    isActive: active.handle,
    isSupported,
    request,
    release,
    destroy,
  };
};

// ---------------------------------------------------------------------------
// Share
// ---------------------------------------------------------------------------

/**
 * Whether `navigator.share()` is available.
 */
export const useShareSupported = (): boolean =>
  typeof navigator !== 'undefined' && typeof (navigator as Navigator & { share?: unknown }).share === 'function';

/**
 * Returned shape of {@link useShare}.
 */
export interface ShareHandle {
  readonly isSupported: boolean;
  share(data: ShareData): Promise<boolean>;
}

/**
 * Wrapper around `navigator.share()` that swallows the well-known
 * `AbortError` so consumers can `.then(success => …)`.
 */
export const useShare = (): ShareHandle => ({
  get isSupported() {
    return useShareSupported();
  },
  async share(data: ShareData): Promise<boolean> {
    if (!useShareSupported()) {
      throw new Error('bQuery media: Web Share API is not supported in this environment.');
    }
    try {
      await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share(data);
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return false;
      throw error;
    }
  },
});

// ---------------------------------------------------------------------------
// Broadcast Channel
// ---------------------------------------------------------------------------

/**
 * Reactive Broadcast Channel handle returned by {@link useBroadcastChannel}.
 */
export interface BroadcastChannelHandle<T> {
  /** Reactive signal of the most recently received message, or `null`. */
  readonly data: MediaSignalHandle<T | null>;
  /** Whether the Broadcast Channel API is supported. */
  readonly isSupported: boolean;
  /** Post a message to all other listeners on the same channel name. */
  post(value: T): void;
  /** Close the channel and tear down. Idempotent. */
  close(): void;
}

/**
 * Wraps `new BroadcastChannel(name)` as a reactive `data` signal plus a
 * `post()` helper.
 */
export const useBroadcastChannel = <T>(
  name: string,
  options?: AbortableOptions
): BroadcastChannelHandle<T> => {
  const isSupported = typeof BroadcastChannel !== 'undefined';
  let channel: BroadcastChannel | undefined;
  let onMessage: ((event: MessageEvent) => void) | undefined;

  const data = createMediaSignal<T | null>(
    null,
    (set) => {
      if (!isSupported) return;
      try {
        channel = new BroadcastChannel(name);
        onMessage = (event: MessageEvent): void => set(event.data as T);
        channel.addEventListener('message', onMessage);
      } catch {
        channel = undefined;
      }
      return () => {
        if (channel && onMessage) channel.removeEventListener('message', onMessage);
        channel?.close();
        channel = undefined;
        onMessage = undefined;
      };
    },
    options
  );

  return {
    data,
    isSupported,
    post(value: T): void {
      channel?.postMessage(value);
    },
    close(): void {
      data.destroy();
    },
  };
};

// ---------------------------------------------------------------------------
// Event listener helper
// ---------------------------------------------------------------------------

/**
 * Options for {@link useEventListener}.
 */
export interface UseEventListenerOptions extends AddEventListenerOptions, AbortableOptions {}

/**
 * Registers an event listener and returns a cleanup function. The listener
 * is automatically removed when `options.signal` aborts.
 *
 * @returns A cleanup function. Idempotent.
 *
 * @example
 * ```ts
 * const stop = useEventListener(window, 'resize', () => console.log('resize'));
 * stop();
 * ```
 */
export function useEventListener<K extends keyof WindowEventMap>(
  target: Window,
  event: K,
  handler: (event: WindowEventMap[K]) => void,
  options?: UseEventListenerOptions
): () => void;
export function useEventListener<K extends keyof DocumentEventMap>(
  target: Document,
  event: K,
  handler: (event: DocumentEventMap[K]) => void,
  options?: UseEventListenerOptions
): () => void;
export function useEventListener<K extends keyof HTMLElementEventMap>(
  target: HTMLElement,
  event: K,
  handler: (event: HTMLElementEventMap[K]) => void,
  options?: UseEventListenerOptions
): () => void;
export function useEventListener(
  target: EventTarget,
  event: string,
  handler: EventListenerOrEventListenerObject,
  options?: UseEventListenerOptions
): () => void;
export function useEventListener(
  target: EventTarget,
  event: string,
  handler: EventListenerOrEventListenerObject,
  options?: UseEventListenerOptions
): () => void {
  if (!target || typeof target.addEventListener !== 'function') {
    return () => undefined;
  }
  const { signal: abort, ...listenerOptions } = options ?? {};
  let removed = false;
  let onAbort: (() => void) | undefined;

  target.addEventListener(event, handler, listenerOptions);
  const remove = (): void => {
    if (removed) return;
    removed = true;
    target.removeEventListener(event, handler, listenerOptions);
    if (abort && onAbort) {
      abort.removeEventListener('abort', onAbort);
    }
    onAbort = undefined;
  };

  if (abort) {
    if (abort.aborted) remove();
    else {
      onAbort = (): void => {
        remove();
      };
      abort.addEventListener('abort', onAbort, { once: true });
    }
  }
  return remove;
}

// ---------------------------------------------------------------------------
// Media devices
// ---------------------------------------------------------------------------

/**
 * Reactive list of `MediaDeviceInfo` entries.
 *
 * Updates when the browser fires `devicechange`. Returns an empty array
 * on platforms without `navigator.mediaDevices.enumerateDevices()`.
 */
export const useMediaDevices = (
  options?: AbortableOptions
): MediaSignalHandle<readonly MediaDeviceInfo[]> => {
  return createMediaSignal<readonly MediaDeviceInfo[]>(
    [],
    (set) => {
      const md = (navigator as Navigator & { mediaDevices?: MediaDevices }).mediaDevices;
      if (!md || typeof md.enumerateDevices !== 'function') return;

      let cancelled = false;
      const refresh = (): void => {
        md.enumerateDevices()
          .then((list) => {
            if (!cancelled) set(list);
          })
          .catch(() => {
            if (!cancelled) set([]);
          });
      };
      refresh();
      md.addEventListener?.('devicechange', refresh);
      return () => {
        cancelled = true;
        md.removeEventListener?.('devicechange', refresh);
      };
    },
    options
  );
};

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

/**
 * Options for {@link useStorage}.
 */
export interface UseStorageOptions<T> extends AbortableOptions {
  /** Which web storage to use. @default 'local' */
  storage?: 'local' | 'session';
  /** Custom serializer. @default JSON.stringify */
  serialize?: (value: T) => string;
  /** Custom deserializer. @default JSON.parse */
  deserialize?: (raw: string) => T;
  /** Sync across tabs via the `storage` event. @default true (local only) */
  syncTabs?: boolean;
}

/**
 * Reactive storage handle.
 */
export interface StorageHandle<T> {
  readonly value: MediaSignalHandle<T>;
  set(value: T): void;
  remove(): void;
  destroy(): void;
}

const getStorageArea = (kind: 'local' | 'session'): Storage | undefined => {
  if (typeof window === 'undefined') return undefined;
  try {
    return kind === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return undefined;
  }
};

/**
 * Reactive wrapper around `localStorage` / `sessionStorage` that
 * synchronises across browser tabs via the `storage` event.
 */
export const useStorage = <T>(
  key: string,
  defaultValue: T,
  options: UseStorageOptions<T> = {}
): StorageHandle<T> => {
  const storageKind = options.storage ?? 'local';
  const serialize = options.serialize ?? ((value: T): string => JSON.stringify(value));
  const deserialize =
    options.deserialize ?? ((raw: string): T => JSON.parse(raw) as T);
  const syncTabs = options.syncTabs !== false && storageKind === 'local';

  const area = getStorageArea(storageKind);

  const read = (): T => {
    if (!area) return defaultValue;
    try {
      const raw = area.getItem(key);
      if (raw === null) return defaultValue;
      return deserialize(raw);
    } catch {
      return defaultValue;
    }
  };

  const writable = createWritableMediaSignal<T>(
    read(),
    (setSignal) => {
      if (!syncTabs || typeof window === 'undefined') return;
      const listener = (event: StorageEvent): void => {
        if (event.key !== key || event.storageArea !== area) return;
        try {
          setSignal(event.newValue === null ? defaultValue : deserialize(event.newValue));
        } catch {
          setSignal(defaultValue);
        }
      };
      window.addEventListener('storage', listener);
      return () => window.removeEventListener('storage', listener);
    },
    options
  );

  const write = (value: T): void => {
    if (area) {
      try {
        area.setItem(key, serialize(value));
      } catch {
        // Quota exceeded or storage disabled — fall through to in-memory update.
      }
    }
    writable.set(value);
  };

  return {
    value: writable.handle,
    set: write,
    remove(): void {
      if (area) {
        try {
          area.removeItem(key);
        } catch {
          // ignore
        }
      }
      writable.set(defaultValue);
    },
    destroy(): void {
      writable.destroy();
    },
  };
};
