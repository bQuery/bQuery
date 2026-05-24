/**
 * Reactive composables that observe specific DOM targets (1.14+).
 *
 * Includes `useScroll`, `useElementSize`, `useElementBounding`,
 * `useElementVisibility`, `useHover`, `useFocus`, `useFocusWithin`,
 * `useActiveElement`, and `usePointer`.
 *
 * @module bquery/media
 */

import { createMediaSignal, type AbortableOptions } from './internal';
import type { MediaSignalHandle } from './types';

type ScrollTarget = Window | Element | null | undefined;

const getScrollX = (target: ScrollTarget): number => {
  if (!target) return 0;
  if (target === window) return window.scrollX;
  return (target as Element).scrollLeft ?? 0;
};
const getScrollY = (target: ScrollTarget): number => {
  if (!target) return 0;
  if (target === window) return window.scrollY;
  return (target as Element).scrollTop ?? 0;
};
const getScrollSize = (target: ScrollTarget): { sw: number; sh: number; cw: number; ch: number } => {
  if (!target) return { sw: 0, sh: 0, cw: 0, ch: 0 };
  if (target === window) {
    return {
      sw: document.documentElement.scrollWidth,
      sh: document.documentElement.scrollHeight,
      cw: window.innerWidth,
      ch: window.innerHeight,
    };
  }
  const el = target as Element;
  return { sw: el.scrollWidth, sh: el.scrollHeight, cw: el.clientWidth, ch: el.clientHeight };
};

/**
 * State exposed by {@link useScroll}.
 */
export interface ScrollState {
  /** Current horizontal scroll position. */
  x: number;
  /** Current vertical scroll position. */
  y: number;
  /** `1` for right, `-1` for left, `0` when not moving horizontally. */
  directionX: -1 | 0 | 1;
  /** `1` for down, `-1` for up, `0` when not moving vertically. */
  directionY: -1 | 0 | 1;
  /** True while the user is actively scrolling. */
  isScrolling: boolean;
  /** Edge flags — true when the scroll position is at the corresponding edge. */
  arrived: { top: boolean; bottom: boolean; left: boolean; right: boolean };
}

/**
 * Options for {@link useScroll}.
 */
export interface UseScrollOptions extends AbortableOptions {
  /** Milliseconds without scroll events before `isScrolling` resets. @default 100 */
  idleTimeoutMs?: number;
  /** Pixel tolerance for edge detection (`arrived.*`). @default 0 */
  arrivedTolerance?: number;
}

/**
 * Reactive scroll position with direction tracking and edge detection.
 *
 * @param target - Element or `window` (default).
 */
export const useScroll = (
  target: ScrollTarget = typeof window !== 'undefined' ? window : null,
  options: UseScrollOptions = {}
): MediaSignalHandle<ScrollState> => {
  const idleTimeoutMs = options.idleTimeoutMs ?? 100;
  const tolerance = options.arrivedTolerance ?? 0;

  const initial: ScrollState = {
    x: getScrollX(target),
    y: getScrollY(target),
    directionX: 0,
    directionY: 0,
    isScrolling: false,
    arrived: { top: true, bottom: false, left: true, right: false },
  };

  return createMediaSignal<ScrollState>(
    initial,
    (set) => {
      if (!target) return;
      let lastX = initial.x;
      let lastY = initial.y;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const update = (): void => {
        const x = getScrollX(target);
        const y = getScrollY(target);
        const { sw, sh, cw, ch } = getScrollSize(target);

        const dx = x === lastX ? 0 : x > lastX ? 1 : -1;
        const dy = y === lastY ? 0 : y > lastY ? 1 : -1;

        set({
          x,
          y,
          directionX: dx,
          directionY: dy,
          isScrolling: true,
          arrived: {
            top: y <= tolerance,
            bottom: y + ch >= sh - tolerance,
            left: x <= tolerance,
            right: x + cw >= sw - tolerance,
          },
        });

        lastX = x;
        lastY = y;

        if (timer !== undefined) clearTimeout(timer);
        timer = setTimeout(() => {
          set({
            x,
            y,
            directionX: 0,
            directionY: 0,
            isScrolling: false,
            arrived: {
              top: y <= tolerance,
              bottom: y + ch >= sh - tolerance,
              left: x <= tolerance,
              right: x + cw >= sw - tolerance,
            },
          });
        }, idleTimeoutMs);
      };

      (target as EventTarget).addEventListener('scroll', update, { passive: true });
      return () => {
        if (timer !== undefined) clearTimeout(timer);
        (target as EventTarget).removeEventListener('scroll', update);
      };
    },
    options
  );
};

// ---------------------------------------------------------------------------
// Element size & bounding
// ---------------------------------------------------------------------------

/** Result of {@link useElementSize}. */
export interface ElementSize {
  width: number;
  height: number;
}

/**
 * Reactive `{ width, height }` of an element via `ResizeObserver`.
 */
export const useElementSize = (
  el: Element | null | undefined,
  options?: AbortableOptions
): MediaSignalHandle<ElementSize> => {
  const initial: ElementSize = {
    width: el?.getBoundingClientRect().width ?? 0,
    height: el?.getBoundingClientRect().height ?? 0,
  };

  return createMediaSignal<ElementSize>(
    initial,
    (set) => {
      if (!el || typeof ResizeObserver === 'undefined') return;
      const ro = new ResizeObserver((entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        set({ width: entry.contentRect.width, height: entry.contentRect.height });
      });
      ro.observe(el);
      return () => ro.disconnect();
    },
    options
  );
};

/** Result of {@link useElementBounding}. */
export interface ElementBoundingRect {
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
  x: number;
  y: number;
}

const readBounding = (el: Element | null | undefined): ElementBoundingRect => {
  if (!el) return { width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0, x: 0, y: 0 };
  const r = el.getBoundingClientRect();
  return {
    width: r.width,
    height: r.height,
    top: r.top,
    right: r.right,
    bottom: r.bottom,
    left: r.left,
    x: r.x,
    y: r.y,
  };
};

/**
 * Reactive `getBoundingClientRect()` value, updated on scroll, resize, and
 * `ResizeObserver` callbacks.
 */
export const useElementBounding = (
  el: Element | null | undefined,
  options?: AbortableOptions
): MediaSignalHandle<ElementBoundingRect> => {
  return createMediaSignal<ElementBoundingRect>(
    readBounding(el),
    (set) => {
      if (!el) return;
      const update = (): void => set(readBounding(el));

      let ro: ResizeObserver | undefined;
      if (typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(update);
        ro.observe(el);
      }
      window.addEventListener('scroll', update, { passive: true, capture: true });
      window.addEventListener('resize', update, { passive: true });

      return () => {
        ro?.disconnect();
        window.removeEventListener('scroll', update, true);
        window.removeEventListener('resize', update);
      };
    },
    options
  );
};

/**
 * Reactive boolean — `true` when the element is intersecting the viewport.
 */
export const useElementVisibility = (
  el: Element | null | undefined,
  options?: AbortableOptions & { threshold?: number | number[]; rootMargin?: string }
): MediaSignalHandle<boolean> => {
  return createMediaSignal<boolean>(
    false,
    (set) => {
      if (!el || typeof IntersectionObserver === 'undefined') return;
      const io = new IntersectionObserver(
        (entries) => {
          const entry = entries[entries.length - 1];
          if (entry) set(entry.isIntersecting);
        },
        {
          threshold: options?.threshold ?? 0,
          rootMargin: options?.rootMargin ?? '0px',
        }
      );
      io.observe(el);
      return () => io.disconnect();
    },
    options
  );
};

// ---------------------------------------------------------------------------
// Hover / focus
// ---------------------------------------------------------------------------

/**
 * Reactive boolean — true while the pointer is hovering the element.
 */
export const useHover = (
  el: Element | null | undefined,
  options?: AbortableOptions
): MediaSignalHandle<boolean> => {
  return createMediaSignal<boolean>(
    false,
    (set) => {
      if (!el) return;
      const enter = (): void => set(true);
      const leave = (): void => set(false);
      el.addEventListener('mouseenter', enter);
      el.addEventListener('mouseleave', leave);
      return () => {
        el.removeEventListener('mouseenter', enter);
        el.removeEventListener('mouseleave', leave);
      };
    },
    options
  );
};

/**
 * Reactive boolean — true while the element matches `:focus`.
 */
export const useFocus = (
  el: Element | null | undefined,
  options?: AbortableOptions
): MediaSignalHandle<boolean> => {
  return createMediaSignal<boolean>(
    false,
    (set) => {
      if (!el) return;
      const focus = (): void => set(true);
      const blur = (): void => set(false);
      el.addEventListener('focus', focus);
      el.addEventListener('blur', blur);
      // Sync with initial focus state.
      if (typeof document !== 'undefined' && document.activeElement === el) set(true);
      return () => {
        el.removeEventListener('focus', focus);
        el.removeEventListener('blur', blur);
      };
    },
    options
  );
};

/**
 * Reactive boolean — true while the element matches `:focus-within`.
 */
export const useFocusWithin = (
  el: Element | null | undefined,
  options?: AbortableOptions
): MediaSignalHandle<boolean> => {
  return createMediaSignal<boolean>(
    false,
    (set) => {
      if (!el) return;
      const handler = (): void => {
        try {
          set(el.matches(':focus-within'));
        } catch {
          // matches may throw on detached nodes
          set(false);
        }
      };
      el.addEventListener('focusin', handler);
      el.addEventListener('focusout', handler);
      handler();
      return () => {
        el.removeEventListener('focusin', handler);
        el.removeEventListener('focusout', handler);
      };
    },
    options
  );
};

/**
 * Reactive `document.activeElement` reference.
 */
export const useActiveElement = (
  options?: AbortableOptions
): MediaSignalHandle<Element | null> => {
  return createMediaSignal<Element | null>(
    typeof document !== 'undefined' ? document.activeElement : null,
    (set) => {
      const handler = (): void => set(document.activeElement ?? null);
      document.addEventListener('focusin', handler);
      document.addEventListener('focusout', handler);
      return () => {
        document.removeEventListener('focusin', handler);
        document.removeEventListener('focusout', handler);
      };
    },
    options
  );
};

// ---------------------------------------------------------------------------
// Pointer
// ---------------------------------------------------------------------------

/** State exposed by {@link usePointer}. */
export interface PointerState {
  x: number;
  y: number;
  pressure: number;
  type: 'mouse' | 'pen' | 'touch' | 'unknown';
  isInside: boolean;
}

/**
 * Reactive pointer position tracked from `window` `pointermove` /
 * `pointerleave` events. The `isInside` flag toggles based on whether the
 * pointer is over the document.
 */
export const usePointer = (options?: AbortableOptions): MediaSignalHandle<PointerState> => {
  const initial: PointerState = { x: 0, y: 0, pressure: 0, type: 'unknown', isInside: false };

  return createMediaSignal<PointerState>(
    initial,
    (set) => {
      const move = (event: PointerEvent): void => {
        set({
          x: event.clientX,
          y: event.clientY,
          pressure: event.pressure ?? 0,
          type: (event.pointerType as PointerState['type']) || 'unknown',
          isInside: true,
        });
      };
      const leave = (event: PointerEvent): void => {
        set({
          x: event.clientX,
          y: event.clientY,
          pressure: 0,
          type: (event.pointerType as PointerState['type']) || 'unknown',
          isInside: false,
        });
      };
      window.addEventListener('pointermove', move, { passive: true });
      window.addEventListener('pointerleave', leave, { passive: true });
      return () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerleave', leave);
      };
    },
    options
  );
};
