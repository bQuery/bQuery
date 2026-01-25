/**
 * Easing helpers.
 *
 * @module bquery/motion
 */

import type { EasingFunction } from './types';

const clamp = (value: number) => Math.min(1, Math.max(0, value));

export const linear: EasingFunction = (t) => clamp(t);
export const easeInQuad: EasingFunction = (t) => clamp(t * t);
export const easeOutQuad: EasingFunction = (t) => clamp(1 - (1 - t) * (1 - t));
export const easeInOutQuad: EasingFunction = (t) =>
  clamp(t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeInCubic: EasingFunction = (t) => clamp(t * t * t);
export const easeOutCubic: EasingFunction = (t) => clamp(1 - Math.pow(1 - t, 3));
export const easeInOutCubic: EasingFunction = (t) =>
  clamp(t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack: EasingFunction = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return clamp(1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2));
};
export const easeOutExpo: EasingFunction = (t) => clamp(t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * Named easing presets.
 */
export const easingPresets = {
  linear,
  easeInQuad,
  easeOutQuad,
  easeInOutQuad,
  easeInCubic,
  easeOutCubic,
  easeInOutCubic,
  easeOutBack,
  easeOutExpo,
};
