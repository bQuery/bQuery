/**
 * Progressive hydration strategies.
 *
 * Provide thin wrappers around `hydrateMount()` that defer the hydration
 * pass until a chosen trigger fires. They are runtime-safe: in non-browser
 * environments they fall back to immediate hydration (or a no-op) so the
 * same code path can run in tests.
 *
 * @module bquery/ssr
 */

import type { BindingContext, View } from '../view/types';
import { hydrateMount, type HydrateMountOptions } from './hydrate';

const resolveElement = (selector: string | Element): Element | null => {
  if (typeof selector !== 'string') return selector;
  if (typeof document === 'undefined') return null;
  return document.querySelector(selector);
};

const hydrateResolved = (
  selector: string | Element,
  context: BindingContext,
  options: HydrateMountOptions
): View | null => {
  const el = resolveElement(selector);
  if (!el) return null;
  return hydrateMount(el, context, options);
};

const noop = (): void => {};

type LegacyMediaQueryList = MediaQueryList & {
  addListener?: (listener: (event: MediaQueryListEvent | MediaQueryList) => void) => void;
  removeListener?: (listener: (event: MediaQueryListEvent | MediaQueryList) => void) => void;
};

const defer = (cb: () => void): (() => void) => {
  if (typeof window === 'undefined') {
    cb();
    return noop;
  }
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => number })
    .requestIdleCallback;
  if (typeof ric === 'function') {
    const id = ric(cb);
    return () => {
      const cic = (window as unknown as { cancelIdleCallback?: (id: number) => void })
        .cancelIdleCallback;
      if (typeof cic === 'function') cic(id);
    };
  }
  const id = setTimeout(cb, 1);
  return () => clearTimeout(id);
};

/** Common return shape for progressive hydration. */
export interface HydrationHandle {
  /** Cancels pending hydration (no-op if it has already run). */
  cancel(): void;
  /** Resolves with the View once hydration runs, or `null` if cancelled. */
  ready: Promise<View | null>;
}

const buildHandle = (
  trigger: (resolve: () => void) => () => void
): { handle: HydrationHandle; arm: (run: () => View | null) => void } => {
  let cancelled = false;
  let resolveReady: (v: View | null) => void = noop;
  let rejectReady: (e: unknown) => void = noop;
  const ready = new Promise<View | null>((res, rej) => {
    resolveReady = res;
    rejectReady = rej;
  });
  let cleanupTrigger: () => void = noop;

  const arm = (run: () => View | null): void => {
    cleanupTrigger = trigger(() => {
      if (cancelled) return;
      try {
        const view = run();
        resolveReady(view);
      } catch (error) {
        rejectReady(error);
      }
    });
  };

  return {
    handle: {
      ready,
      cancel() {
        if (cancelled) return;
        cancelled = true;
        cleanupTrigger();
        resolveReady(null);
      },
    },
    arm,
  };
};

/**
 * Hydrates the target only once it scrolls into view.
 *
 * Falls back to immediate hydration if `IntersectionObserver` is unavailable.
 */
export const hydrateOnVisible = (
  selector: string | Element,
  context: BindingContext,
  options: HydrateMountOptions & { rootMargin?: string; threshold?: number } = {}
): HydrationHandle => {
  const { rootMargin, threshold, ...mountOptions } = options;
  const { handle, arm } = buildHandle((resolve) => {
    const el = resolveElement(selector);
    if (!el) {
      resolve();
      return noop;
    }
    if (typeof IntersectionObserver === 'undefined') {
      resolve();
      return noop;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            observer.disconnect();
            resolve();
            return;
          }
        }
      },
      { rootMargin: rootMargin ?? '0px', threshold: threshold ?? 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  });

  arm(() => hydrateResolved(selector, context, mountOptions));
  return handle;
};

/** Hydrates when the browser is idle. */
export const hydrateOnIdle = (
  selector: string | Element,
  context: BindingContext,
  options: HydrateMountOptions = {}
): HydrationHandle => {
  const { handle, arm } = buildHandle((resolve) => defer(resolve));
  arm(() => hydrateResolved(selector, context, options));
  return handle;
};

/** Hydrates on first user interaction (click/keydown/pointerdown/touchstart). */
export const hydrateOnInteraction = (
  selector: string | Element,
  context: BindingContext,
  options: HydrateMountOptions & { events?: string[] } = {}
): HydrationHandle => {
  const events = options.events ?? ['pointerdown', 'click', 'keydown', 'touchstart', 'focusin'];
  const { events: _events, ...mountOptions } = options;
  const { handle, arm } = buildHandle((resolve) => {
    const el = resolveElement(selector);
    if (!el) {
      resolve();
      return noop;
    }
    const listener = () => {
      cleanup();
      resolve();
    };
    const cleanup = (): void => {
      for (const evt of events) {
        el.removeEventListener(evt, listener, true);
      }
    };
    for (const evt of events) {
      el.addEventListener(evt, listener, { once: true, capture: true });
    }
    return cleanup;
  });
  arm(() => hydrateResolved(selector, context, mountOptions));
  return handle;
};

/** Hydrates only when a media query matches. */
export const hydrateOnMedia = (
  selector: string | Element,
  context: BindingContext,
  query: string,
  options: HydrateMountOptions = {}
): HydrationHandle => {
  const { handle, arm } = buildHandle((resolve) => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      resolve();
      return noop;
    }
    const mql = window.matchMedia(query);
    if (mql.matches) {
      resolve();
      return noop;
    }
    let cleanup: () => void;
    const listener = (event: MediaQueryListEvent | MediaQueryList): void => {
      if (event.matches) {
        cleanup();
        resolve();
      }
    };
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', listener);
      cleanup = () => mql.removeEventListener('change', listener);
      return cleanup;
    }
    const legacyMql = mql as LegacyMediaQueryList;
    if (
      typeof legacyMql.addListener === 'function' &&
      typeof legacyMql.removeListener === 'function'
    ) {
      legacyMql.addListener(listener);
      cleanup = () => legacyMql.removeListener(listener);
      return cleanup;
    }
    resolve();
    return noop;
  });
  arm(() => hydrateResolved(selector, context, options));
  return handle;
};

/**
 * Hydrates a single SSR island using the same runtime-safe target resolution
 * as the other progressive hydration helpers. Returns `null` when the DOM is
 * unavailable or the target cannot be resolved.
 */
export const hydrateIsland = (
  selector: string | Element,
  context: BindingContext,
  options: HydrateMountOptions = {}
): View | null => hydrateResolved(selector, context, options);
