/**
 * Shared helpers for element wrappers.
 */
export type ElementList = Element[];

export const toElementList = (input: Element | ElementList): ElementList =>
  Array.isArray(input) ? input : [input];

export const applyAll = (elements: ElementList, action: (el: Element) => void) => {
  for (const el of elements) {
    action(el);
  }
};

/** @internal */
export const isHTMLElement = (
  element: Element | null | undefined
): element is HTMLElement => {
  if (!element) {
    return false;
  }

  const view = element.ownerDocument?.defaultView;
  const HTMLElementCtor = view?.HTMLElement ?? globalThis.HTMLElement;
  return typeof HTMLElementCtor === 'function' && element instanceof HTMLElementCtor;
};

/**
 * Gets an element's outer size, optionally including margins.
 *
 * @internal
 */
export const getOuterSize = (
  element: Element | null | undefined,
  dimension: 'width' | 'height',
  includeMargin: boolean
): number => {
  if (!isHTMLElement(element)) {
    return 0;
  }

  const size = dimension === 'width' ? element.offsetWidth : element.offsetHeight;
  if (!includeMargin) {
    return size;
  }

  const view = element.ownerDocument?.defaultView;
  if (!view || typeof view.getComputedStyle !== 'function') {
    return size;
  }

  const computedStyle = view.getComputedStyle(element);
  const startMargin = Number.parseFloat(
    computedStyle.getPropertyValue(dimension === 'width' ? 'margin-left' : 'margin-top')
  );
  const endMargin = Number.parseFloat(
    computedStyle.getPropertyValue(dimension === 'width' ? 'margin-right' : 'margin-bottom')
  );

  const safeStartMargin = Number.isNaN(startMargin) ? 0 : startMargin;
  const safeEndMargin = Number.isNaN(endMargin) ? 0 : endMargin;

  return size + safeStartMargin + safeEndMargin;
};
