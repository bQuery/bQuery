import { sanitizeHtml } from '../security/sanitize';
import { applyAll, toElementList } from './shared';

export type InsertableContent = string | Element | Element[];

export const sanitizeContent = (html: string): string => sanitizeHtml(html);

export const setHtml = (element: Element, html: string): void => {
  element.innerHTML = sanitizeHtml(html);
};

export const createElementFromHtml = (html: string): Element => {
  const template = document.createElement('template');
  template.innerHTML = sanitizeHtml(html);
  return template.content.firstElementChild ?? document.createElement('div');
};

export const insertContent = (
  target: Element,
  content: InsertableContent,
  position: InsertPosition
): void => {
  if (typeof content === 'string') {
    target.insertAdjacentHTML(position, sanitizeHtml(content));
    return;
  }

  const elements = toElementList(content);
  
  // For positions that insert before/at-start, reverse the array to maintain order
  // since each insertAdjacentElement is relative to the target
  const orderedElements =
    position === 'beforebegin' || position === 'afterbegin'
      ? elements.slice().reverse()
      : elements;

  applyAll(orderedElements, (el) => {
    target.insertAdjacentElement(position, el);
  });
};
