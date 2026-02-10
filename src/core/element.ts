import { createElementFromHtml, insertContent, setHtml } from './dom';

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
/** Handler signature for delegated events */
type DelegatedHandler = (event: Event, target: Element) => void;

export class BQueryElement {
  /**
   * Stores delegated event handlers for cleanup via undelegate().
   * Key format: `${event}:${selector}`
   * @internal
   */
  private readonly delegatedHandlers = new Map<string, Map<DelegatedHandler, EventListener>>();

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

  /** Remove an attribute. */
  removeAttr(name: string): this {
    this.element.removeAttribute(name);
    return this;
  }

  /** Toggle an attribute on/off. */
  toggleAttr(name: string, force?: boolean): this {
    const hasAttr = this.element.hasAttribute(name);
    const shouldAdd = force ?? !hasAttr;
    if (shouldAdd) {
      this.element.setAttribute(name, '');
    } else {
      this.element.removeAttribute(name);
    }
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
    setHtml(this.element, value);
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
   * @returns The computed style value when getting a single property, or the instance for method chaining when setting
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
  css(property: string, value?: string): string | this;
  css(property: Record<string, string>): this;
  css(property: string | Record<string, string>, value?: string): string | this {
    if (typeof property === 'string') {
      if (value !== undefined) {
        (this.element as HTMLElement).style.setProperty(property, value);
        return this;
      }
      const view = this.element.ownerDocument?.defaultView;
      if (!view || typeof view.getComputedStyle !== 'function') {
        return '';
      }
      return view.getComputedStyle(this.element).getPropertyValue(property);
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
   * Wraps the element with the specified wrapper element or tag.
   *
   * @param wrapper - Tag name string or Element to wrap with
   * @returns The instance for method chaining
   *
   * @example
   * ```ts
   * $('#content').wrap('div'); // Wraps with <div>
   * $('#content').wrap(document.createElement('section'));
   * ```
   */
  wrap(wrapper: string | Element): this {
    const wrapperEl = typeof wrapper === 'string' ? document.createElement(wrapper) : wrapper;
    this.element.parentNode?.insertBefore(wrapperEl, this.element);
    wrapperEl.appendChild(this.element);
    return this;
  }

  /**
   * Removes the parent element, keeping this element in its place.
   * Essentially the opposite of wrap().
   *
   * **Important**: This method only moves the current element out of its parent
   * before removing the parent. Any sibling elements will be removed along with
   * the parent. For unwrapping multiple siblings, use a collection: `$$(siblings).unwrap()`.
   *
   * @returns The instance for method chaining
   *
   * @example
   * ```ts
   * // Before: <div><span id="text">Hello</span></div>
   * $('#text').unwrap();
   * // After: <span id="text">Hello</span>
   * ```
   */
  unwrap(): this {
    const parent = this.element.parentElement;
    if (parent && parent.parentNode) {
      parent.parentNode.insertBefore(this.element, parent);
      parent.remove();
    }
    return this;
  }

  /**
   * Replaces this element with new content.
   *
   * @param content - HTML string (sanitized) or Element to replace with
   * @returns A new BQueryElement wrapping the replacement element
   *
   * @example
   * ```ts
   * const newEl = $('#old').replaceWith('<div id="new">Replaced</div>');
   * ```
   */
  replaceWith(content: string | Element): BQueryElement {
    const newEl = typeof content === 'string' ? createElementFromHtml(content) : content;
    this.element.replaceWith(newEl);
    return new BQueryElement(newEl);
  }

  /**
   * Scrolls the element into view with configurable behavior.
   *
   * @param options - ScrollIntoView options or boolean for legacy behavior
   * @returns The instance for method chaining
   *
   * @example
   * ```ts
   * $('#section').scrollTo(); // Smooth scroll
   * $('#section').scrollTo({ behavior: 'instant', block: 'start' });
   * ```
   */
  scrollTo(options: ScrollIntoViewOptions | boolean = { behavior: 'smooth' }): this {
    this.element.scrollIntoView(options);
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
   * Adds a delegated event listener that only triggers for matching descendants.
   * More efficient than adding listeners to many elements individually.
   *
   * Use `undelegate()` to remove the listener later.
   *
   * @param event - Event type to listen for
   * @param selector - CSS selector to match against event targets
   * @param handler - Event handler function, receives the matched element as context
   * @returns The instance for method chaining
   *
   * @example
   * ```ts
   * // Instead of adding listeners to each button:
   * const handler = (e, target) => console.log('Clicked:', target.textContent);
   * $('#list').delegate('click', '.item', handler);
   *
   * // Later, remove the delegated listener:
   * $('#list').undelegate('click', '.item', handler);
   * ```
   */
  delegate(
    event: string,
    selector: string,
    handler: (event: Event, target: Element) => void
  ): this {
    const key = `${event}:${selector}`;
    const wrapper: EventListener = (e: Event) => {
      const target = (e.target as Element).closest(selector);
      if (target && this.element.contains(target)) {
        handler(e, target);
      }
    };

    // Store the wrapper so it can be removed later
    if (!this.delegatedHandlers.has(key)) {
      this.delegatedHandlers.set(key, new Map());
    }
    this.delegatedHandlers.get(key)!.set(handler, wrapper);

    this.element.addEventListener(event, wrapper);
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
   * $('#list').delegate('click', '.item', handler);
   *
   * // Remove the delegated listener:
   * $('#list').undelegate('click', '.item', handler);
   * ```
   */
  undelegate(
    event: string,
    selector: string,
    handler: (event: Event, target: Element) => void
  ): this {
    const key = `${event}:${selector}`;
    const handlers = this.delegatedHandlers.get(key);

    if (handlers) {
      const wrapper = handlers.get(handler);
      if (wrapper) {
        this.element.removeEventListener(event, wrapper);
        handlers.delete(handler);

        // Clean up empty maps
        if (handlers.size === 0) {
          this.delegatedHandlers.delete(key);
        }
      }
    }

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
   * Alias for `matches()`. Checks if the element matches a CSS selector.
   *
   * @param selector - CSS selector to match against
   * @returns True if the element matches the selector
   *
   * @example
   * ```ts
   * if ($('#el').is('.active')) {
   *   console.log('Element is active');
   * }
   * ```
   */
  is(selector: string): boolean {
    return this.matches(selector);
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
   * Serializes form data to a plain object.
   * Only works on form elements; returns empty object for non-forms.
   *
   * @returns Object with form field names as keys and values
   *
   * @example
   * ```ts
   * // For a form with <input name="email" value="test@example.com">
   * const data = $('#myForm').serialize();
   * // { email: 'test@example.com' }
   * ```
   */
  serialize(): Record<string, string | string[]> {
    const form = this.element as HTMLFormElement;
    if (form.tagName.toLowerCase() !== 'form') {
      return {};
    }

    const result: Record<string, string | string[]> = {};
    const formData = new FormData(form);

    for (const [key, value] of formData.entries()) {
      if (typeof value !== 'string') continue; // Skip File objects

      if (key in result) {
        // Handle multiple values (e.g., checkboxes)
        const existing = result[key];
        if (Array.isArray(existing)) {
          existing.push(value);
        } else {
          result[key] = [existing, value];
        }
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Serializes form data to a URL-encoded query string.
   *
   * @returns URL-encoded string suitable for form submission
   *
   * @example
   * ```ts
   * const queryString = $('#myForm').serializeString();
   * // 'email=test%40example.com&name=John'
   * ```
   */
  serializeString(): string {
    const form = this.element as HTMLFormElement;
    if (form.tagName.toLowerCase() !== 'form') {
      return '';
    }

    const formData = new FormData(form);
    const params = new URLSearchParams();

    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') {
        params.append(key, value);
      }
    }

    return params.toString();
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
    insertContent(this.element, content, position);
  }
}
