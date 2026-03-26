/**
 * Reactive viewport dimensions.
 *
 * Provides a reactive signal tracking the browser viewport's
 * width, height, and orientation.
 *
 * @module bquery/media
 */

import { signal, readonly } from '../reactive/index';
import type { ReadonlySignal } from '../reactive/index';
import type { ViewportState } from './types';

/**
 * Computes orientation from width and height.
 * @internal
 */
const getOrientation = (w: number, h: number): 'portrait' | 'landscape' =>
  h >= w ? 'portrait' : 'landscape';

/**
 * Returns a reactive signal tracking the current viewport dimensions and orientation.
 *
 * Updates automatically when the window is resized. Uses `window.innerWidth`
 * and `window.innerHeight` under the hood.
 *
 * @returns A readonly reactive signal with `{ width, height, orientation }`
 *
 * @example
 * ```ts
 * import { useViewport } from '@bquery/bquery/media';
 * import { effect } from '@bquery/bquery/reactive';
 *
 * const viewport = useViewport();
 * effect(() => {
 *   console.log(`Viewport: ${viewport.value.width}x${viewport.value.height}`);
 *   console.log(`Orientation: ${viewport.value.orientation}`);
 * });
 * ```
 */
export const useViewport = (): ReadonlySignal<ViewportState> => {
  const initial: ViewportState = {
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
    orientation:
      typeof window !== 'undefined'
        ? getOrientation(window.innerWidth, window.innerHeight)
        : 'portrait',
  };

  const s = signal<ViewportState>(initial);

  if (typeof window !== 'undefined') {
    const handler = (): void => {
      s.value = {
        width: window.innerWidth,
        height: window.innerHeight,
        orientation: getOrientation(window.innerWidth, window.innerHeight),
      };
    };

    window.addEventListener('resize', handler);
  }

  return readonly(s);
};
