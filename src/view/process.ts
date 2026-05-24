import type { CleanupFn } from '../reactive/index';
import { detectDevEnvironment } from '../core/env';
import { getCustomDirective } from './custom-directives';
import { parseDirective } from './parse-directive';
import type { BindingContext, DirectiveHandler } from './types';

export type DirectiveHandlers = {
  text: DirectiveHandler;
  error: DirectiveHandler;
  aria: DirectiveHandler;
  html: DirectiveHandler;
  htmlSafe: DirectiveHandler;
  if: DirectiveHandler;
  show: DirectiveHandler;
  class: DirectiveHandler;
  style: DirectiveHandler;
  model: DirectiveHandler;
  ref: DirectiveHandler;
  for: DirectiveHandler;
  once: DirectiveHandler;
  init: DirectiveHandler;
  memo: DirectiveHandler;
  bind: (attrName: string) => DirectiveHandler;
  on: (eventName: string, modifiers?: Set<string>) => DirectiveHandler;
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
  // bq-pre: skip directive processing entirely for this element and its
  // descendants. Honor it before reading any other attributes so the marker
  // remains an escape hatch with predictable semantics.
  if (el.hasAttribute(`${prefix}-pre`)) {
    el.removeAttribute(`${prefix}-pre`);
    return;
  }

  // bq-cloak: remove the marker once mount reaches the element. Authors use
  // `[bq-cloak] { display: none }` to hide pre-hydration markup.
  if (el.hasAttribute(`${prefix}-cloak`)) {
    el.removeAttribute(`${prefix}-cloak`);
  }

  const attributes = Array.from(el.attributes);

  for (const attr of attributes) {
    const { name: attributeName, value } = attr;

    if (!attributeName.startsWith(`${prefix}-`)) continue;

    const rawDirective = attributeName.slice(prefix.length + 1); // Remove prefix and dash
    const { directive, arg, modifiers } = parseDirective(rawDirective);

    // Handle bq-for specially (creates new scope)
    if (directive === 'for') {
      handlers.for(el, value, context, cleanups);
      return; // Don't process children, bq-for handles it
    }

    // Handle other directives
    if (directive === 'text') {
      handlers.text(el, value, context, cleanups);
    } else if (directive === 'error') {
      handlers.error(el, value, context, cleanups);
    } else if (directive === 'aria') {
      handlers.aria(el, value, context, cleanups);
    } else if (directive === 'html') {
      handlers.html(el, value, context, cleanups);
    } else if (directive === 'html-safe') {
      handlers.htmlSafe(el, value, context, cleanups);
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
    } else if (directive === 'once') {
      handlers.once(el, value, context, cleanups);
    } else if (directive === 'init') {
      handlers.init(el, value, context, cleanups);
    } else if (directive === 'memo') {
      handlers.memo(el, value, context, cleanups);
    } else if (directive === 'bind' && arg) {
      handlers.bind(arg)(el, value, context, cleanups);
    } else if (directive === 'on' && arg) {
      handlers.on(arg, modifiers)(el, value, context, cleanups);
    } else {
      // Check for custom directives registered via plugins. Custom directive
      // names are matched against the directive head (without modifiers), to
      // keep the API back-compatible.
      const customHandler = getCustomDirective(rawDirective) || getCustomDirective(directive);
      if (customHandler) {
        customHandler(el, value, context, cleanups);
      } else if (
        detectDevEnvironment() &&
        typeof console !== 'undefined' &&
        typeof console.warn === 'function'
      ) {
        console.warn(
          `[bQuery][view] Unknown directive "${attributeName}" (parsed as "${directive}") on <${el.tagName.toLowerCase()}>. This may be a typo or a missing custom directive registration.`
        );
      }
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
    // Skip descendants of bq-pre subtrees entirely. processElement also
    // removes the marker and returns without touching this child's attrs.
    if (child.hasAttribute(`${prefix}-pre`)) {
      processElement(child, context, prefix, cleanups, handlers);
      continue;
    }
    // Skip if element has bq-for (handled separately)
    if (!child.hasAttribute(`${prefix}-for`)) {
      processElement(child, context, prefix, cleanups, handlers);
      processChildren(child, context, prefix, cleanups, handlers);
    } else {
      processElement(child, context, prefix, cleanups, handlers);
    }
  }
};
