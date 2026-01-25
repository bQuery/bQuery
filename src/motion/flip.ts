/**
 * FLIP animation helpers.
 *
 * @module bquery/motion
 */

import type { ElementBounds, FlipGroupOptions, FlipOptions } from './types';

/**
 * Capture the current bounds of an element for FLIP animation.
 *
 * @param element - The DOM element to measure
 * @returns The element's current position and size
 */
export const capturePosition = (element: Element): ElementBounds => {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
};

/**
 * Perform a FLIP (First, Last, Invert, Play) animation.
 * Animates an element from its captured position to its current position.
 *
 * @param element - The element to animate
 * @param firstBounds - The previously captured bounds
 * @param options - Animation configuration
 * @returns Promise that resolves when animation completes
 *
 * @example
 * ```ts
 * const first = capturePosition(element);
 * // ... DOM changes that move the element ...
 * await flip(element, first, { duration: 300 });
 * ```
 */
export const flip = (
  element: Element,
  firstBounds: ElementBounds,
  options: FlipOptions = {}
): Promise<void> => {
  const { duration = 300, easing = 'ease-out', onComplete } = options;

  // Last: Get current position
  const lastBounds = capturePosition(element);

  // Skip animation if element has zero dimensions (avoid division by zero)
  if (lastBounds.width === 0 || lastBounds.height === 0) {
    return Promise.resolve();
  }

  // Invert: Calculate the delta
  const deltaX = firstBounds.left - lastBounds.left;
  const deltaY = firstBounds.top - lastBounds.top;
  const deltaW = firstBounds.width / lastBounds.width;
  const deltaH = firstBounds.height / lastBounds.height;

  // Skip animation if no change
  if (deltaX === 0 && deltaY === 0 && deltaW === 1 && deltaH === 1) {
    return Promise.resolve();
  }

  const htmlElement = element as HTMLElement;

  // Apply inverted transform
  htmlElement.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${deltaW}, ${deltaH})`;
  htmlElement.style.transformOrigin = 'top left';

  // Force reflow
  void htmlElement.offsetHeight;

  // Play: Animate back to current position
  return new Promise((resolve) => {
    const animation = htmlElement.animate(
      [
        {
          transform: `translate(${deltaX}px, ${deltaY}px) scale(${deltaW}, ${deltaH})`,
        },
        { transform: 'translate(0, 0) scale(1, 1)' },
      ],
      { duration, easing, fill: 'forwards' }
    );

    animation.onfinish = () => {
      htmlElement.style.transform = '';
      htmlElement.style.transformOrigin = '';
      onComplete?.();
      resolve();
    };
  });
};

/**
 * FLIP helper for animating a list of elements.
 * Useful for reordering lists with smooth animations.
 *
 * @param elements - Array of elements to animate
 * @param performUpdate - Function that performs the DOM update
 * @param options - Animation configuration
 *
 * @example
 * ```ts
 * await flipList(listItems, () => {
 *   container.appendChild(container.firstChild); // Move first to last
 * });
 * ```
 */
export const flipList = async (
  elements: Element[],
  performUpdate: () => void,
  options: FlipOptions = {}
): Promise<void> => {
  await flipElements(elements, performUpdate, options);
};

/**
 * FLIP helper with optional stagger support.
 *
 * @param elements - Array of elements to animate
 * @param performUpdate - Function that performs the DOM update
 * @param options - Animation configuration
 */
export const flipElements = async (
  elements: Element[],
  performUpdate: () => void,
  options: FlipGroupOptions = {}
): Promise<void> => {
  const { stagger, ...flipOptions } = options;

  // First: Capture all positions
  const positions = new Map<Element, ElementBounds>();
  for (const el of elements) {
    positions.set(el, capturePosition(el));
  }

  // Perform DOM update
  performUpdate();

  const total = elements.length;

  // Animate each element
  const animations = elements.map((el, index) => {
    const first = positions.get(el);
    if (!first) return Promise.resolve();
    const delay = stagger ? stagger(index, total) : 0;
    if (delay > 0) {
      return new Promise((resolve) => setTimeout(resolve, delay)).then(() =>
        flip(el, first, flipOptions)
      );
    }
    return flip(el, first, flipOptions);
  });

  await Promise.all(animations);
};
