/**
 * Stagger helpers.
 *
 * @module bquery/motion
 */

import type { StaggerFunction, StaggerOptions } from './types';

/**
 * Create a staggered delay function for list animations.
 *
 * @param step - Delay between items in milliseconds
 * @param options - Stagger configuration
 * @returns Function that returns delay for a given index
 *
 * @example
 * ```ts
 * const delay = stagger(50, { from: 'center' });
 * delay(0, 3); // 50
 * delay(1, 3); // 0
 * ```
 */
export const stagger = (step: number, options: StaggerOptions = {}): StaggerFunction => {
  const { start = 0, from = 'start', easing } = options;

  return (index: number, total = 0): number => {
    const origin =
      typeof from === 'number'
        ? from
        : from === 'center'
          ? (total - 1) / 2
          : from === 'end'
            ? total - 1
            : 0;

    const distance = Math.abs(index - origin);
    const maxDistance = total > 1 ? Math.max(origin, total - 1 - origin) : 1;
    const normalized = maxDistance === 0 ? 0 : distance / maxDistance;
    const eased = easing ? easing(normalized) * maxDistance : distance;

    return start + eased * step;
  };
};
