import type { CleanupFn } from '../reactive/index';
import type { BindingContext, DirectiveHandler } from './types';

export type DirectiveHandlers = {
  text: DirectiveHandler;
  html: DirectiveHandler;
  if: DirectiveHandler;
  show: DirectiveHandler;
  class: DirectiveHandler;
  style: DirectiveHandler;
  model: DirectiveHandler;
  ref: DirectiveHandler;
  for: DirectiveHandler;
  bind: (attrName: string) => DirectiveHandler;
  on: (eventName: string) => DirectiveHandler;
};

/**
 * Processes a single element for directives.
 * @internal
 */
export const processElement = (
  el: Element,
  context: BindingContext,
  prefix: string,
  cleanups: CleanupFn[],
  handlers: DirectiveHandlers
): void => {
  const attributes = Array.from(el.attributes);

  for (const attr of attributes) {
    const { name, value } = attr;

    if (!name.startsWith(`${prefix}-`)) continue;

    const directive = name.slice(prefix.length + 1); // Remove prefix and dash

    // Handle bq-for specially (creates new scope)
    if (directive === 'for') {
      handlers.for(el, value, context, cleanups);
      return; // Don't process children, bq-for handles it
    }

    // Handle other directives
    if (directive === 'text') {
      handlers.text(el, value, context, cleanups);
    } else if (directive === 'html') {
      handlers.html(el, value, context, cleanups);
    } else if (directive === 'if') {
      handlers.if(el, value, context, cleanups);
    } else if (directive === 'show') {
      handlers.show(el, value, context, cleanups);
    } else if (directive === 'class') {
      handlers.class(el, value, context, cleanups);
    } else if (directive === 'style') {
      handlers.style(el, value, context, cleanups);
    } else if (directive === 'model') {
      handlers.model(el, value, context, cleanups);
    } else if (directive === 'ref') {
      handlers.ref(el, value, context, cleanups);
    } else if (directive.startsWith('bind:')) {
      const attrName = directive.slice(5);
      handlers.bind(attrName)(el, value, context, cleanups);
    } else if (directive.startsWith('on:')) {
      const eventName = directive.slice(3);
      handlers.on(eventName)(el, value, context, cleanups);
    }
  }
};

/**
 * Recursively processes children of an element.
 * @internal
 */
export const processChildren = (
  el: Element,
  context: BindingContext,
  prefix: string,
  cleanups: CleanupFn[],
  handlers: DirectiveHandlers
): void => {
  const children = Array.from(el.children);
  for (const child of children) {
    // Skip if element has bq-for (handled separately)
    if (!child.hasAttribute(`${prefix}-for`)) {
      processElement(child, context, prefix, cleanups, handlers);
      processChildren(child, context, prefix, cleanups, handlers);
    } else {
      processElement(child, context, prefix, cleanups, handlers);
    }
  }
};
