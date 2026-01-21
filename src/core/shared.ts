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
