import {
  createElementFromHtml,
  insertContent,
  sanitizeContent,
  type InsertableContent,
} from './dom';
import { BQueryElement } from './element';
import { applyAll, toElementList } from './shared';

/** Handler signature for delegated events */
type DelegatedHandler = (event: Event, target: Element) => void;

/**
 * Wrapper for multiple DOM elements.
 * Provides batch operations on a collection of elements with chainable API.
 *
 * This class enables jQuery-like operations across multiple elements:
 * - All mutating methods apply to every element in the collection
 * - Getter methods return data from the first element
 * - Supports iteration via forEach, map, filter, and reduce
 *
 * @example
 * ```ts
 * $$('.items')
 *   .addClass('highlight')
 *   .css({ opacity: '0.8' })
 *   .on('click', () => console.log('clicked'));
 * ```
 */
export class BQueryCollection {
  /**
   * Stores delegated event handlers for cleanup via undelegate().
   * Outer map: element -> (key -> (handler -> wrapper))
   * Key format: `${event}:${selector}`
   * @internal
   */
  private readonly delegatedHandlers = new WeakMap<
    Element,
    Map<string, Map<DelegatedHandler, EventListener>>
  >();

  /**
   * Creates a new collection wrapper.
   * @param elements - Array of DOM elements to wrap
   */
  constructor(public readonly elements: Element[]) {}

  /**
   * Gets the number of elements in the collection.
   */
  get length(): number {
    return this.elements.length;
  }

  /**
   * Gets the first element in the collection, if any.
   * @internal
   */
  private first(): Element | undefined {
    return this.elements[0];
  }

  /**
   * Gets a single element as a BQueryElement wrapper.
   *
   * @param index - Zero-based index of the element
   * @returns BQueryElement wrapper or undefined if out of range
   */
  eq(index: number): BQueryElement | undefined {
    const el = this.elements[index];
    return el ? new BQueryElement(el) : undefined;
  }

  /**
   * Gets the first element as a BQueryElement wrapper.
   *
   * @returns BQueryElement wrapper or undefined if empty
   */
  firstEl(): BQueryElement | undefined {
    return this.eq(0);
  }

  /**
   * Gets the last element as a BQueryElement wrapper.
   *
   * @returns BQueryElement wrapper or undefined if empty
   */
  lastEl(): BQueryElement | undefined {
    return this.eq(this.elements.length - 1);
  }

  /**
   * Iterates over each element in the collection.
   *
   * @param callback - Function to call for each wrapped element
   * @returns The instance for method chaining
   */
  each(callback: (element: BQueryElement, index: number) => void): this {
    this.elements.forEach((element, index) => {
      callback(new BQueryElement(element), index);
    });
    return this;
  }

  /**
   * Maps each element to a new value.
   *
   * @param callback - Function to transform each element
   * @returns Array of transformed values
   */
  map<T>(callback: (element: Element, index: number) => T): T[] {
    return this.elements.map(callback);
  }

  /**
   * Filters elements based on a predicate.
   *
   * @param predicate - Function to test each element
   * @returns New BQueryCollection with matching elements
   */
  filter(predicate: (element: Element, index: number) => boolean): BQueryCollection {
    return new BQueryCollection(this.elements.filter(predicate));
  }

  /**
   * Reduces the collection to a single value.
   *
   * @param callback - Reducer function
   * @param initialValue - Initial accumulator value
   * @returns Accumulated result
   */
  reduce<T>(callback: (accumulator: T, element: Element, index: number) => T, initialValue: T): T {
    return this.elements.reduce(callback, initialValue);
  }

  /**
   * Converts the collection to an array of BQueryElement wrappers.
   *
   * @returns Array of BQueryElement instances
   */
  toArray(): BQueryElement[] {
    return this.elements.map((el) => new BQueryElement(el));
  }

  /** Add one or more classes to all elements. */
  addClass(...classNames: string[]): this {
    applyAll(this.elements, (el) => el.classList.add(...classNames));
    return this;
  }

  /** Remove one or more classes from all elements. */
  removeClass(...classNames: string[]): this {
    applyAll(this.elements, (el) => el.classList.remove(...classNames));
    return this;
  }

  /** Toggle a class on all elements. */
  toggleClass(className: string, force?: boolean): this {
    applyAll(this.elements, (el) => el.classList.toggle(className, force));
    return this;
  }

  /**
   * Sets an attribute on all elements or gets from first.
   *
   * @param name - Attribute name
   * @param value - Value to set (optional)
   * @returns Attribute value when getting, instance when setting
   */
  attr(name: string, value?: string): string | this {
    if (value === undefined) {
      return this.first()?.getAttribute(name) ?? '';
    }
    applyAll(this.elements, (el) => el.setAttribute(name, value));
    return this;
  }

  /**
   * Removes an attribute from all elements.
   *
   * @param name - Attribute name to remove
   * @returns The instance for method chaining
   */
  removeAttr(name: string): this {
    applyAll(this.elements, (el) => el.removeAttribute(name));
    return this;
  }

  /** Toggle an attribute on all elements. */
  toggleAttr(name: string, force?: boolean): this {
    applyAll(this.elements, (el) => {
      const hasAttr = el.hasAttribute(name);
      const shouldAdd = force ?? !hasAttr;
      if (shouldAdd) {
        el.setAttribute(name, '');
      } else {
        el.removeAttribute(name);
      }
    });
    return this;
  }

  /**
   * Sets text content on all elements or gets from first.
   *
   * @param value - Text to set (optional)
   * @returns Text content when getting, instance when setting
   */
  text(value?: string): string | this {
    if (value === undefined) {
      return this.first()?.textContent ?? '';
    }
    applyAll(this.elements, (el) => {
      el.textContent = value;
    });
    return this;
  }

  /**
   * Sets sanitized HTML on all elements or gets from first.
   *
   * @param value - HTML to set (optional, will be sanitized)
   * @returns HTML content when getting, instance when setting
   */
  html(value?: string): string | this {
    if (value === undefined) {
      return this.first()?.innerHTML ?? '';
    }
    const sanitized = sanitizeContent(value);
    applyAll(this.elements, (el) => {
      el.innerHTML = sanitized;
    });
    return this;
  }

  /**
   * Sets HTML on all elements without sanitization.
   *
   * @param value - Raw HTML to set
   * @returns The instance for method chaining
   * @warning Bypasses XSS protection
   */
  htmlUnsafe(value: string): this {
    applyAll(this.elements, (el) => {
      el.innerHTML = value;
    });
    return this;
  }

  /** Append content to all elements. */
  append(content: InsertableContent): this {
    this.insertAll(content, 'beforeend');
    return this;
  }

  /** Prepend content to all elements. */
  prepend(content: InsertableContent): this {
    this.insertAll(content, 'afterbegin');
    return this;
  }

  /** Insert content before all elements. */
  before(content: InsertableContent): this {
    this.insertAll(content, 'beforebegin');
    return this;
  }

  /** Insert content after all elements. */
  after(content: InsertableContent): this {
    this.insertAll(content, 'afterend');
    return this;
  }

  /**
   * Applies CSS styles to all elements.
   *
   * @param property - Property name or object of properties
   * @param value - Value when setting single property
   * @returns The instance for method chaining
   */
  css(property: string | Record<string, string>, value?: string): this {
    if (typeof property === 'string') {
      if (value !== undefined) {
        applyAll(this.elements, (el) => {
          (el as HTMLElement).style.setProperty(property, value);
        });
      }
      return this;
    }

    applyAll(this.elements, (el) => {
      for (const [key, val] of Object.entries(property)) {
        (el as HTMLElement).style.setProperty(key, val);
      }
    });
    return this;
  }

  /** Wrap each element with a wrapper element or tag. */
  wrap(wrapper: string | Element): this {
    this.elements.forEach((el, index) => {
      const wrapperEl =
        typeof wrapper === 'string'
          ? document.createElement(wrapper)
          : index === 0
            ? wrapper
            : (wrapper.cloneNode(true) as Element);
      el.parentNode?.insertBefore(wrapperEl, el);
      wrapperEl.appendChild(el);
    });
    return this;
  }

  /** Remove the parent element of each element, keeping the elements in place. */
  unwrap(): this {
    // Collect unique parent elements to avoid removing the same parent multiple times.
    const parents = new Set<Element>();
    for (const el of this.elements) {
      if (el.parentElement) {
        parents.add(el.parentElement);
      }
    }

    // Unwrap each parent once: move all children out, then remove the wrapper.
    parents.forEach((parent) => {
      const grandParent = parent.parentNode;
      if (!grandParent) return;

      while (parent.firstChild) {
        grandParent.insertBefore(parent.firstChild, parent);
      }

      parent.remove();
    });
    return this;
  }

  /** Replace each element with provided content. */
  replaceWith(content: string | Element): BQueryCollection {
    const replacements: Element[] = [];
    this.elements.forEach((el, index) => {
      const replacement =
        typeof content === 'string'
          ? createElementFromHtml(content)
          : index === 0
            ? content
            : (content.cloneNode(true) as Element);
      el.replaceWith(replacement);
      replacements.push(replacement);
    });
    return new BQueryCollection(replacements);
  }

  /**
   * Shows all elements.
   *
   * @param display - Optional display value (default: '')
   * @returns The instance for method chaining
   */
  show(display: string = ''): this {
    applyAll(this.elements, (el) => {
      el.removeAttribute('hidden');
      (el as HTMLElement).style.display = display;
    });
    return this;
  }

  /**
   * Hides all elements.
   *
   * @returns The instance for method chaining
   */
  hide(): this {
    applyAll(this.elements, (el) => {
      (el as HTMLElement).style.display = 'none';
    });
    return this;
  }

  /**
   * Adds an event listener to all elements.
   *
   * @param event - Event type
   * @param handler - Event handler
   * @returns The instance for method chaining
   */
  on(event: string, handler: EventListenerOrEventListenerObject): this {
    applyAll(this.elements, (el) => el.addEventListener(event, handler));
    return this;
  }

  /**
   * Adds a one-time event listener to all elements.
   *
   * @param event - Event type
   * @param handler - Event handler
   * @returns The instance for method chaining
   */
  once(event: string, handler: EventListener): this {
    applyAll(this.elements, (el) => el.addEventListener(event, handler, { once: true }));
    return this;
  }

  /**
   * Removes an event listener from all elements.
   *
   * @param event - Event type
   * @param handler - The handler to remove
   * @returns The instance for method chaining
   */
  off(event: string, handler: EventListenerOrEventListenerObject): this {
    applyAll(this.elements, (el) => el.removeEventListener(event, handler));
    return this;
  }

  /**
   * Triggers a custom event on all elements.
   *
   * @param event - Event type
   * @param detail - Optional event detail
   * @returns The instance for method chaining
   */
  trigger(event: string, detail?: unknown): this {
    applyAll(this.elements, (el) => {
      el.dispatchEvent(new CustomEvent(event, { detail, bubbles: true, cancelable: true }));
    });
    return this;
  }

  /**
   * Adds a delegated event listener to all elements.
   * Events are delegated to matching descendants.
   *
   * Use `undelegate()` to remove the listener later.
   *
   * @param event - Event type to listen for
   * @param selector - CSS selector to match against event targets
   * @param handler - Event handler function
   * @returns The instance for method chaining
   *
   * @example
   * ```ts
   * const handler = (e, target) => console.log('Clicked:', target.textContent);
   * $$('.container').delegate('click', '.item', handler);
   *
   * // Later, remove the delegated listener:
   * $$('.container').undelegate('click', '.item', handler);
   * ```
   */
  delegate(
    event: string,
    selector: string,
    handler: (event: Event, target: Element) => void
  ): this {
    const key = `${event}:${selector}`;

    applyAll(this.elements, (el) => {
      const wrapper: EventListener = (e: Event) => {
        const target = (e.target as Element).closest(selector);
        if (target && el.contains(target)) {
          handler(e, target);
        }
      };

      // Get or create the handler maps for this element
      if (!this.delegatedHandlers.has(el)) {
        this.delegatedHandlers.set(el, new Map());
      }
      const elementHandlers = this.delegatedHandlers.get(el)!;

      if (!elementHandlers.has(key)) {
        elementHandlers.set(key, new Map());
      }
      elementHandlers.get(key)!.set(handler, wrapper);

      el.addEventListener(event, wrapper);
    });

    return this;
  }

  /**
   * Removes a delegated event listener previously added with `delegate()`.
   *
   * @param event - Event type that was registered
   * @param selector - CSS selector that was used
   * @param handler - The original handler function passed to delegate()
   * @returns The instance for method chaining
   *
   * @example
   * ```ts
   * const handler = (e, target) => console.log('Clicked:', target.textContent);
   * $$('.container').delegate('click', '.item', handler);
   *
   * // Remove the delegated listener:
   * $$('.container').undelegate('click', '.item', handler);
   * ```
   */
  undelegate(
    event: string,
    selector: string,
    handler: (event: Event, target: Element) => void
  ): this {
    const key = `${event}:${selector}`;

    applyAll(this.elements, (el) => {
      const elementHandlers = this.delegatedHandlers.get(el);
      if (!elementHandlers) return;

      const handlers = elementHandlers.get(key);
      if (!handlers) return;

      const wrapper = handlers.get(handler);
      if (wrapper) {
        el.removeEventListener(event, wrapper);
        handlers.delete(handler);

        // Clean up empty maps
        if (handlers.size === 0) {
          elementHandlers.delete(key);
        }
        if (elementHandlers.size === 0) {
          this.delegatedHandlers.delete(el);
        }
      }
    });

    return this;
  }

  /**
   * Removes all elements from the DOM.
   *
   * @returns The instance for method chaining
   */
  remove(): this {
    applyAll(this.elements, (el) => el.remove());
    return this;
  }

  /**
   * Clears all child nodes from all elements.
   *
   * @returns The instance for method chaining
   */
  empty(): this {
    applyAll(this.elements, (el) => {
      el.innerHTML = '';
    });
    return this;
  }

  /** @internal */
  private insertAll(content: InsertableContent, position: InsertPosition): void {
    if (typeof content === 'string') {
      applyAll(this.elements, (el) => insertContent(el, content, position));
      return;
    }

    const elements = toElementList(content);
    this.elements.forEach((el, index) => {
      const nodes =
        index === 0 ? elements : elements.map((node) => node.cloneNode(true) as Element);
      insertContent(el, nodes, position);
    });
  }
}
