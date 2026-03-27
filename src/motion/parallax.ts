/**
 * Scroll-linked parallax effect.
 *
 * @module bquery/motion
 */

import { prefersReducedMotion } from './reduced-motion';
import type { ParallaxCleanup, ParallaxOptions } from './types';

/**
 * Apply a scroll-linked parallax effect to an element.
 *
 * The element's position is translated based on the scroll position
 * multiplied by the speed factor. A speed of `0.5` means the element
 * moves at half the scroll speed (classic background parallax).
 *
 * @param element - The element to apply the parallax effect to
 * @param options - Parallax configuration
 * @returns A cleanup function that removes the scroll listener
 *
 * @example
 * ```ts
 * const cleanup = parallax(document.querySelector('.hero-bg')!, {
 *   speed: 0.3,
 *   direction: 'vertical',
 * });
 *
 * // Later, remove the effect:
 * cleanup();
 * ```
 */
export const parallax = (element: Element, options: ParallaxOptions = {}): ParallaxCleanup => {
  if (
    typeof window === 'undefined' ||
    typeof window.addEventListener !== 'function' ||
    typeof window.removeEventListener !== 'function' ||
    typeof requestAnimationFrame !== 'function' ||
    typeof cancelAnimationFrame !== 'function'
  ) {
    return () => {};
  }

  const { speed = 0.5, direction = 'vertical', respectReducedMotion = true } = options;

  const el = element as HTMLElement;
  const previousTransform = el.style.transform;

  // If reduced motion is preferred, don't apply parallax
  if (respectReducedMotion && prefersReducedMotion()) {
    return () => {};
  }

  let ticking = false;
  let destroyed = false;
  let frameId: number | null = null;

  const updatePosition = () => {
    if (destroyed) return;

    // Re-check reduced motion on each frame (in case toggle changed)
    if (respectReducedMotion && prefersReducedMotion()) {
      el.style.transform = previousTransform;
      return;
    }

    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    let tx = 0;
    let ty = 0;

    if (direction === 'vertical' || direction === 'both') {
      ty = scrollY * speed;
    }
    if (direction === 'horizontal' || direction === 'both') {
      tx = scrollX * speed;
    }

    const parallaxTransform = `translate3d(${tx}px, ${ty}px, 0)`;
    el.style.transform = previousTransform
      ? `${previousTransform} ${parallaxTransform}`
      : parallaxTransform;
  };

  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      frameId = requestAnimationFrame(() => {
        frameId = null;
        updatePosition();
        ticking = false;
      });
    }
  };

  // Apply initial position
  updatePosition();

  // Listen to scroll events
  window.addEventListener('scroll', onScroll, { passive: true });

  return () => {
    destroyed = true;
    window.removeEventListener('scroll', onScroll);
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
    ticking = false;
    el.style.transform = previousTransform;
  };
};
