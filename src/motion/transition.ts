/**
 * View transition helpers.
 *
 * @module bquery/motion
 */

import type { TransitionOptions } from './types';

/** Extended document type with View Transitions API */
type DocumentWithTransition = Document & {
  startViewTransition?: (callback: () => void) => {
    finished: Promise<void>;
    ready: Promise<void>;
    updateCallbackDone: Promise<void>;
  };
};

/**
 * Execute a DOM update with view transition animation.
 * Falls back to immediate update when View Transitions API is unavailable.
 *
 * @param updateOrOptions - Update function or options object
 * @returns Promise that resolves when transition completes
 *
 * @example
 * ```ts
 * await transition(() => {
 *   $('#content').text('Updated');
 * });
 * ```
 */
export const transition = async (
  updateOrOptions: (() => void) | TransitionOptions
): Promise<void> => {
  const update = typeof updateOrOptions === 'function' ? updateOrOptions : updateOrOptions.update;

  const doc = document as DocumentWithTransition;

  if (doc.startViewTransition) {
    await doc.startViewTransition(() => update()).finished;
    return;
  }

  update();
};
