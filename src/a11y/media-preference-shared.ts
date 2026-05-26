import { readonly, signal, type ReadonlySignal } from '../reactive/index';
import type { MediaPreferenceSignal } from './types';

type LegacyMediaQueryList = MediaQueryList & {
  addListener?: (listener: (event: MediaQueryListEvent | MediaQueryList) => void) => void;
  removeListener?: (listener: (event: MediaQueryListEvent | MediaQueryList) => void) => void;
};

export const bindMediaQueryListener = (
  mql: MediaQueryList,
  handler: (event: MediaQueryListEvent | MediaQueryList) => void
): (() => void) | undefined => {
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', handler);
    return (): void => {
      mql.removeEventListener('change', handler);
    };
  }

  const legacyMql = mql as LegacyMediaQueryList;
  if (typeof legacyMql.addListener === 'function') {
    legacyMql.addListener(handler);
    return (): void => {
      legacyMql.removeListener?.(handler);
    };
  }

  return undefined;
};

export const withDestroy = <T>(
  signalHandle: ReadonlySignal<T>,
  cleanup: () => void
): MediaPreferenceSignal<T> => {
  let destroyImpl = cleanup;
  const handle = signalHandle as MediaPreferenceSignal<T>;
  Object.defineProperty(handle, 'destroy', {
    configurable: true,
    enumerable: false,
    value: (): void => {
      const currentDestroy = destroyImpl;
      destroyImpl = (): void => {};
      currentDestroy();
    },
  });
  return handle;
};

export const createMediaSignal = (
  query: string,
  initialValue: boolean
): MediaPreferenceSignal<boolean> => {
  const s = signal(initialValue);
  let destroy = (): void => {
    s.dispose();
  };

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      const mql = window.matchMedia(query);
      s.value = mql.matches;

      const handler = (e: MediaQueryListEvent | MediaQueryList): void => {
        s.value = e.matches;
      };

      const cleanupMql = bindMediaQueryListener(mql, handler);
      if (cleanupMql) {
        destroy = (): void => {
          cleanupMql();
          s.dispose();
        };
      }
    } catch {
      // matchMedia may throw in non-browser environments
    }
  }

  return withDestroy(readonly(s), destroy);
};
