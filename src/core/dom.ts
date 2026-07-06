import { sanitizeHtml } from '../security/sanitize';
import { trustedHtmlForSink } from '../security/trusted-types';
import { applyAll, toElementList } from './shared';

export type InsertableContent = string | Element | Element[];

export const sanitizeContent = (html: string): string => sanitizeHtml(html);

export const setHtml = (element: Element, html: string): void => {
  element.innerHTML = trustedHtmlForSink(html);
};

export const createElementFromHtml = (html: string): Element => {
  const template = document.createElement('template');
  template.innerHTML = trustedHtmlForSink(html);
  return template.content.firstElementChild ?? document.createElement('div');
};

export const insertContent = (
  target: Element,
  content: InsertableContent,
  position: InsertPosition
): void => {
  if (typeof content === 'string') {
    target.insertAdjacentHTML(position, trustedHtmlForSink(content));
    return;
  }

  const elements = toElementList(content);

  // For positions that insert at the beginning (afterbegin, afterend), reverse
  // the array to maintain the caller's order. For beforeend/beforebegin, keep order.
  const needsReverse = position === 'afterbegin' || position === 'afterend';
  const orderedElements = needsReverse ? elements.slice().reverse() : elements;

  applyAll(orderedElements, (el) => {
    target.insertAdjacentElement(position, el);
  });
};
