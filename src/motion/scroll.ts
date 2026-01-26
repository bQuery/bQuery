/**
 * Scroll-triggered animation helpers.
 *
 * @module bquery/motion
 */

import { animate } from './animate';
import type { ScrollAnimateCleanup, ScrollAnimateOptions } from './types';

const resolveElements = (elements: Element | Iterable<Element> | ArrayLike<Element>): Element[] => {
  if (typeof Element !== 'undefined' && elements instanceof Element) return [elements];
  return Array.from(elements as Iterable<Element>);
};

/**
 * Animate elements when they enter the viewport.
 *
 * @param elements - Target element(s)
 * @param options - Scroll animation configuration
 * @returns Cleanup function to disconnect observers
 */
export const scrollAnimate = (
  elements: Element | Iterable<Element> | ArrayLike<Element>,
  options: ScrollAnimateOptions
): ScrollAnimateCleanup => {
  const targets = resolveElements(elements);
  if (!targets.length) return () => undefined;

  const { root = null, rootMargin, threshold, once = true, onEnter, ...animationConfig } = options;

  if (typeof IntersectionObserver === 'undefined') {
    targets.forEach((element) => {
      onEnter?.(element);
      void animate(element, animationConfig);
    });
    return () => undefined;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const element = entry.target as Element;
        onEnter?.(element);
        void animate(element, animationConfig);
        if (once) {
          observer.unobserve(element);
        }
      });
    },
    { root, rootMargin, threshold }
  );

  targets.forEach((element) => observer.observe(element));

  return () => observer.disconnect();
};
