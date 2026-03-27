/**
 * FLIP-based morph animation between two element states.
 *
 * @module bquery/motion
 */

import { applyFinalKeyframeStyles } from './animate';
import { prefersReducedMotion } from './reduced-motion';
import type { MorphOptions } from './types';

/**
 * Perform a FLIP-based morph animation between two elements.
 *
 * Captures the bounding rect of the `from` element, hides it, shows the
 * `to` element, then animates the `to` element from the `from` position
 * using CSS transforms and opacity.
 *
 * @param from - The source element (will be hidden at the end)
 * @param to - The destination element (will be shown and animated into place)
 * @param options - Morph animation options
 * @returns Promise that resolves when the morph completes
 *
 * @example
 * ```ts
 * const card = document.querySelector('.card');
 * const detail = document.querySelector('.detail');
 * await morphElement(card, detail, { duration: 400, easing: 'ease-out' });
 * ```
 */
export const morphElement = (
  from: Element,
  to: Element,
  options: MorphOptions = {}
): Promise<void> => {
  const {
    duration = 300,
    easing = 'ease',
    respectReducedMotion = true,
    onComplete,
  } = options;

  const fromEl = from as HTMLElement;
  const toEl = to as HTMLElement;

  // Capture FIRST position of source element
  const firstRect = from.getBoundingClientRect();

  // Ensure destination is visible so we can measure it
  const previousDisplay = toEl.style.display;
  const previousVisibility = toEl.style.visibility;
  const computedDisplay =
    typeof getComputedStyle === 'function'
      ? getComputedStyle(toEl).display
      : previousDisplay || 'block';
  // Prefer an explicit inline display, otherwise fall back to the current computed
  // display, and finally to `block` so hidden destinations remain measurable.
  const forcedDisplay =
    computedDisplay === 'none' ? 'block' : previousDisplay || computedDisplay || 'block';
  toEl.style.visibility = 'hidden';
  toEl.style.display = forcedDisplay;

  // Capture LAST position of destination element
  const lastRect = to.getBoundingClientRect();

  // Restore visibility (it will be animated in)
  toEl.style.visibility = previousVisibility;

  // Hide source, show destination
  fromEl.style.display = 'none';
  if (computedDisplay === 'none') {
    toEl.style.display = forcedDisplay;
  } else if (previousDisplay === 'none') {
    toEl.style.display = '';
  } else {
    toEl.style.display = previousDisplay;
  }

  // If reduced motion is preferred, skip the animation
  if (respectReducedMotion && prefersReducedMotion()) {
    toEl.style.opacity = '1';
    onComplete?.();
    return Promise.resolve();
  }

  // Calculate the transform inversion (FLIP: Invert)
  const dx = firstRect.left - lastRect.left;
  const dy = firstRect.top - lastRect.top;
  const sx = firstRect.width / (lastRect.width || 1);
  const sy = firstRect.height / (lastRect.height || 1);

  // If no visual change, skip animation
  if (dx === 0 && dy === 0 && sx === 1 && sy === 1) {
    toEl.style.opacity = '1';
    onComplete?.();
    return Promise.resolve();
  }

  const keyframes: Keyframe[] = [
    {
      transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
      opacity: '0.5',
    },
    {
      transform: 'translate(0, 0) scale(1, 1)',
      opacity: '1',
    },
  ];

  // Check if animate API is available
  if (typeof toEl.animate !== 'function') {
    applyFinalKeyframeStyles(toEl, keyframes);
    onComplete?.();
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const animation = toEl.animate(keyframes, {
      duration,
      easing,
      fill: 'forwards',
    });

    let finalized = false;
    const finalize = () => {
      if (finalized) return;
      finalized = true;
      // Apply final state
      toEl.style.transform = '';
      toEl.style.opacity = '1';
      animation.cancel();
      onComplete?.();
      resolve();
    };

    animation.onfinish = finalize;
    if (animation.finished) {
      animation.finished.then(finalize).catch(finalize);
    }
  });
};
