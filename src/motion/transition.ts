/**
 * View transition helpers.
 *
 * @module bquery/motion
 */

import type { TransitionOptions } from './types';
import { prefersReducedMotion } from './reduced-motion';
import { getBqueryConfig } from '../platform/config';

/** Extended document type with View Transitions API */
type DocumentWithTransition = Document & {
  startViewTransition?: (callback: () => void | Promise<void>) => {
    finished: Promise<void>;
    ready: Promise<void>;
    updateCallbackDone: Promise<void>;
    skipTransition?: () => void;
    types?: {
      add: (type: string) => void;
    };
  };
};

const sanitizeTokens = (tokens?: string[]): string[] =>
  (tokens ?? []).map((token) => token.trim()).filter((token) => token.length > 0);

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
  updateOrOptions: (() => void | Promise<void>) | TransitionOptions
): Promise<void> => {
  const config = getBqueryConfig().transitions;
  const options: TransitionOptions =
    typeof updateOrOptions === 'function'
      ? {
          update: updateOrOptions,
          classes: config?.classes,
          types: config?.types,
          skipOnReducedMotion: config?.skipOnReducedMotion,
        }
      : {
          ...updateOrOptions,
          classes: updateOrOptions.classes ?? config?.classes,
          types: updateOrOptions.types ?? config?.types,
          skipOnReducedMotion: updateOrOptions.skipOnReducedMotion ?? config?.skipOnReducedMotion,
        };
  const update = options.update;

  // SSR/non-DOM environment fallback
  if (typeof document === 'undefined') {
    await update();
    return;
  }

  const doc = document as DocumentWithTransition;
  const root = document.documentElement;
  const classes = sanitizeTokens(options.classes);
  const types = sanitizeTokens(options.types);

  if (!doc.startViewTransition || (options.skipOnReducedMotion && prefersReducedMotion())) {
    await update();
    options.onFinish?.();
    return;
  }

  classes.forEach((className: string) => root.classList.add(className));

  try {
    const viewTransition = doc.startViewTransition(() => update());
    const transitionTypes = viewTransition.types;

    if (transitionTypes) {
      for (const type of types) {
        transitionTypes.add(type);
      }
    }

    await viewTransition.ready;
    options.onReady?.();
    await viewTransition.finished;
    options.onFinish?.();
  } finally {
    classes.forEach((className: string) => root.classList.remove(className));
  }
};
