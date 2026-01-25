/**
 * Web Animations helpers.
 *
 * @module bquery/motion
 */

import { prefersReducedMotion } from './reduced-motion';
import type { AnimateOptions } from './types';

/** @internal */
const isStyleValue = (value: unknown): value is string | number =>
  typeof value === 'string' || typeof value === 'number';

/**
 * Convert camelCase property names to kebab-case for CSS.
 * @internal
 */
const toKebabCase = (str: string): string => {
  return str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
};

/** @internal */
export const applyFinalKeyframeStyles = (
  element: Element,
  keyframes: Keyframe[] | PropertyIndexedKeyframes
): void => {
  const htmlElement = element as HTMLElement;
  const style = htmlElement.style;

  if (Array.isArray(keyframes)) {
    const last = keyframes[keyframes.length - 1];
    if (!last) return;
    for (const [prop, value] of Object.entries(last)) {
      if (prop === 'offset' || prop === 'easing' || prop === 'composite') continue;
      if (isStyleValue(value)) {
        // Convert camelCase to kebab-case for CSS properties
        const cssProp = prop.startsWith('--') ? prop : toKebabCase(prop);
        style.setProperty(cssProp, String(value));
      }
    }
    return;
  }

  for (const [prop, value] of Object.entries(keyframes)) {
    if (prop === 'offset' || prop === 'easing' || prop === 'composite') continue;
    const finalValue = Array.isArray(value) ? value[value.length - 1] : value;
    if (isStyleValue(finalValue)) {
      // Convert camelCase to kebab-case for CSS properties
      const cssProp = prop.startsWith('--') ? prop : toKebabCase(prop);
      style.setProperty(cssProp, String(finalValue));
    }
  }
};

/**
 * Animate an element using the Web Animations API with reduced-motion fallback.
 *
 * @param element - Element to animate
 * @param config - Animation configuration
 * @returns Promise that resolves when animation completes
 *
 * @example
 * ```ts
 * await animate(element, {
 *   keyframes: [{ opacity: 0 }, { opacity: 1 }],
 *   options: { duration: 200, easing: 'ease-out' },
 * });
 * ```
 */
export const animate = (element: Element, config: AnimateOptions): Promise<void> => {
  const { keyframes, options, commitStyles = true, respectReducedMotion = true, onFinish } = config;

  if (respectReducedMotion && prefersReducedMotion()) {
    if (commitStyles) {
      applyFinalKeyframeStyles(element, keyframes);
    }
    onFinish?.();
    return Promise.resolve();
  }

  const htmlElement = element as HTMLElement;
  if (typeof htmlElement.animate !== 'function') {
    if (commitStyles) {
      applyFinalKeyframeStyles(element, keyframes);
    }
    onFinish?.();
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const animation = htmlElement.animate(keyframes, options);
    let finalized = false;
    const finalize = () => {
      if (finalized) return;
      finalized = true;
      if (commitStyles) {
        if (typeof animation.commitStyles === 'function') {
          animation.commitStyles();
        } else {
          applyFinalKeyframeStyles(element, keyframes);
        }
      }
      animation.cancel();
      onFinish?.();
      resolve();
    };

    animation.onfinish = finalize;
    if (animation.finished) {
      animation.finished.then(finalize).catch(finalize);
    }
  });
};
