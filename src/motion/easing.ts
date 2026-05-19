/**
 * Easing helpers.
 *
 * Provides the complete Penner-style easing family (linear, quad, cubic,
 * quart, quint, sine, expo, circ, back, elastic, bounce — each with
 * `In`, `Out`, and `InOut` variants), plus CSS-spec compatible
 * `cubicBezier()` and `steps()` factories and `mix()` / `chain()`
 * composers. All easings return clamped `[0, 1]` outputs.
 *
 * @module bquery/motion
 */

import type { EasingFunction } from './types';

const clamp = (value: number) => Math.min(1, Math.max(0, value));

// ── Linear ──────────────────────────────────────────────────────────────────
export const linear: EasingFunction = (t) => clamp(t);

// ── Quadratic ───────────────────────────────────────────────────────────────
export const easeInQuad: EasingFunction = (t) => clamp(t * t);
export const easeOutQuad: EasingFunction = (t) => clamp(1 - (1 - t) * (1 - t));
export const easeInOutQuad: EasingFunction = (t) =>
  clamp(t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// ── Cubic ───────────────────────────────────────────────────────────────────
export const easeInCubic: EasingFunction = (t) => clamp(t * t * t);
export const easeOutCubic: EasingFunction = (t) => clamp(1 - Math.pow(1 - t, 3));
export const easeInOutCubic: EasingFunction = (t) =>
  clamp(t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ── Quartic ─────────────────────────────────────────────────────────────────
export const easeInQuart: EasingFunction = (t) => clamp(t * t * t * t);
export const easeOutQuart: EasingFunction = (t) => clamp(1 - Math.pow(1 - t, 4));
export const easeInOutQuart: EasingFunction = (t) =>
  clamp(t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2);

// ── Quintic ─────────────────────────────────────────────────────────────────
export const easeInQuint: EasingFunction = (t) => clamp(t * t * t * t * t);
export const easeOutQuint: EasingFunction = (t) => clamp(1 - Math.pow(1 - t, 5));
export const easeInOutQuint: EasingFunction = (t) =>
  clamp(t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2);

// ── Sine ────────────────────────────────────────────────────────────────────
export const easeInSine: EasingFunction = (t) => clamp(1 - Math.cos((t * Math.PI) / 2));
export const easeOutSine: EasingFunction = (t) => clamp(Math.sin((t * Math.PI) / 2));
export const easeInOutSine: EasingFunction = (t) => clamp(-(Math.cos(Math.PI * t) - 1) / 2);

// ── Exponential ─────────────────────────────────────────────────────────────
export const easeInExpo: EasingFunction = (t) => clamp(t === 0 ? 0 : Math.pow(2, 10 * t - 10));
export const easeOutExpo: EasingFunction = (t) => clamp(t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const easeInOutExpo: EasingFunction = (t) => {
  if (t === 0) return 0;
  if (t === 1) return 1;
  return clamp(
    t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2
  );
};

// ── Circular ────────────────────────────────────────────────────────────────
export const easeInCirc: EasingFunction = (t) => clamp(1 - Math.sqrt(1 - Math.pow(t, 2)));
export const easeOutCirc: EasingFunction = (t) => clamp(Math.sqrt(1 - Math.pow(t - 1, 2)));
export const easeInOutCirc: EasingFunction = (t) =>
  clamp(
    t < 0.5
      ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2
      : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2
  );

// ── Back (slight overshoot) ─────────────────────────────────────────────────
const BACK_C1 = 1.70158;
const BACK_C2 = BACK_C1 * 1.525;
const BACK_C3 = BACK_C1 + 1;
export const easeInBack: EasingFunction = (t) => clamp(BACK_C3 * t * t * t - BACK_C1 * t * t);
export const easeOutBack: EasingFunction = (t) =>
  clamp(1 + BACK_C3 * Math.pow(t - 1, 3) + BACK_C1 * Math.pow(t - 1, 2));
export const easeInOutBack: EasingFunction = (t) =>
  clamp(
    t < 0.5
      ? (Math.pow(2 * t, 2) * ((BACK_C2 + 1) * 2 * t - BACK_C2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((BACK_C2 + 1) * (t * 2 - 2) + BACK_C2) + 2) / 2
  );

// ── Elastic ─────────────────────────────────────────────────────────────────
const ELASTIC_C4 = (2 * Math.PI) / 3;
const ELASTIC_C5 = (2 * Math.PI) / 4.5;
export const easeInElastic: EasingFunction = (t) => {
  if (t === 0) return 0;
  if (t === 1) return 1;
  return clamp(-Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * ELASTIC_C4));
};
export const easeOutElastic: EasingFunction = (t) => {
  if (t === 0) return 0;
  if (t === 1) return 1;
  return clamp(Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ELASTIC_C4) + 1);
};
export const easeInOutElastic: EasingFunction = (t) => {
  if (t === 0) return 0;
  if (t === 1) return 1;
  return clamp(
    t < 0.5
      ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * ELASTIC_C5)) / 2
      : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * ELASTIC_C5)) / 2 + 1
  );
};

// ── Bounce ──────────────────────────────────────────────────────────────────
const BOUNCE_N1 = 7.5625;
const BOUNCE_D1 = 2.75;
export const easeOutBounce: EasingFunction = (t) => {
  if (t < 1 / BOUNCE_D1) return clamp(BOUNCE_N1 * t * t);
  if (t < 2 / BOUNCE_D1) {
    const u = t - 1.5 / BOUNCE_D1;
    return clamp(BOUNCE_N1 * u * u + 0.75);
  }
  if (t < 2.5 / BOUNCE_D1) {
    const u = t - 2.25 / BOUNCE_D1;
    return clamp(BOUNCE_N1 * u * u + 0.9375);
  }
  const u = t - 2.625 / BOUNCE_D1;
  return clamp(BOUNCE_N1 * u * u + 0.984375);
};
export const easeInBounce: EasingFunction = (t) => clamp(1 - easeOutBounce(1 - t));
export const easeInOutBounce: EasingFunction = (t) =>
  clamp(
    t < 0.5 ? (1 - easeOutBounce(1 - 2 * t)) / 2 : (1 + easeOutBounce(2 * t - 1)) / 2
  );

/**
 * Create a CSS `cubic-bezier()` compatible easing function.
 *
 * Uses Newton-Raphson refinement of a binary-search seed (the algorithm
 * Blink/WebKit ship for `transition-timing-function`). Accurate to within
 * a few millionths over the full domain.
 *
 * @param x1 - First control point X (0..1)
 * @param y1 - First control point Y (unrestricted)
 * @param x2 - Second control point X (0..1)
 * @param y2 - Second control point Y (unrestricted)
 * @returns Easing function clamped to `[0, 1]`
 *
 * @example
 * ```ts
 * const easeInOut = cubicBezier(0.42, 0, 0.58, 1);
 * easeInOut(0.5); // ~0.5
 * ```
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFunction {
  const cx1 = Math.min(1, Math.max(0, x1));
  const cx2 = Math.min(1, Math.max(0, x2));

  // Cubic-bezier polynomial coefficients given control points are (0,0) P1 P2 (1,1).
  const ax = 1 - 3 * cx2 + 3 * cx1;
  const bx = 3 * cx2 - 6 * cx1;
  const ccx = 3 * cx1;
  const ay = 1 - 3 * y2 + 3 * y1;
  const by = 3 * y2 - 6 * y1;
  const cy = 3 * y1;

  const sampleX = (t: number) => ((ax * t + bx) * t + ccx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const sampleDerivativeX = (t: number) => (3 * ax * t + 2 * bx) * t + ccx;

  const solveX = (x: number): number => {
    let t = x;
    // Newton-Raphson — usually converges in 4 iterations.
    for (let i = 0; i < 8; i += 1) {
      const currentX = sampleX(t) - x;
      const dx = sampleDerivativeX(t);
      if (Math.abs(currentX) < 1e-6) return t;
      if (Math.abs(dx) < 1e-6) break;
      t = t - currentX / dx;
    }
    // Bisection fallback.
    let lo = 0;
    let hi = 1;
    t = x;
    while (lo < hi) {
      const currentX = sampleX(t);
      if (Math.abs(currentX - x) < 1e-6) return t;
      if (x > currentX) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
      if (hi - lo < 1e-7) break;
    }
    return t;
  };

  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return clamp(sampleY(solveX(t)));
  };
}

/**
 * Step position for `steps()` easings, matching CSS `steps()` semantics.
 */
export type StepPosition = 'start' | 'end' | 'jump-start' | 'jump-end' | 'jump-none' | 'jump-both';

/**
 * Create a stepped easing function mirroring CSS `steps(count, position)`.
 *
 * @param count - Number of steps (must be a positive integer)
 * @param position - Step position; default `'end'` (alias of `'jump-end'`)
 * @returns Easing function clamped to `[0, 1]`
 *
 * @example
 * ```ts
 * const stepEnd = steps(4, 'end');
 * stepEnd(0.0);    // 0
 * stepEnd(0.99);   // 0.75
 * stepEnd(1.0);    // 1
 * ```
 */
export function steps(count: number, position: StepPosition = 'end'): EasingFunction {
  const n = Math.max(1, Math.floor(count));
  return (t) => {
    if (Number.isNaN(t)) return 0;
    const x = Math.min(1, Math.max(0, t));
    switch (position) {
      case 'start':
      case 'jump-start':
        return clamp(Math.min(1, (Math.floor(x * n) + 1) / n));
      case 'jump-none':
        // n-1 jumps; values 0..1 evenly spaced including both 0 and 1.
        if (n === 1) return x < 1 ? 0 : 1;
        return clamp(Math.min(1, Math.floor(x * n) / (n - 1)));
      case 'jump-both':
        // n+1 jumps; first jump occurs immediately, last lands before 1.
        return clamp(Math.min(1, (Math.floor(x * n) + 1) / (n + 1)));
      case 'end':
      case 'jump-end':
      default:
        if (x >= 1) return 1;
        return clamp(Math.floor(x * n) / n);
    }
  };
}

/**
 * Linearly blend two easings by a weight in `[0, 1]`.
 *
 * @param a - First easing
 * @param b - Second easing
 * @param weight - Mix weight (`0` returns `a(t)`, `1` returns `b(t)`)
 *
 * @example
 * ```ts
 * const softSpring = mix(easeOutCubic, easeOutBack, 0.4);
 * ```
 */
export function mix(a: EasingFunction, b: EasingFunction, weight: number): EasingFunction {
  const w = Math.min(1, Math.max(0, weight));
  return (t) => clamp(a(t) * (1 - w) + b(t) * w);
}

/**
 * Compose easings sequentially across evenly spaced sub-ranges of `t`.
 *
 * Each easing runs over an equal slice of the `[0, 1]` domain; the segment
 * output is remapped to the segment's portion of the overall range so the
 * resulting easing still spans `[0, 1]`.
 *
 * @param easings - Easings to chain, in order
 *
 * @example
 * ```ts
 * const inThenOut = chain(easeInQuad, easeOutBounce);
 * ```
 */
export function chain(...easings: EasingFunction[]): EasingFunction {
  if (easings.length === 0) return linear;
  if (easings.length === 1) return easings[0];
  const segments = easings.length;
  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const scaled = t * segments;
    const index = Math.min(segments - 1, Math.floor(scaled));
    const localT = scaled - index;
    const segmentValue = easings[index](localT);
    return clamp((index + segmentValue) / segments);
  };
}

/**
 * Named easing presets.
 *
 * Every easing function exported from this module is mirrored here so
 * callers can look one up by name (e.g. for serialized configuration).
 */
export const easingPresets = {
  linear,
  // Quad
  easeInQuad,
  easeOutQuad,
  easeInOutQuad,
  // Cubic
  easeInCubic,
  easeOutCubic,
  easeInOutCubic,
  // Quart
  easeInQuart,
  easeOutQuart,
  easeInOutQuart,
  // Quint
  easeInQuint,
  easeOutQuint,
  easeInOutQuint,
  // Sine
  easeInSine,
  easeOutSine,
  easeInOutSine,
  // Expo
  easeInExpo,
  easeOutExpo,
  easeInOutExpo,
  // Circ
  easeInCirc,
  easeOutCirc,
  easeInOutCirc,
  // Back
  easeInBack,
  easeOutBack,
  easeInOutBack,
  // Elastic
  easeInElastic,
  easeOutElastic,
  easeInOutElastic,
  // Bounce
  easeInBounce,
  easeOutBounce,
  easeInOutBounce,
};
