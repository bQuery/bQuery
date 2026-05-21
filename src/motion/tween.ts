/**
 * Pure JS tweening primitives backed by `requestAnimationFrame`.
 *
 * `animateValue()` and `tween()` interpolate numeric values, arrays of
 * numbers, or plain-object records of numbers between `from` and `to`
 * over a configurable duration with an `EasingFunction` curve. They are
 * deliberately DOM-free and work in any runtime that provides `setTimeout`
 * (a `requestAnimationFrame` polyfill is used automatically when missing).
 *
 * @module bquery/motion
 */

import { linear } from './easing';
import { prefersReducedMotion } from './reduced-motion';
import type { EasingFunction } from './types';

/**
 * A value type supported by `animateValue` / `tween`.
 */
export type TweenValue = number | number[] | Record<string, number>;

/**
 * Options accepted by `animateValue` and `tween`.
 */
export interface TweenOptions<T extends TweenValue> {
  /** Starting value. */
  from: T;
  /** Target value. Must be structurally compatible with `from`. */
  to: T;
  /** Total duration in milliseconds (default: 300). */
  duration?: number;
  /** Easing function (default: `linear`). */
  easing?: EasingFunction;
  /** Delay before starting in milliseconds (default: 0). */
  delay?: number;
  /** Update callback receiving the interpolated value. */
  onUpdate?: (value: T, progress: number) => void;
  /** Completion callback (called once when the tween finishes naturally). */
  onComplete?: (value: T) => void;
  /** Optional `AbortSignal` to cancel the tween early. */
  signal?: AbortSignal;
  /** Whether to respect `prefers-reduced-motion` (default: true). */
  respectReducedMotion?: boolean;
}

/**
 * Imperative controls returned by {@link tween}.
 */
export interface TweenControls<T extends TweenValue> {
  /** Pause the tween. */
  pause(): void;
  /** Resume a paused tween. */
  resume(): void;
  /** Reverse direction. The current value continues smoothly. */
  reverse(): void;
  /** Seek to a specific progress in `[0, 1]`. Triggers an `onUpdate`. */
  seek(progress: number): void;
  /** Stop and cancel the tween (does not call `onComplete`). */
  stop(): void;
  /** Current interpolated value. */
  current(): T;
  /** Progress in `[0, 1]`. */
  progress(): number;
  /** Promise resolving when the tween finishes or is stopped. */
  finished: Promise<T>;
}

const isNumberArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((v) => typeof v === 'number');

const isNumberRecord = (value: unknown): value is Record<string, number> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null) &&
  Object.values(value as Record<string, unknown>).every((v) => typeof v === 'number');

/**
 * Determine the interpolation strategy once and return a per-frame function
 * that avoids re-checking types on every animation frame.
 * @internal
 */
function createFrameInterpolator<T extends TweenValue>(from: T, to: T): (t: number) => T {
  if (typeof from === 'number' && typeof to === 'number') {
    const a = from as number;
    const b = to as number;
    return (t: number) => (a + (b - a) * t) as T;
  }
  if (isNumberArray(from) && isNumberArray(to)) {
    if (from.length !== to.length) {
      throw new RangeError('"from" and "to" arrays must have the same length');
    }
    const len = from.length;
    const fromArr = from as number[];
    const toArr = to as number[];
    return (t: number) => {
      const out: number[] = new Array(len);
      for (let i = 0; i < len; i += 1) {
        out[i] = fromArr[i] + (toArr[i] - fromArr[i]) * t;
      }
      return out as T;
    };
  }
  if (isNumberRecord(from) && isNumberRecord(to)) {
    const fromRec = from as Record<string, number>;
    const toRec = to as Record<string, number>;
    const allKeys = Array.from(new Set([...Object.keys(fromRec), ...Object.keys(toRec)]));
    const pairs = allKeys.map((key) => ({
      key,
      a: key in fromRec ? fromRec[key] : toRec[key],
      b: key in toRec ? toRec[key] : fromRec[key],
    }));
    return (t: number) => {
      const out: Record<string, number> = {};
      for (const { key, a, b } of pairs) {
        out[key] = a + (b - a) * t;
      }
      return out as T;
    };
  }
  throw new TypeError(
    '"from" and "to" must be numbers, number[], or Record<string, number>'
  );
}

const safeRaf = (): ((cb: (time: number) => void) => number) => {
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame;
  return (cb: (time: number) => void) => setTimeout(() => cb(Date.now()), 16) as unknown as number;
};

const safeCaf = (): ((handle: number) => void) => {
  if (typeof cancelAnimationFrame === 'function') return cancelAnimationFrame;
  return (handle: number) => clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
};

/**
 * Tween any numeric structure between `from` and `to`. Returns a promise
 * that resolves with the final value when the animation completes
 * naturally, or skips the animation and resolves to `to` (after any
 * configured delay) when reduced motion is preferred.
 *
 * For full imperative controls (pause/resume/reverse/seek), use
 * {@link tween} instead.
 *
 * @example
 * ```ts
 * await animateValue({
 *   from: 0,
 *   to: 100,
 *   duration: 500,
 *   onUpdate: (v) => (counter.textContent = String(Math.round(v))),
 * });
 * ```
 */
export function animateValue<T extends TweenValue>(options: TweenOptions<T>): Promise<T> {
  return tween(options).finished;
}

/**
 * Create a tween with full imperative controls. The animation starts
 * automatically; call `.pause()` to halt or `.stop()` to cancel.
 *
 * @example
 * ```ts
 * const t = tween({
 *   from: { x: 0, y: 0 },
 *   to: { x: 100, y: 50 },
 *   duration: 800,
 *   easing: easeOutCubic,
 *   onUpdate: ({ x, y }) => el.style.transform = `translate(${x}px, ${y}px)`,
 * });
 * t.pause();
 * t.resume();
 * await t.finished;
 * ```
 */
export function tween<T extends TweenValue>(options: TweenOptions<T>): TweenControls<T> {
  const {
    from,
    to,
    duration = 300,
    easing = linear,
    delay = 0,
    onUpdate,
    onComplete,
    signal,
    respectReducedMotion = true,
  } = options;

  const raf = safeRaf();
  const caf = safeCaf();
  const totalDuration = Math.max(0, duration);
  const frameInterpolator = createFrameInterpolator(from, to);

  let currentValue: T = from;
  let progressValue = 0;
  let direction: 1 | -1 = 1;
  let elapsed = 0;
  let startTimestamp: number | null = null;
  let frameId: number | null = null;
  let delayTimer: ReturnType<typeof setTimeout> | null = null;
  let paused = false;
  let stopped = false;
  let finalized = false;
  let abortHandler: (() => void) | null = null;
  let resolveFinished!: (value: T) => void;

  const finished = new Promise<T>((resolve) => {
    resolveFinished = resolve;
  });

  const update = (p: number, complete: boolean) => {
    progressValue = p;
    currentValue = frameInterpolator(easing(p));
    onUpdate?.(currentValue, p);
    if (complete && !finalized) {
      finalized = true;
      if (abortHandler) {
        signal?.removeEventListener('abort', abortHandler);
        abortHandler = null;
      }
      onComplete?.(currentValue);
      resolveFinished(currentValue);
    }
  };

  const cancelTimers = () => {
    if (frameId !== null) {
      caf(frameId);
      frameId = null;
    }
    if (delayTimer !== null) {
      clearTimeout(delayTimer);
      delayTimer = null;
    }
  };

  const finalize = (value: T) => {
    if (finalized) return;
    finalized = true;
    cancelTimers();
    if (abortHandler) {
      signal?.removeEventListener('abort', abortHandler);
      abortHandler = null;
    }
    resolveFinished(value);
  };

  const step = (timestamp: number) => {
    if (stopped || paused) return;
    if (startTimestamp === null) startTimestamp = timestamp;
    const frameElapsed = timestamp - startTimestamp;
    startTimestamp = timestamp;
    elapsed += frameElapsed * direction;
    if (totalDuration <= 0) {
      const targetProgress = direction === 1 ? 1 : 0;
      update(targetProgress, true);
      return;
    }
    const clampedElapsed = Math.min(totalDuration, Math.max(0, elapsed));
    const p = clampedElapsed / totalDuration;
    const reachedEnd =
      (direction === 1 && elapsed >= totalDuration) || (direction === -1 && elapsed <= 0);
    update(Math.min(1, Math.max(0, p)), reachedEnd);
    if (!reachedEnd) {
      frameId = raf(step);
    }
  };

  const start = () => {
    if (stopped) return;
    if (respectReducedMotion && prefersReducedMotion()) {
      update(direction === 1 ? 1 : 0, true);
      return;
    }
    startTimestamp = null;
    frameId = raf(step);
  };

  if (signal) {
    if (signal.aborted) {
      finalize(currentValue);
    } else {
      abortHandler = () => {
        stopped = true;
        cancelTimers();
        finalize(currentValue);
      };
      signal.addEventListener('abort', abortHandler, { once: true });
    }
  }

  if (!stopped && !finalized) {
    if (delay > 0) {
      delayTimer = setTimeout(() => {
        delayTimer = null;
        start();
      }, delay);
    } else {
      start();
    }
  }

  return {
    pause(): void {
      if (paused || stopped || finalized) return;
      paused = true;
      cancelTimers();
    },
    resume(): void {
      if (!paused || stopped || finalized) return;
      paused = false;
      startTimestamp = null;
      frameId = raf(step);
    },
    reverse(): void {
      if (stopped || finalized) return;
      direction = direction === 1 ? -1 : 1;
      // Ensure the resumed frame uses the latest elapsed-into-direction.
      startTimestamp = null;
      if (!paused && frameId === null && delayTimer === null) {
        frameId = raf(step);
      }
    },
    seek(p: number): void {
      if (stopped || finalized) return;
      const clamped = Math.min(1, Math.max(0, p));
      elapsed = clamped * totalDuration;
      const complete =
        (direction === 1 && clamped >= 1) || (direction === -1 && clamped <= 0);
      update(clamped, complete);
    },
    stop(): void {
      if (stopped || finalized) return;
      stopped = true;
      cancelTimers();
      finalize(currentValue);
    },
    current(): T {
      return currentValue;
    },
    progress(): number {
      return progressValue;
    },
    finished,
  };
}
