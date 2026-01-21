import { BQueryCollection } from './collection';
import { BQueryElement } from './element';

/**
 * Select a single element. Returns a wrapper for chainable operations.
 */
export const $ = (selector: string | Element): BQueryElement => {
  if (typeof selector !== 'string') {
    return new BQueryElement(selector);
  }
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`bQuery: element not found for selector "${selector}"`);
  }
  return new BQueryElement(element);
};

/**
 * Select multiple elements. Returns a collection wrapper.
 */
export const $$ = (selector: string | Element[] | NodeListOf<Element>): BQueryCollection => {
  if (Array.isArray(selector)) {
    return new BQueryCollection(selector);
  }
  if (selector instanceof NodeList) {
    return new BQueryCollection(Array.from(selector));
  }
  return new BQueryCollection(Array.from(document.querySelectorAll(selector)));
};
