/**
 * Micro-interaction effects: magnetic, tilt, shake, pulse, countUp.
 *
 * All effects respect `prefers-reduced-motion` by default and degrade
 * gracefully when DOM/animation APIs are unavailable.
 *
 * @module bquery/motion
 */

import { animateValue } from './tween';
import { easeOutCubic } from './easing';
import { prefersReducedMotion } from './reduced-motion';
import type { EasingFunction } from './types';

/** Cleanup function for stateful effects like {@link magnetic} and {@link tilt}. */
export type EffectCleanup = () => void;

/**
 * Options for {@link magnetic}.
 */
export interface MagneticOptions {
  /** Pull strength (0..1, default 0.3). */
  strength?: number;
  /** Pixel radius for pointer attraction (default 80). */
  radius?: number;
  /** Whether to respect prefers-reduced-motion (default true). */
  respectReducedMotion?: boolean;
}

const matrixTranslate = (x: number, y: number) => `translate3d(${x}px, ${y}px, 0)`;

const safeRaf = (): ((cb: (time: number) => void) => number) => {
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame;
  return (cb: (time: number) => void) => setTimeout(() => cb(Date.now()), 16) as unknown as number;
};

const safeCaf = (): ((handle: number) => void) => {
  if (typeof cancelAnimationFrame === 'function') return cancelAnimationFrame;
  return (handle: number) => clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
};

/**
 * Apply a pointer-following micro-interaction to an element. The element
 * is translated toward the pointer when it is within `radius` pixels of
 * the element's center.
 *
 * @returns Cleanup function that detaches listeners and resets transforms.
 */
export const magnetic = (element: Element, options: MagneticOptions = {}): EffectCleanup => {
  const { strength = 0.3, radius = 80, respectReducedMotion = true } = options;
  if (respectReducedMotion && prefersReducedMotion()) return () => {};
  if (typeof window === 'undefined') return () => {};

  const el = element as HTMLElement;
  const originalTransform = el.style.transform;
  const baseTransform = originalTransform.trim() === 'none' ? '' : originalTransform;

  const raf = safeRaf();
  const caf = safeCaf();
  let rafId: number | undefined;
  let lastClientX = 0;
  let lastClientY = 0;

  const onMove = (event: PointerEvent | MouseEvent) => {
    lastClientX = event.clientX;
    lastClientY = event.clientY;
    if (rafId !== undefined) return;
    rafId = raf(() => {
      rafId = undefined;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = lastClientX - cx;
      const dy = lastClientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius) {
        el.style.transform = originalTransform;
        return;
      }
      const pull = (1 - dist / radius) * strength;
      el.style.transform = `${baseTransform} ${matrixTranslate(dx * pull, dy * pull)}`.trim();
    });
  };

  const onLeave = () => {
    if (rafId !== undefined) {
      caf(rafId);
      rafId = undefined;
    }
    el.style.transform = originalTransform;
  };

  window.addEventListener('pointermove', onMove, { passive: true });
  el.addEventListener('pointerleave', onLeave);

  return () => {
    if (rafId !== undefined) {
      caf(rafId);
      rafId = undefined;
    }
    window.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerleave', onLeave);
    el.style.transform = originalTransform;
  };
};

/**
 * Options for {@link tilt}.
 */
export interface TiltOptions {
  /** Maximum tilt angle in degrees (default 15). */
  max?: number;
  /** Perspective in pixels for the CSS `perspective()` (default 800). */
  perspective?: number;
  /** Scale applied on hover (default 1). */
  scale?: number;
  /** Whether to respect prefers-reduced-motion (default true). */
  respectReducedMotion?: boolean;
}

/**
 * Apply a 3D pointer-driven tilt effect to an element. The element rotates
 * around its X/Y axes toward the pointer position relative to its center.
 *
 * @returns Cleanup function that detaches listeners and resets transforms.
 */
export const tilt = (element: Element, options: TiltOptions = {}): EffectCleanup => {
  const { max = 15, perspective = 800, scale = 1, respectReducedMotion = true } = options;
  if (respectReducedMotion && prefersReducedMotion()) return () => {};

  const el = element as HTMLElement;
  const originalTransform = el.style.transform;
  const originalTransition = el.style.transition;
  let restoreTransitionTimeout: ReturnType<typeof setTimeout> | undefined;
  const raf = safeRaf();
  const caf = safeCaf();
  let rafId: number | undefined;
  let lastClientX = 0;
  let lastClientY = 0;

  const clearRestoreTransitionTimeout = () => {
    if (restoreTransitionTimeout !== undefined) {
      clearTimeout(restoreTransitionTimeout);
      restoreTransitionTimeout = undefined;
    }
  };

  const onMove = (event: PointerEvent | MouseEvent) => {
    lastClientX = event.clientX;
    lastClientY = event.clientY;
    if (rafId !== undefined) return;
    rafId = raf(() => {
      rafId = undefined;
      clearRestoreTransitionTimeout();
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const px = (lastClientX - rect.left) / rect.width;
      const py = (lastClientY - rect.top) / rect.height;
      const rx = (0.5 - py) * 2 * max;
      const ry = (px - 0.5) * 2 * max;
      el.style.transition = '';
      el.style.transform = `perspective(${perspective}px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${scale})`;
    });
  };

  const onLeave = () => {
    if (rafId !== undefined) {
      caf(rafId);
      rafId = undefined;
    }
    clearRestoreTransitionTimeout();
    el.style.transition = originalTransition
      ? `${originalTransition}, transform 200ms ease-out`
      : 'transform 200ms ease-out';
    el.style.transform = originalTransform;
    restoreTransitionTimeout = setTimeout(() => {
      el.style.transition = originalTransition;
      restoreTransitionTimeout = undefined;
    }, 200);
  };

  el.addEventListener('pointermove', onMove, { passive: true });
  el.addEventListener('pointerleave', onLeave);

  return () => {
    if (rafId !== undefined) {
      caf(rafId);
      rafId = undefined;
    }
    clearRestoreTransitionTimeout();
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerleave', onLeave);
    el.style.transform = originalTransform;
    el.style.transition = originalTransition;
  };
};

/**
 * Options for {@link shake}.
 */
export interface ShakeOptions {
  /** Total duration in milliseconds (default 400). */
  duration?: number;
  /** Maximum displacement in pixels (default 8). */
  intensity?: number;
  /** Direction of shake (default 'horizontal'). */
  direction?: 'horizontal' | 'vertical' | 'both';
  /** Whether to respect prefers-reduced-motion (default true). */
  respectReducedMotion?: boolean;
}

/**
 * Quick attention-grabbing shake animation. Returns a Promise that resolves
 * when the animation completes (or immediately when reduced motion is active).
 */
export const shake = (element: Element, options: ShakeOptions = {}): Promise<void> => {
  const {
    duration = 400,
    intensity = 8,
    direction = 'horizontal',
    respectReducedMotion = true,
  } = options;
  if (respectReducedMotion && prefersReducedMotion()) return Promise.resolve();
  const el = element as HTMLElement;
  if (typeof el.animate !== 'function') return Promise.resolve();

  const offsets = [0, -1, 0.9, -0.7, 0.5, -0.3, 0.2, 0];
  const buildTransform = (factor: number) => {
    const x = direction === 'vertical' ? 0 : factor * intensity;
    const y = direction === 'horizontal' ? 0 : factor * intensity;
    return matrixTranslate(x, y);
  };
  const keyframes: Keyframe[] = offsets.map((f) => ({ transform: buildTransform(f) }));

  return new Promise((resolve) => {
    const anim = el.animate(keyframes, { duration, easing: 'ease-in-out' });
    const finish = () => resolve();
    anim.onfinish = finish;
    if (anim.finished) anim.finished.then(finish).catch(finish);
  });
};

/**
 * Options for {@link pulse}.
 */
export interface PulseOptions {
  /** Single-pulse duration in milliseconds (default 500). */
  duration?: number;
  /** Peak scale factor at the pulse apex (default 1.08). */
  scale?: number;
  /** Number of pulses (default 1). */
  iterations?: number;
  /** Whether to respect prefers-reduced-motion (default true). */
  respectReducedMotion?: boolean;
}

/**
 * Pulse/heartbeat animation using a scale-up, scale-down cycle. Returns a
 * Promise that resolves when all iterations complete.
 */
export const pulse = (element: Element, options: PulseOptions = {}): Promise<void> => {
  const { duration = 500, scale = 1.08, iterations = 1, respectReducedMotion = true } = options;
  if (respectReducedMotion && prefersReducedMotion()) return Promise.resolve();
  const el = element as HTMLElement;
  if (typeof el.animate !== 'function') return Promise.resolve();

  const keyframes: Keyframe[] = [
    { transform: 'scale(1)' },
    { transform: `scale(${scale})` },
    { transform: 'scale(1)' },
  ];

  return new Promise((resolve) => {
    const anim = el.animate(keyframes, {
      duration,
      iterations: Math.max(1, iterations),
      easing: 'ease-in-out',
    });
    const finish = () => resolve();
    anim.onfinish = finish;
    if (anim.finished) anim.finished.then(finish).catch(finish);
  });
};

/**
 * Options for {@link countUp}.
 */
export interface CountUpOptions {
  /** Total duration in milliseconds (default 1000). */
  duration?: number;
  /** Easing curve (default `easeOutCubic`). */
  easing?: EasingFunction;
  /**
   * Number of decimal places to render. If omitted, integer rendering is
   * used when both `from` and `to` are integers; otherwise two decimals.
   */
  decimals?: number;
  /** Custom formatter — overrides `decimals` when provided. */
  format?: (value: number) => string;
  /** Optional prefix appended before the value. */
  prefix?: string;
  /** Optional suffix appended after the value. */
  suffix?: string;
  /** Whether to respect prefers-reduced-motion (default true). */
  respectReducedMotion?: boolean;
  /** Optional `AbortSignal` for cancellation. */
  signal?: AbortSignal;
}

/**
 * Animated numeric counter. Writes the interpolated value into
 * `element.textContent` on every frame, optionally prefixed/suffixed/formatted.
 */
export const countUp = (
  element: Element,
  from: number,
  to: number,
  options: CountUpOptions = {}
): Promise<void> => {
  const {
    duration = 1000,
    easing = easeOutCubic,
    decimals,
    format,
    prefix = '',
    suffix = '',
    respectReducedMotion = true,
    signal,
  } = options;

  const isInteger = Number.isInteger(from) && Number.isInteger(to);
  const normalizedDecimals =
    decimals === undefined
      ? undefined
      : Number.isFinite(decimals)
        ? Math.min(100, Math.max(0, Math.trunc(decimals)))
        : undefined;
  const places = normalizedDecimals ?? (isInteger ? 0 : 2);
  const formatter = format ?? ((value: number) => value.toFixed(places));
  const write = (value: number) => {
    element.textContent = `${prefix}${formatter(value)}${suffix}`;
  };

  if (respectReducedMotion && prefersReducedMotion()) {
    write(to);
    return Promise.resolve();
  }

  return animateValue<number>({
    from,
    to,
    duration,
    easing,
    onUpdate: write,
    signal,
    respectReducedMotion: false,
  }).then(() => undefined);
};
