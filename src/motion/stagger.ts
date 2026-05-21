/**
 * Stagger helpers.
 *
 * @module bquery/motion
 */

import type { StaggerFunction, StaggerOptions } from './types';

/**
 * Create a staggered delay function for list animations.
 *
 * Supports linear sequences, center/end origins, grid layouts, axis-only
 * 2D distributions, and randomized index distance for chaotic looks.
 *
 * @param step - Delay between items in milliseconds
 * @param options - Stagger configuration
 * @returns Function that returns delay for a given index
 *
 * @example Linear stagger
 * ```ts
 * const delay = stagger(50, { from: 'center' });
 * delay(0, 3); // 50
 * delay(1, 3); // 0
 * ```
 *
 * @example Grid stagger
 * ```ts
 * const delay = stagger(40, {
 *   grid: [4, 4],
 *   from: { x: 0, y: 0 },
 * });
 * ```
 */
export const stagger = (step: number, options: StaggerOptions = {}): StaggerFunction => {
  const {
    start = 0,
    from = 'start',
    easing,
    grid,
    axis,
    random = false,
    randomSeed,
  } = options;

  // Pseudo-random helper — stable for the same `(index, total)` within a
  // stagger function, while still allowing a per-instance random seed when one
  // is not provided explicitly.
  const randomSeedBase = random
    ? typeof randomSeed === 'number'
      ? randomSeed | 0
      : (Math.random() * 0x1_0000_0000) | 0
    : null;

  const seededRandom =
    randomSeedBase === null
      ? null
      : (index: number, total: number) => {
          let state =
            randomSeedBase ^
            Math.imul((index | 0) + 1, 0x9e3779b1) ^
            Math.imul((total | 0) + 1, 0x85ebca77);

          // xorshift32 on a per-call mixed seed for repeatability.
          state ^= state << 13;
          state ^= state >>> 17;
          state ^= state << 5;
          return ((state >>> 0) % 1_000_000) / 1_000_000;
        };

  return (index: number, total = 0): number => {
    // Grid mode ─ compute Euclidean (or axis-restricted) distance in cells.
    if (grid) {
      const [rawCols, rawRows] = grid;
      if (
        !Number.isSafeInteger(rawCols) ||
        !Number.isSafeInteger(rawRows) ||
        rawCols <= 0 ||
        rawRows <= 0
      ) {
        return start;
      }
      const cols = rawCols;
      const rows = rawRows;
      const x = index % cols;
      const y = Math.floor(index / cols);

      let originX = 0;
      let originY = 0;
      if (typeof from === 'object' && from && 'x' in from && 'y' in from) {
        originX = Number.isFinite(from.x) ? from.x : 0;
        originY = Number.isFinite(from.y) ? from.y : 0;
      } else if (from === 'center') {
        originX = (cols - 1) / 2;
        originY = (rows - 1) / 2;
      } else if (from === 'end') {
        originX = cols - 1;
        originY = rows - 1;
      } else if (typeof from === 'number' && Number.isFinite(from)) {
        originX = from % cols;
        originY = Math.floor(from / cols);
      }

      const dx = x - originX;
      const dy = y - originY;
      let distance: number;
      if (axis === 'x') distance = Math.abs(dx);
      else if (axis === 'y') distance = Math.abs(dy);
      else distance = Math.sqrt(dx * dx + dy * dy);

      const maxDx = Math.max(originX, cols - 1 - originX);
      const maxDy = Math.max(originY, rows - 1 - originY);
      const maxDistance =
        axis === 'x'
          ? maxDx
          : axis === 'y'
            ? maxDy
            : Math.sqrt(maxDx * maxDx + maxDy * maxDy);

      const normalized = maxDistance === 0 ? 0 : distance / maxDistance;
      const eased = easing ? easing(normalized) * maxDistance : distance;
      const randomized = seededRandom
        ? eased * 0.5 + seededRandom(index, total) * maxDistance * 0.5
        : eased;
      return start + randomized * step;
    }

    const origin =
      typeof from === 'number' && Number.isFinite(from)
        ? from
        : from === 'center'
          ? (total - 1) / 2
          : from === 'end'
            ? total - 1
            : 0;

    if (seededRandom && total > 0) {
      // Randomize the *distance* — keep origin influence but shuffle order.
      const maxDistance = total > 1 ? Math.max(origin, total - 1 - origin) : 1;
      const baseDistance = Math.abs(index - origin);
      const normalized = maxDistance === 0 ? 0 : baseDistance / maxDistance;
      const easedBase = easing ? easing(normalized) * maxDistance : baseDistance;
      const randomShift = seededRandom(index, total) * maxDistance;
      return start + (easedBase * 0.5 + randomShift * 0.5) * step;
    }

    const distance = Math.abs(index - origin);
    const maxDistance = total > 1 ? Math.max(origin, total - 1 - origin) : 1;
    const normalized = maxDistance === 0 ? 0 : distance / maxDistance;
    const eased = easing ? easing(normalized) * maxDistance : distance;

    return start + eased * step;
  };
};
