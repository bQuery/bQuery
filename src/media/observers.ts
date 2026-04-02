/**
 * Reactive wrappers for browser Observer APIs.
 *
 * Provides composables for IntersectionObserver, ResizeObserver, and
 * MutationObserver that expose reactive signals updated on every callback.
 *
 * @module bquery/media
 */

import { readonly, signal } from '../reactive/index';
import type {
  IntersectionObserverOptions,
  IntersectionObserverSignal,
  IntersectionObserverState,
  MutationObserverOptions,
  MutationObserverSignal,
  MutationObserverState,
  ResizeObserverOptions,
  ResizeObserverSignal,
  ResizeObserverState,
} from './types';

type ResizeObserverBoxSizeLike = {
  inlineSize: number;
  blockSize: number;
};

const getResizeDimensions = (
  entry: ResizeObserverEntry,
  box: ResizeObserverBoxOptions
): Pick<ResizeObserverState, 'width' | 'height'> => {
  let boxSize:
    | ResizeObserverBoxSizeLike
    | readonly ResizeObserverBoxSizeLike[]
    | undefined;

  if (box === 'border-box') {
    boxSize = entry.borderBoxSize;
  } else if (box === 'device-pixel-content-box') {
    boxSize = (
      entry as ResizeObserverEntry & {
        devicePixelContentBoxSize?:
          | ResizeObserverBoxSizeLike
          | readonly ResizeObserverBoxSizeLike[];
      }
    ).devicePixelContentBoxSize;
  } else {
    boxSize = entry.contentBoxSize;
  }

  const resolvedBoxSize = Array.isArray(boxSize) ? boxSize[0] : boxSize;
  if (
    resolvedBoxSize &&
    typeof resolvedBoxSize.inlineSize === 'number' &&
    typeof resolvedBoxSize.blockSize === 'number'
  ) {
    return {
      width: resolvedBoxSize.inlineSize,
      height: resolvedBoxSize.blockSize,
    };
  }

  return {
    width: entry.contentRect.width,
    height: entry.contentRect.height,
  };
};

// ─── useIntersectionObserver ────────────────────────────────────────────────

/**
 * Returns a reactive signal tracking element intersection with a root viewport.
 *
 * The returned handle exposes `observe()` / `unobserve()` methods so you can
 * control which elements are watched. If an initial `target` is provided it is
 * observed immediately.
 *
 * @param target  - Optional element or array of elements to observe immediately.
 * @param options - Standard `IntersectionObserver` init options.
 * @returns A readonly reactive signal with intersection state, plus `observe`,
 * `unobserve`, and `destroy` methods.
 *
 * @example
 * ```ts
 * import { useIntersectionObserver } from '@bquery/bquery/media';
 * import { effect } from '@bquery/bquery/reactive';
 *
 * const el = document.querySelector('#lazy-image')!;
 * const io = useIntersectionObserver(el, { threshold: 0.5 });
 *
 * effect(() => {
 *   if (io.value.isIntersecting) {
 *     console.log('Element is 50% visible');
 *   }
 * });
 *
 * // Cleanup when done
 * io.destroy();
 * ```
 */
export const useIntersectionObserver = (
  target?: Element | Element[] | null,
  options?: IntersectionObserverOptions,
): IntersectionObserverSignal => {
  const initial: IntersectionObserverState = {
    isIntersecting: false,
    intersectionRatio: 0,
    entry: null,
  };

  const s = signal<IntersectionObserverState>(initial);
  let observer: IntersectionObserver | undefined;
  let destroyed = false;

  if (typeof window !== 'undefined' && typeof IntersectionObserver !== 'undefined') {
    try {
      observer = new IntersectionObserver(
        (entries: IntersectionObserverEntry[]) => {
          if (destroyed) return;
          const last = entries[entries.length - 1];
          if (last) {
            s.value = {
              isIntersecting: last.isIntersecting,
              intersectionRatio: last.intersectionRatio,
              entry: last,
            };
          }
        },
        {
          root: options?.root ?? null,
          rootMargin: options?.rootMargin ?? '0px',
          threshold: options?.threshold ?? 0,
        },
      );

      // Observe initial targets
      if (target) {
        const targets = Array.isArray(target) ? target : [target];
        for (const el of targets) {
          observer.observe(el);
        }
      }
    } catch {
      if (observer) observer.disconnect();
      observer = undefined;
    }
  }

  const ro = readonly(s) as IntersectionObserverSignal;

  Object.defineProperties(ro, {
    observe: {
      enumerable: false,
      configurable: true,
      value(el: Element): void {
        if (!destroyed) {
          try {
            observer?.observe(el);
          } catch {}
        }
      },
    },
    unobserve: {
      enumerable: false,
      configurable: true,
      value(el: Element): void {
        if (!destroyed) observer?.unobserve(el);
      },
    },
    destroy: {
      enumerable: false,
      configurable: true,
      value(): void {
        if (destroyed) return;
        destroyed = true;
        observer?.disconnect();
        observer = undefined;
        s.dispose();
      },
    },
  });

  return ro;
};

// ─── useResizeObserver ──────────────────────────────────────────────────────

/**
 * Returns a reactive signal tracking the size of observed elements.
 *
 * By default it uses the `content-box`, but you can configure the observed box
 * via the underlying `ResizeObserver` options (e.g. `{ box: 'border-box' }`).
 *
 * The returned handle exposes `observe()` / `unobserve()` methods. If an
 * initial `target` is provided it is observed immediately.
 *
 * @param target  - Optional element or array of elements to observe immediately.
 * @param options - ResizeObserver options (e.g. `{ box: 'border-box' }`).
 * @returns A readonly reactive signal with `{ width, height, entry }` derived
 * from the configured box, plus `observe`, `unobserve`, and `destroy` methods.
 *
 * @example
 * ```ts
 * import { useResizeObserver } from '@bquery/bquery/media';
 * import { effect } from '@bquery/bquery/reactive';
 *
 * const el = document.querySelector('#panel')!;
 * const size = useResizeObserver(el);
 *
 * effect(() => {
 *   console.log(`Panel size: ${size.value.width}x${size.value.height}`);
 * });
 *
 * size.destroy();
 * ```
 */
export const useResizeObserver = (
  target?: Element | Element[] | null,
  options?: ResizeObserverOptions,
): ResizeObserverSignal => {
  const initial: ResizeObserverState = {
    width: 0,
    height: 0,
    entry: null,
  };

  const s = signal<ResizeObserverState>(initial);
  let observer: ResizeObserver | undefined;
  let destroyed = false;
  const box = options?.box ?? 'content-box';
  const observeOptions = options?.box ? { box: options.box } : undefined;

  if (typeof window !== 'undefined' && typeof ResizeObserver !== 'undefined') {
    try {
      observer = new ResizeObserver((entries: ResizeObserverEntry[]) => {
        if (destroyed) return;
        const last = entries[entries.length - 1];
        if (last) {
          const { width, height } = getResizeDimensions(last, box);
          s.value = {
            width,
            height,
            entry: last,
          };
        }
      });

      // Observe initial targets
      if (target) {
        const targets = Array.isArray(target) ? target : [target];
        for (const el of targets) {
          observer.observe(el, observeOptions);
        }
      }
    } catch {
      if (observer) observer.disconnect();
      observer = undefined;
    }
  }

  const ro = readonly(s) as ResizeObserverSignal;

  Object.defineProperties(ro, {
    observe: {
      enumerable: false,
      configurable: true,
      value(el: Element): void {
        if (!destroyed) {
          try {
            observer?.observe(el, observeOptions);
          } catch {}
        }
      },
    },
    unobserve: {
      enumerable: false,
      configurable: true,
      value(el: Element): void {
        if (!destroyed) observer?.unobserve(el);
      },
    },
    destroy: {
      enumerable: false,
      configurable: true,
      value(): void {
        if (destroyed) return;
        destroyed = true;
        observer?.disconnect();
        observer = undefined;
        s.dispose();
      },
    },
  });

  return ro;
};

// ─── useMutationObserver ────────────────────────────────────────────────────

/**
 * Returns a reactive signal tracking DOM mutations on observed nodes.
 *
 * The returned handle exposes `observe()` and `takeRecords()` for manual
 * lifecycle control. If an initial `target` is provided it is observed
 * immediately.
 *
 * @param target  - Optional node to observe immediately.
 * @param options - MutationObserver init options. Defaults to `{ attributes: true }`.
 * @returns A readonly reactive signal with `{ mutations, count }`, plus
 * `observe`, `takeRecords`, and `destroy` methods.
 *
 * @example
 * ```ts
 * import { useMutationObserver } from '@bquery/bquery/media';
 * import { effect } from '@bquery/bquery/reactive';
 *
 * const el = document.querySelector('#dynamic-content')!;
 * const mo = useMutationObserver(el, { childList: true, subtree: true });
 *
 * effect(() => {
 *   console.log(`${mo.value.count} mutation batches observed`);
 * });
 *
 * mo.destroy();
 * ```
 */
export const useMutationObserver = (
  target?: Node | null,
  options?: MutationObserverOptions,
): MutationObserverSignal => {
  const initial: MutationObserverState = {
    mutations: [],
    count: 0,
  };

  const s = signal<MutationObserverState>(initial);
  let observer: MutationObserver | undefined;
  let destroyed = false;
  let totalCount = 0;

  const resolvedOptions: MutationObserverInit = {
    attributes: options?.attributes ?? true,
    childList: options?.childList ?? false,
    characterData: options?.characterData ?? false,
    subtree: options?.subtree ?? false,
    attributeOldValue: options?.attributeOldValue ?? false,
    characterDataOldValue: options?.characterDataOldValue ?? false,
    ...(options && options.attributeFilter !== undefined
      ? { attributeFilter: options.attributeFilter }
      : {}),
  };

  if (!resolvedOptions.attributes && !resolvedOptions.childList && !resolvedOptions.characterData) {
    resolvedOptions.attributes = true;
  }

  if (!resolvedOptions.attributes) {
    resolvedOptions.attributeOldValue = false;
    delete resolvedOptions.attributeFilter;
  }

  if (!resolvedOptions.characterData) {
    resolvedOptions.characterDataOldValue = false;
  }

  if (typeof window !== 'undefined' && typeof MutationObserver !== 'undefined') {
    try {
      observer = new MutationObserver((mutations: MutationRecord[]) => {
        if (destroyed) return;
        totalCount += 1;
        s.value = {
          mutations,
          count: totalCount,
        };
      });

      if (target) {
        observer.observe(target, resolvedOptions);
      }
    } catch {
      if (observer) observer.disconnect();
      observer = undefined;
    }
  }

  const ro = readonly(s) as MutationObserverSignal;

  Object.defineProperties(ro, {
    observe: {
      enumerable: false,
      configurable: true,
      value(node: Node): void {
        if (!destroyed) {
          try {
            observer?.observe(node, resolvedOptions);
          } catch {}
        }
      },
    },
    takeRecords: {
      enumerable: false,
      configurable: true,
      value(): MutationRecord[] {
        return observer?.takeRecords() ?? [];
      },
    },
    destroy: {
      enumerable: false,
      configurable: true,
      value(): void {
        if (destroyed) return;
        destroyed = true;
        observer?.disconnect();
        observer = undefined;
        s.dispose();
      },
    },
  });

  return ro;
};
