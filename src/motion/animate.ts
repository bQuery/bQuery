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
const readCurrentStyleValue = (element: Element, prop: string): string => {
  const htmlElement = element as HTMLElement;
  const cssProp = prop.startsWith('--') ? prop : toKebabCase(prop);
  const inlineValue = htmlElement.style.getPropertyValue(cssProp).trim();
  if (inlineValue) return inlineValue;
  const view = element.ownerDocument?.defaultView;
  const computedValue = view?.getComputedStyle?.(htmlElement).getPropertyValue(cssProp).trim();
  return computedValue ?? '';
};

type KeyframeBoundary = 'first' | 'last';

/** @internal */
export const applyKeyframeStyles = (
  element: Element,
  keyframes: Keyframe[] | PropertyIndexedKeyframes,
  boundary: KeyframeBoundary = 'last'
): void => {
  const htmlElement = element as HTMLElement;
  const style = htmlElement.style;

  if (Array.isArray(keyframes)) {
    const frame = boundary === 'first' ? keyframes[0] : keyframes[keyframes.length - 1];
    if (!frame) return;
    for (const [prop, value] of Object.entries(frame)) {
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
    const frameValue = Array.isArray(value)
      ? boundary === 'first'
        ? value[0]
        : value[value.length - 1]
      : value;
    if (isStyleValue(frameValue)) {
      // Convert camelCase to kebab-case for CSS properties
      const cssProp = prop.startsWith('--') ? prop : toKebabCase(prop);
      style.setProperty(cssProp, String(frameValue));
    }
  }
};

/** @internal */
export const applyFinalKeyframeStyles = (
  element: Element,
  keyframes: Keyframe[] | PropertyIndexedKeyframes
): void => {
  applyKeyframeStyles(element, keyframes, 'last');
};

/**
 * Animate an element using the Web Animations API with reduced-motion fallback.
 *
 * Supports cancellation via `AbortSignal` and an override `playbackRate`.
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
 *
 * // Cancellable:
 * const ctrl = new AbortController();
 * animate(element, { keyframes: [...], signal: ctrl.signal });
 * ctrl.abort();
 * ```
 */
export const animate = (element: Element, config: AnimateOptions): Promise<void> => {
  const {
    keyframes,
    options,
    commitStyles = true,
    respectReducedMotion = true,
    onFinish,
    signal,
    playbackRate,
  } = config;

  if (signal?.aborted) {
    onFinish?.();
    return Promise.resolve();
  }

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
    if (typeof playbackRate === 'number' && Number.isFinite(playbackRate)) {
      try {
        animation.playbackRate = playbackRate;
      } catch {
        // Ignore environments that don't support playbackRate.
      }
    }
    let finalized = false;
    const finalize = (shouldCommitStyles: boolean) => {
      if (finalized) return;
      finalized = true;
      if (shouldCommitStyles) {
        if (typeof animation.commitStyles === 'function') {
          animation.commitStyles();
        } else {
          applyFinalKeyframeStyles(element, keyframes);
        }
      }
      animation.cancel();
      if (signal && abortHandler) {
        signal.removeEventListener('abort', abortHandler);
      }
      onFinish?.();
      resolve();
    };
    const finalizeFinished = () => finalize(commitStyles);
    const finalizeAborted = () => finalize(false);

    let abortHandler: (() => void) | null = null;
    if (signal) {
      abortHandler = () => {
        if (finalized) return;
        try {
          animation.cancel();
        } catch {
          // ignore
        }
        finalizeAborted();
      };
      signal.addEventListener('abort', abortHandler, { once: true });
    }

    animation.onfinish = finalizeFinished;
    if (animation.finished) {
      animation.finished.then(finalizeFinished).catch(finalizeFinished);
    }
  });
};

/**
 * CSS property record accepted by {@link animateTo}.
 *
 * Keys are camelCase or kebab-case CSS property names; values are
 * either single CSS values (interpreted as the destination state) or
 * `[from, to]` tuples for explicit two-keyframe ranges.
 */
export type AnimateToStyles = Record<string, string | number | [string | number, string | number]>;

/**
 * Options for {@link animateTo}.
 */
export interface AnimateToOptions
  extends Omit<AnimateOptions, 'keyframes' | 'options'>,
    Omit<KeyframeAnimationOptions, 'composite' | 'iterationComposite'> {
  /** Optional override keyframe options merged with the top-level ones. */
  options?: Omit<KeyframeAnimationOptions, 'composite' | 'iterationComposite'>;
}

/**
 * Animate an element to a target set of CSS properties.
 *
 * Build keyframes from a property record without manually authoring a
 * `Keyframe[]` array. Single values become destination-only keyframes;
 * `[from, to]` tuples become explicit start/end keyframes.
 *
 * @example
 * ```ts
 * await animateTo(card, { opacity: 1, transform: 'translateY(0)' }, {
 *   duration: 320,
 *   easing: 'ease-out',
 * });
 *
 * // Explicit start/end:
 * await animateTo(card, { opacity: [0, 1] }, { duration: 200 });
 * ```
 */
export const animateTo = (
  element: Element,
  styles: AnimateToStyles,
  options: AnimateToOptions = {}
): Promise<void> => {
  const {
    commitStyles,
    respectReducedMotion,
    onFinish,
    signal,
    playbackRate,
    options: overrideOptions,
    ...keyframeOptions
  } = options;

  const fromFrame: Record<string, string | number> = {};
  const toFrame: Record<string, string | number> = {};
  let hasFromValues = false;

  for (const [prop, value] of Object.entries(styles)) {
    if (Array.isArray(value)) {
      fromFrame[prop] = value[0];
      toFrame[prop] = value[1];
      hasFromValues = true;
    } else {
      toFrame[prop] = value;
    }
  }

  if (!hasFromValues) {
    for (const prop of Object.keys(toFrame)) {
      fromFrame[prop] = readCurrentStyleValue(element, prop);
    }
  }

  const keyframes: Keyframe[] = [fromFrame, toFrame];

  return animate(element, {
    keyframes,
    options: { ...keyframeOptions, ...overrideOptions },
    commitStyles,
    respectReducedMotion,
    onFinish,
    signal,
    playbackRate,
  });
};
