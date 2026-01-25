/**
 * Reduced motion detection helpers.
 *
 * @module bquery/motion
 */

/**
 * Check whether the user prefers reduced motion.
 *
 * @returns true if the user prefers reduced motion, otherwise false
 */
export const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};
