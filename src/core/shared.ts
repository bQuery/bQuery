/**
 * Shared helpers for element wrappers.
 */
export type ElementList = Element[];

/** Handler signature for delegated events */
export type DelegatedHandler = (event: Event, target: Element) => void;

/**
 * Delegated-listener registry shared by all wrapper instances and keyed by
 * the element itself, so a fresh `$`/`$$` wrapper can undelegate a listener
 * registered through an earlier one.
 * Outer map: element -> (key -> (handler -> wrapper))
 * Key format: `${event}:${selector}`
 * @internal
 */
const delegatedHandlers = new WeakMap<Element, Map<string, Map<DelegatedHandler, EventListener>>>();

/** @internal */
export const addDelegatedListener = (
  el: Element,
  event: string,
  selector: string,
  handler: DelegatedHandler
): void => {
  let elementHandlers = delegatedHandlers.get(el);
  if (!elementHandlers) {
    elementHandlers = new Map();
    delegatedHandlers.set(el, elementHandlers);
  }
  const key = `${event}:${selector}`;
  let handlers = elementHandlers.get(key);
  if (!handlers) {
    handlers = new Map();
    elementHandlers.set(key, handlers);
  }
  // Re-delegating the same handler for the same key keeps a single listener.
  if (handlers.has(handler)) {
    return;
  }

  const wrapper: EventListener = (e: Event) => {
    const eventTarget = e.target;
    // e.target can be a Text node, the document, or null (synthetic events).
    if (!eventTarget || (eventTarget as Node).nodeType !== 1) {
      return;
    }
    const target = (eventTarget as Element).closest(selector);
    if (target && el.contains(target)) {
      handler(e, target);
    }
  };

  handlers.set(handler, wrapper);
  el.addEventListener(event, wrapper);
};

/** @internal */
export const removeDelegatedListener = (
  el: Element,
  event: string,
  selector: string,
  handler: DelegatedHandler
): void => {
  const elementHandlers = delegatedHandlers.get(el);
  if (!elementHandlers) return;

  const key = `${event}:${selector}`;
  const handlers = elementHandlers.get(key);
  if (!handlers) return;

  const wrapper = handlers.get(handler);
  if (!wrapper) return;

  el.removeEventListener(event, wrapper);
  handlers.delete(handler);

  // Clean up empty maps
  if (handlers.size === 0) {
    elementHandlers.delete(key);
  }
  if (elementHandlers.size === 0) {
    delegatedHandlers.delete(el);
  }
};

export const toElementList = (input: Element | ElementList): ElementList =>
  Array.isArray(input) ? input : [input];

export const applyAll = (elements: ElementList, action: (el: Element) => void) => {
  for (const el of elements) {
    action(el);
  }
};

/** @internal */
export const isHTMLElement = (element: Element | null | undefined): element is HTMLElement => {
  if (!element) {
    return false;
  }

  const view = element.ownerDocument?.defaultView;
  const HTMLElementCtor = view?.HTMLElement ?? globalThis.HTMLElement;
  return typeof HTMLElementCtor === 'function' && element instanceof HTMLElementCtor;
};

/**
 * Gets an element's inner size (content + padding, excluding border and margin).
 *
 * @internal
 */
export const getInnerSize = (
  element: Element | null | undefined,
  dimension: 'width' | 'height'
): number => {
  if (!isHTMLElement(element)) {
    return 0;
  }
  return dimension === 'width' ? element.clientWidth : element.clientHeight;
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
