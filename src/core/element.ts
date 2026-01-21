import { sanitizeHtml } from '../security/sanitize';
import { applyAll, toElementList } from './shared';

/**
 * Wrapper for a single DOM element.
 * Provides a chainable, jQuery-like API for DOM manipulation.
 *
 * This class encapsulates a DOM element and provides methods for:
 * - Class manipulation (addClass, removeClass, toggleClass)
 * - Attribute and property access (attr, prop, data)
 * - Content manipulation (text, html, append, prepend)
 * - Style manipulation (css)
 * - Event handling (on, off, once, trigger)
 * - DOM traversal (find, closest, parent, children, siblings)
 *
 * All mutating methods return `this` for method chaining.
 *
 * @example
 * ```ts
 * $('#button')
 *   .addClass('active')
 *   .css({ color: 'blue' })
 *   .on('click', () => console.log('clicked'));
 * ```
 */
export class BQueryElement {
  /**
   * Creates a new BQueryElement wrapper.
   * @param element - The DOM element to wrap
   */
  constructor(private readonly element: Element) {}

  /**
   * Exposes the raw DOM element when direct access is needed.
   * Use sparingly; prefer the wrapper methods for consistency.
   */
  get raw(): Element {
    return this.element;
  }

  /**
   * Exposes the underlying DOM element.
   * Provided for spec compatibility and read-only access.
   */
  get node(): Element {
    return this.element;
  }

  /** Add one or more classes. */
  addClass(...classNames: string[]): this {
    this.element.classList.add(...classNames);
    return this;
  }

  /** Remove one or more classes. */
  removeClass(...classNames: string[]): this {
    this.element.classList.remove(...classNames);
    return this;
  }

  /** Toggle a class by name. */
  toggleClass(className: string, force?: boolean): this {
    this.element.classList.toggle(className, force);
    return this;
  }

  /** Get or set an attribute. */
  attr(name: string, value?: string): string | this {
    if (value === undefined) {
      return this.element.getAttribute(name) ?? '';
    }
    this.element.setAttribute(name, value);
    return this;
  }

  /** Get or set a property. */
  prop<T extends keyof Element>(name: T, value?: Element[T]): Element[T] | this {
    if (value === undefined) {
      return this.element[name];
    }
    this.element[name] = value;
    return this;
  }

  /** Read or write data attributes in camelCase. */
  data(name: string, value?: string): string | this {
    const key = name.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
    if (value === undefined) {
      return this.element.getAttribute(`data-${key}`) ?? '';
    }
    this.element.setAttribute(`data-${key}`, value);
    return this;
  }

  /** Get or set text content. */
  text(value?: string): string | this {
    if (value === undefined) {
      return this.element.textContent ?? '';
    }
    this.element.textContent = value;
    return this;
  }

  /** Set HTML content using a sanitized string. */
  /**
   * Sets sanitized HTML content on the element.
   * Uses the security module to sanitize input and prevent XSS attacks.
   *
   * @param value - The HTML string to set (will be sanitized)
   * @returns The instance for method chaining
   *
   * @example
   * ```ts
   * $('#content').html('<strong>Hello</strong>');
   * ```
   */
  html(value: string): this {
    this.element.innerHTML = sanitizeHtml(value);
    return this;
  }

  /**
   * Sets HTML content without sanitization.
   * Use only when you trust the HTML source completely.
   *
   * @param value - The raw HTML string to set
   * @returns The instance for method chaining
   *
   * @warning This method bypasses XSS protection. Use with caution.
   */
  htmlUnsafe(value: string): this {
    this.element.innerHTML = value;
    return this;
  }

  /**
   * Gets or sets CSS styles on the element.
   *
   * @param property - A CSS property name or an object of property-value pairs
   * @param value - The value when setting a single property
   * @returns The instance for method chaining
   *
   * @example
   * ```ts
   * // Single property
   * $('#box').css('color', 'red');
   *
   * // Multiple properties
   * $('#box').css({ color: 'red', 'font-size': '16px' });
   * ```
   */
  css(property: string | Record<string, string>, value?: string): this {
    if (typeof property === 'string') {
      if (value !== undefined) {
        (this.element as HTMLElement).style.setProperty(property, value);
      }
      return this;
    }

    for (const [key, val] of Object.entries(property)) {
      (this.element as HTMLElement).style.setProperty(key, val);
    }
    return this;
  }

  /**
   * Appends HTML or elements to the end of the element.
   *
   * @param content - HTML string or element(s) to append
   * @returns The instance for method chaining
   */
  append(content: string | Element | Element[]): this {
    this.insertContent(content, 'beforeend');
    return this;
  }

  /**
   * Prepends HTML or elements to the beginning of the element.
   *
   * @param content - HTML string or element(s) to prepend
   * @returns The instance for method chaining
   */
  prepend(content: string | Element | Element[]): this {
    this.insertContent(content, 'afterbegin');
    return this;
  }

  /**
   * Inserts content before this element.
   *
   * @param content - HTML string or element(s) to insert
   * @returns The instance for method chaining
   */
  before(content: string | Element | Element[]): this {
    this.insertContent(content, 'beforebegin');
    return this;
  }

  /**
   * Inserts content after this element.
   *
   * @param content - HTML string or element(s) to insert
   * @returns The instance for method chaining
   */
  after(content: string | Element | Element[]): this {
    this.insertContent(content, 'afterend');
    return this;
  }

  /**
   * Removes the element from the DOM.
   *
   * @returns The instance for method chaining (though element is now detached)
   */
  remove(): this {
    this.element.remove();
    return this;
  }

  /**
   * Clears all child nodes from the element.
   *
   * @returns The instance for method chaining
   */
  empty(): this {
    this.element.innerHTML = '';
    return this;
  }

  /**
   * Clones the element, optionally with all descendants.
   *
   * @param deep - If true, clone all descendants (default: true)
   * @returns A new BQueryElement wrapping the cloned element
   */
  clone(deep: boolean = true): BQueryElement {
    return new BQueryElement(this.element.cloneNode(deep) as Element);
  }

  /**
   * Finds all descendant elements matching the selector.
   *
   * @param selector - CSS selector to match
   * @returns Array of matching elements
   */
  find(selector: string): Element[] {
    return Array.from(this.element.querySelectorAll(selector));
  }

  /**
   * Finds the first descendant element matching the selector.
   *
   * @param selector - CSS selector to match
   * @returns The first matching element or null
   */
  findOne(selector: string): Element | null {
    return this.element.querySelector(selector);
  }

  /**
   * Finds the closest ancestor matching the selector.
   *
   * @param selector - CSS selector to match
   * @returns The matching ancestor or null
   */
  closest(selector: string): Element | null {
    return this.element.closest(selector);
  }

  /**
   * Gets the parent element.
   *
   * @returns The parent element or null
   */
  parent(): Element | null {
    return this.element.parentElement;
  }

  /**
   * Gets all child elements.
   *
   * @returns Array of child elements
   */
  children(): Element[] {
    return Array.from(this.element.children);
  }

  /**
   * Gets all sibling elements.
   *
   * @returns Array of sibling elements (excluding this element)
   */
  siblings(): Element[] {
    const parent = this.element.parentElement;
    if (!parent) return [];
    return Array.from(parent.children).filter((child) => child !== this.element);
  }

  /**
   * Gets the next sibling element.
   *
   * @returns The next sibling element or null
   */
  next(): Element | null {
    return this.element.nextElementSibling;
  }

  /**
   * Gets the previous sibling element.
   *
   * @returns The previous sibling element or null
   */
  prev(): Element | null {
    return this.element.previousElementSibling;
  }

  /**
   * Adds an event listener.
   *
   * @param event - Event type to listen for
   * @param handler - Event handler function
   * @returns The instance for method chaining
   */
  on(event: string, handler: EventListenerOrEventListenerObject): this {
    this.element.addEventListener(event, handler);
    return this;
  }

  /**
   * Adds a one-time event listener that removes itself after firing.
   *
   * @param event - Event type to listen for
   * @param handler - Event handler function
   * @returns The instance for method chaining
   */
  once(event: string, handler: EventListener): this {
    this.element.addEventListener(event, handler, { once: true });
    return this;
  }

  /**
   * Removes an event listener.
   *
   * @param event - Event type
   * @param handler - The handler to remove
   * @returns The instance for method chaining
   */
  off(event: string, handler: EventListenerOrEventListenerObject): this {
    this.element.removeEventListener(event, handler);
    return this;
  }

  /**
   * Triggers a custom event on the element.
   *
   * @param event - Event type to trigger
   * @param detail - Optional detail data to include with the event
   * @returns The instance for method chaining
   */
  trigger(event: string, detail?: unknown): this {
    this.element.dispatchEvent(new CustomEvent(event, { detail, bubbles: true, cancelable: true }));
    return this;
  }

  /**
   * Checks if the element matches a CSS selector.
   *
   * @param selector - CSS selector to match against
   * @returns True if the element matches the selector
   */
  matches(selector: string): boolean {
    return this.element.matches(selector);
  }

  /**
   * Checks if the element has a specific class.
   *
   * @param className - Class name to check
   * @returns True if the element has the class
   */
  hasClass(className: string): boolean {
    return this.element.classList.contains(className);
  }

  /**
   * Shows the element by removing the hidden attribute and setting display.
   *
   * @param display - Optional display value (default: '')
   * @returns The instance for method chaining
   */
  show(display: string = ''): this {
    this.element.removeAttribute('hidden');
    (this.element as HTMLElement).style.display = display;
    return this;
  }

  /**
   * Hides the element by setting display to 'none'.
   *
   * @returns The instance for method chaining
   */
  hide(): this {
    (this.element as HTMLElement).style.display = 'none';
    return this;
  }

  /**
   * Toggles the visibility of the element.
   *
   * @param force - Optional force show (true) or hide (false)
   * @returns The instance for method chaining
   */
  toggle(force?: boolean): this {
    const isHidden = (this.element as HTMLElement).style.display === 'none';
    const shouldShow = force ?? isHidden;
    return shouldShow ? this.show() : this.hide();
  }

  /**
   * Focuses the element.
   *
   * @returns The instance for method chaining
   */
  focus(): this {
    (this.element as HTMLElement).focus();
    return this;
  }

  /**
   * Blurs (unfocuses) the element.
   *
   * @returns The instance for method chaining
   */
  blur(): this {
    (this.element as HTMLElement).blur();
    return this;
  }

  /**
   * Gets or sets the value of form elements.
   *
   * @param newValue - Optional value to set
   * @returns The current value when getting, or the instance when setting
   */
  val(newValue?: string): string | this {
    const input = this.element as HTMLInputElement;
    if (newValue === undefined) {
      return input.value ?? '';
    }
    input.value = newValue;
    return this;
  }

  /**
   * Gets the bounding client rectangle of the element.
   *
   * @returns The element's bounding rectangle
   */
  rect(): DOMRect {
    return this.element.getBoundingClientRect();
  }

  /**
   * Gets the offset dimensions (width, height, top, left).
   *
   * @returns Object with offset dimensions
   */
  offset(): { width: number; height: number; top: number; left: number } {
    const el = this.element as HTMLElement;
    return {
      width: el.offsetWidth,
      height: el.offsetHeight,
      top: el.offsetTop,
      left: el.offsetLeft,
    };
  }

  /**
   * Internal method to insert content at a specified position.
   * @internal
   */
  private insertContent(content: string | Element | Element[], position: InsertPosition) {
    if (typeof content === 'string') {
      this.element.insertAdjacentHTML(position, sanitizeHtml(content));
      return;
    }

    const elements = toElementList(content);
    applyAll(elements, (el) => {
      this.element.insertAdjacentElement(position, el);
    });
  }
}
