/**
 * Declarative DOM bindings via data attributes.
 *
 * This module provides Vue/Svelte-style template directives without
 * requiring a compiler. Bindings are evaluated at runtime using
 * bQuery's reactive system. Features include:
 * - Conditional rendering (bq-if)
 * - List rendering (bq-for)
 * - Two-way binding (bq-model)
 * - Class binding (bq-class)
 * - Text/HTML binding (bq-text, bq-html)
 * - Attribute binding (bq-bind)
 * - Event binding (bq-on)
 *
 * ## Security Considerations
 *
 * **WARNING:** This module uses `new Function()` to evaluate expressions at runtime.
 * This is similar to Vue/Alpine's approach but carries inherent security risks:
 *
 * - **NEVER** use expressions derived from user input or untrusted sources
 * - Expressions should only come from developer-controlled templates
 * - The context object should not contain sensitive data that could be exfiltrated
 * - For user-generated content, use static bindings with sanitized values instead
 *
 * Since bQuery is runtime-only (no build-time compilation), expressions are evaluated
 * dynamically. If your application loads templates from external sources (APIs, databases),
 * ensure they are trusted and validated before mounting.
 *
 * @module bquery/view
 *
 * @example
 * ```html
 * <div id="app">
 *   <input bq-model="name" />
 *   <p bq-text="greeting"></p>
 *   <ul>
 *     <li bq-for="item in items" bq-text="item.name"></li>
 *   </ul>
 *   <button bq-on:click="handleClick">Click me</button>
 *   <div bq-if="showDetails" bq-class="{ active: isActive }">
 *     Details here
 *   </div>
 * </div>
 * ```
 *
 * ```ts
 * import { mount } from 'bquery/view';
 * import { signal } from 'bquery/reactive';
 *
 * mount('#app', {
 *   name: signal('World'),
 *   greeting: computed(() => `Hello, ${name.value}!`),
 *   items: signal([{ name: 'Item 1' }, { name: 'Item 2' }]),
 *   showDetails: signal(true),
 *   isActive: signal(false),
 *   handleClick: () => console.log('Clicked!'),
 * });
 * ```
 */

import { effect, isComputed, isSignal, type CleanupFn, type Signal } from '../reactive/index';
import { sanitizeHtml } from '../security/index';

// ============================================================================
// Types
// ============================================================================

/**
 * Context object passed to binding expressions.
 */
export type BindingContext = Record<string, unknown>;

/**
 * Configuration options for mount.
 */
export type MountOptions = {
  /** Prefix for directive attributes (default: 'bq') */
  prefix?: string;
  /** Whether to sanitize bq-html content (default: true) */
  sanitize?: boolean;
};

/**
 * Mounted view instance.
 */
export type View = {
  /** The root element */
  el: Element;
  /** The binding context */
  context: BindingContext;
  /** Update the context and re-render */
  update: (newContext: Partial<BindingContext>) => void;
  /** Destroy the view and cleanup effects */
  destroy: () => void;
};

/**
 * Internal directive handler type.
 * @internal
 */
type DirectiveHandler = (
  el: Element,
  expression: string,
  context: BindingContext,
  cleanups: CleanupFn[]
) => void;

// ============================================================================
// Expression Evaluation
// ============================================================================

/**
 * Evaluates an expression in the given context using `new Function()`.
 *
 * @security **WARNING:** This function uses dynamic code execution via `new Function()`.
 * - NEVER pass expressions derived from user input or untrusted sources
 * - Expressions should only come from developer-controlled templates
 * - Malicious expressions can access and exfiltrate context data
 * - Consider this equivalent to `eval()` in terms of security implications
 *
 * @internal
 */
const evaluate = <T = unknown>(expression: string, context: BindingContext): T => {
  try {
    // Build context keys for function scope
    const keys = Object.keys(context);
    const values = keys.map((key) => {
      const value = context[key];
      // Auto-unwrap signals/computed
      if (isSignal(value) || isComputed(value)) {
        return (value as Signal<unknown>).value;
      }
      return value;
    });

    // Create function with context variables in scope
    const fn = new Function(...keys, `return (${expression})`);
    return fn(...values) as T;
  } catch (error) {
    console.error(`bQuery view: Error evaluating "${expression}"`, error);
    return undefined as T;
  }
};

/**
 * Evaluates an expression and returns the raw value (for signal access).
 *
 * @security **WARNING:** Uses dynamic code execution. See {@link evaluate} for security notes.
 * @internal
 */
const evaluateRaw = <T = unknown>(expression: string, context: BindingContext): T => {
  try {
    const keys = Object.keys(context);
    const values = keys.map((key) => context[key]);
    const fn = new Function(...keys, `return (${expression})`);
    return fn(...values) as T;
  } catch (error) {
    console.error(`bQuery view: Error evaluating "${expression}"`, error);
    return undefined as T;
  }
};

/**
 * Parses object expression like "{ active: isActive, disabled: !enabled }".
 * Handles nested structures like function calls, arrays, and template literals.
 * @internal
 */
const parseObjectExpression = (expression: string): Record<string, string> => {
  const result: Record<string, string> = {};

  // Remove outer braces and trim
  const inner = expression
    .trim()
    .replace(/^\{|\}$/g, '')
    .trim();
  if (!inner) return result;

  // Split by comma at depth 0, respecting strings and nesting
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let inString: string | null = null;

  for (let i = 0; i < inner.length; i++) {
    const char = inner[i];
    const prevChar = i > 0 ? inner[i - 1] : '';

    // Handle string literals (including escape sequences)
    if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
      if (inString === null) {
        inString = char;
      } else if (inString === char) {
        inString = null;
      }
      current += char;
      continue;
    }

    // Skip if inside string
    if (inString !== null) {
      current += char;
      continue;
    }

    // Track nesting depth for parentheses, brackets, and braces
    if (char === '(' || char === '[' || char === '{') {
      depth++;
      current += char;
    } else if (char === ')' || char === ']' || char === '}') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      // Top-level comma - split point
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Add the last part
  if (current.trim()) {
    parts.push(current.trim());
  }

  // Parse each part to extract key and value
  for (const part of parts) {
    // Find the first colon at depth 0 (to handle ternary operators in values)
    let colonIndex = -1;
    let partDepth = 0;
    let partInString: string | null = null;

    for (let i = 0; i < part.length; i++) {
      const char = part[i];
      const prevChar = i > 0 ? part[i - 1] : '';

      if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
        if (partInString === null) {
          partInString = char;
        } else if (partInString === char) {
          partInString = null;
        }
        continue;
      }

      if (partInString !== null) continue;

      if (char === '(' || char === '[' || char === '{') {
        partDepth++;
      } else if (char === ')' || char === ']' || char === '}') {
        partDepth--;
      } else if (char === ':' && partDepth === 0) {
        colonIndex = i;
        break;
      }
    }

    if (colonIndex > -1) {
      const key = part
        .slice(0, colonIndex)
        .trim()
        .replace(/^['"]|['"]$/g, '');
      const value = part.slice(colonIndex + 1).trim();
      result[key] = value;
    }
  }

  return result;
};

// ============================================================================
// Directive Handlers
// ============================================================================

/**
 * Handles bq-text directive - sets text content.
 * @internal
 */
const handleText: DirectiveHandler = (el, expression, context, cleanups) => {
  const cleanup = effect(() => {
    const value = evaluate(expression, context);
    el.textContent = String(value ?? '');
  });
  cleanups.push(cleanup);
};

/**
 * Handles bq-html directive - sets innerHTML (sanitized by default).
 * @internal
 */
const handleHtml = (sanitize: boolean): DirectiveHandler => {
  return (el, expression, context, cleanups) => {
    const cleanup = effect(() => {
      const value = evaluate<string>(expression, context);
      const html = String(value ?? '');
      el.innerHTML = sanitize ? sanitizeHtml(html) : html;
    });
    cleanups.push(cleanup);
  };
};

/**
 * Handles bq-if directive - conditional rendering.
 * @internal
 */
const handleIf: DirectiveHandler = (el, expression, context, cleanups) => {
  const parent = el.parentNode;
  const placeholder = document.createComment(`bq-if: ${expression}`);

  // Store original element state
  let isInserted = true;

  const cleanup = effect(() => {
    const condition = evaluate<boolean>(expression, context);

    if (condition && !isInserted) {
      // Insert element
      parent?.replaceChild(el, placeholder);
      isInserted = true;
    } else if (!condition && isInserted) {
      // Remove element
      parent?.replaceChild(placeholder, el);
      isInserted = false;
    }
  });

  cleanups.push(cleanup);
};

/**
 * Handles bq-show directive - toggle visibility.
 * @internal
 */
const handleShow: DirectiveHandler = (el, expression, context, cleanups) => {
  const htmlEl = el as HTMLElement;
  const originalDisplay = htmlEl.style.display;

  const cleanup = effect(() => {
    const condition = evaluate<boolean>(expression, context);
    htmlEl.style.display = condition ? originalDisplay : 'none';
  });

  cleanups.push(cleanup);
};

/**
 * Handles bq-class directive - dynamic class binding.
 * @internal
 */
const handleClass: DirectiveHandler = (el, expression, context, cleanups) => {
  const cleanup = effect(() => {
    if (expression.startsWith('{')) {
      // Object syntax: { active: isActive, disabled: !enabled }
      const classMap = parseObjectExpression(expression);
      for (const [className, conditionExpr] of Object.entries(classMap)) {
        const condition = evaluate<boolean>(conditionExpr, context);
        el.classList.toggle(className, Boolean(condition));
      }
    } else if (expression.includes('[')) {
      // Array syntax: [class1, class2]
      const classes = evaluate<string[]>(expression, context);
      if (Array.isArray(classes)) {
        for (const cls of classes) {
          if (cls) el.classList.add(cls);
        }
      }
    } else {
      // Single expression returning string or array
      const result = evaluate<string | string[]>(expression, context);
      if (typeof result === 'string') {
        result.split(/\s+/).forEach((cls) => cls && el.classList.add(cls));
      } else if (Array.isArray(result)) {
        result.forEach((cls) => cls && el.classList.add(cls));
      }
    }
  });

  cleanups.push(cleanup);
};

/**
 * Handles bq-style directive - dynamic style binding.
 * @internal
 */
const handleStyle: DirectiveHandler = (el, expression, context, cleanups) => {
  const htmlEl = el as HTMLElement;

  const cleanup = effect(() => {
    if (expression.startsWith('{')) {
      const styleMap = parseObjectExpression(expression);
      for (const [prop, valueExpr] of Object.entries(styleMap)) {
        const value = evaluate<string>(valueExpr, context);
        const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        htmlEl.style.setProperty(cssProp, String(value ?? ''));
      }
    } else {
      const result = evaluate<Record<string, string>>(expression, context);
      if (result && typeof result === 'object') {
        for (const [prop, value] of Object.entries(result)) {
          const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
          htmlEl.style.setProperty(cssProp, String(value ?? ''));
        }
      }
    }
  });

  cleanups.push(cleanup);
};

/**
 * Handles bq-model directive - two-way binding.
 * @internal
 */
const handleModel: DirectiveHandler = (el, expression, context, cleanups) => {
  const input = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  const rawValue = evaluateRaw<Signal<unknown>>(expression, context);

  if (!isSignal(rawValue)) {
    console.warn(`bQuery view: bq-model requires a signal, got "${expression}"`);
    return;
  }

  const sig = rawValue as Signal<unknown>;

  // Initial value sync
  const isCheckbox = input.type === 'checkbox';
  const isRadio = input.type === 'radio';

  const updateInput = () => {
    if (isCheckbox) {
      (input as HTMLInputElement).checked = Boolean(sig.value);
    } else if (isRadio) {
      (input as HTMLInputElement).checked = sig.value === input.value;
    } else {
      input.value = String(sig.value ?? '');
    }
  };

  // Effect to sync signal -> input
  const cleanup = effect(() => {
    updateInput();
  });
  cleanups.push(cleanup);

  // Event listener to sync input -> signal
  const eventType = input.tagName === 'SELECT' ? 'change' : 'input';
  const handler = () => {
    if (isCheckbox) {
      sig.value = (input as HTMLInputElement).checked;
    } else if (isRadio) {
      if ((input as HTMLInputElement).checked) {
        sig.value = input.value;
      }
    } else {
      sig.value = input.value;
    }
  };

  input.addEventListener(eventType, handler);
  cleanups.push(() => input.removeEventListener(eventType, handler));
};

/**
 * Handles bq-bind:attr directive - attribute binding.
 * @internal
 */
const handleBind = (attrName: string): DirectiveHandler => {
  return (el, expression, context, cleanups) => {
    const cleanup = effect(() => {
      const value = evaluate(expression, context);
      if (value == null || value === false) {
        el.removeAttribute(attrName);
      } else if (value === true) {
        el.setAttribute(attrName, '');
      } else {
        el.setAttribute(attrName, String(value));
      }
    });
    cleanups.push(cleanup);
  };
};

/**
 * Handles bq-on:event directive - event binding.
 * @internal
 */
const handleOn = (eventName: string): DirectiveHandler => {
  return (el, expression, context, cleanups) => {
    const handler = (event: Event) => {
      // Add $event to context for expression evaluation
      const eventContext = { ...context, $event: event, $el: el };

      // Check if expression is just a function reference (no parentheses)
      // In that case, we should call it directly
      const isPlainFunctionRef = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(expression.trim());

      if (isPlainFunctionRef) {
        // Get the function and call it with the event
        const fn = evaluateRaw<unknown>(expression, eventContext);
        if (typeof fn === 'function') {
          fn(event);
          return;
        }
      }

      // Otherwise evaluate as expression (e.g., "handleClick($event)" or "count++")
      evaluate(expression, eventContext);
    };

    el.addEventListener(eventName, handler);
    cleanups.push(() => el.removeEventListener(eventName, handler));
  };
};

/**
 * Handles bq-for directive - list rendering.
 * @internal
 */
const handleFor = (prefix: string, sanitize: boolean): DirectiveHandler => {
  return (el, expression, context, cleanups) => {
    const parent = el.parentNode;
    if (!parent) return;

    // Parse expression: "item in items" or "(item, index) in items"
    // Use \S.* instead of .+ to prevent ReDoS by requiring non-whitespace start
    const match = expression.match(/^\(?(\w+)(?:\s*,\s*(\w+))?\)?\s+in\s+(\S.*)$/);
    if (!match) {
      console.error(`bQuery view: Invalid bq-for expression "${expression}"`);
      return;
    }

    const [, itemName, indexName, listExpression] = match;
    const template = el.cloneNode(true) as Element;
    template.removeAttribute(`${prefix}-for`);

    // Create placeholder comment
    const placeholder = document.createComment(`bq-for: ${expression}`);
    parent.replaceChild(placeholder, el);

    // Track rendered elements and their cleanups
    let renderedElements: Element[] = [];
    let previousChildCleanups: CleanupFn[] = [];

    const cleanup = effect(() => {
      const list = evaluate<unknown[]>(listExpression, context);

      // Cleanup previous iteration's effects before removing elements
      for (const childCleanup of previousChildCleanups) {
        childCleanup();
      }
      previousChildCleanups = [];

      // Remove old elements
      for (const oldEl of renderedElements) {
        oldEl.remove();
      }
      renderedElements = [];

      if (!Array.isArray(list)) return;

      // Create new elements
      const fragment = document.createDocumentFragment();
      const childCleanups: CleanupFn[] = [];

      list.forEach((item, index) => {
        const clone = template.cloneNode(true) as Element;

        // Create child context with item and index
        const childContext: BindingContext = {
          ...context,
          [itemName]: item,
        };
        if (indexName) {
          childContext[indexName] = index;
        }

        // Process bindings on the clone
        processElement(clone, childContext, prefix, sanitize, childCleanups);
        processChildren(clone, childContext, prefix, sanitize, childCleanups);

        fragment.appendChild(clone);
        renderedElements.push(clone);
      });

      // Insert all at once
      placeholder.after(fragment);

      // Store child cleanups for next iteration (don't add to parent)
      previousChildCleanups = childCleanups;
    });

    // When the bq-for itself is cleaned up, also cleanup any remaining children
    cleanups.push(() => {
      cleanup();
      for (const childCleanup of previousChildCleanups) {
        childCleanup();
      }
    });
  };
};

/**
 * Handles bq-ref directive - element reference.
 * @internal
 */
const handleRef: DirectiveHandler = (el, expression, context, cleanups) => {
  const rawValue = evaluateRaw<Signal<Element | null>>(expression, context);

  if (isSignal(rawValue)) {
    (rawValue as Signal<Element | null>).value = el;
    cleanups.push(() => {
      (rawValue as Signal<Element | null>).value = null;
    });
  } else if (typeof context[expression] === 'object' && context[expression] !== null) {
    // Object with .value property
    (context[expression] as { value: Element | null }).value = el;
  }
};

// ============================================================================
// Core Processing
// ============================================================================

/**
 * Processes a single element for directives.
 * @internal
 */
const processElement = (
  el: Element,
  context: BindingContext,
  prefix: string,
  sanitize: boolean,
  cleanups: CleanupFn[]
): void => {
  const attributes = Array.from(el.attributes);

  for (const attr of attributes) {
    const { name, value } = attr;

    if (!name.startsWith(prefix)) continue;

    const directive = name.slice(prefix.length + 1); // Remove prefix and dash

    // Handle bq-for specially (creates new scope)
    if (directive === 'for') {
      handleFor(prefix, sanitize)(el, value, context, cleanups);
      return; // Don't process children, bq-for handles it
    }

    // Handle other directives
    if (directive === 'text') {
      handleText(el, value, context, cleanups);
    } else if (directive === 'html') {
      handleHtml(sanitize)(el, value, context, cleanups);
    } else if (directive === 'if') {
      handleIf(el, value, context, cleanups);
    } else if (directive === 'show') {
      handleShow(el, value, context, cleanups);
    } else if (directive === 'class') {
      handleClass(el, value, context, cleanups);
    } else if (directive === 'style') {
      handleStyle(el, value, context, cleanups);
    } else if (directive === 'model') {
      handleModel(el, value, context, cleanups);
    } else if (directive === 'ref') {
      handleRef(el, value, context, cleanups);
    } else if (directive.startsWith('bind:')) {
      const attrName = directive.slice(5);
      handleBind(attrName)(el, value, context, cleanups);
    } else if (directive.startsWith('on:')) {
      const eventName = directive.slice(3);
      handleOn(eventName)(el, value, context, cleanups);
    }
  }
};

/**
 * Recursively processes children of an element.
 * @internal
 */
const processChildren = (
  el: Element,
  context: BindingContext,
  prefix: string,
  sanitize: boolean,
  cleanups: CleanupFn[]
): void => {
  const children = Array.from(el.children);
  for (const child of children) {
    // Skip if element has bq-for (handled separately)
    if (!child.hasAttribute(`${prefix}-for`)) {
      processElement(child, context, prefix, sanitize, cleanups);
      processChildren(child, context, prefix, sanitize, cleanups);
    } else {
      processElement(child, context, prefix, sanitize, cleanups);
    }
  }
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Mounts a reactive view to an element.
 *
 * @param selector - CSS selector or Element
 * @param context - Binding context with signals, computed, and functions
 * @param options - Mount options
 * @returns The mounted View instance
 *
 * @security **WARNING:** Directive expressions (bq-text, bq-if, bq-on, etc.) are evaluated
 * using `new Function()` at runtime. This means:
 * - Template attributes must come from trusted sources only
 * - NEVER load templates containing bq-* attributes from user input or untrusted APIs
 * - If you must use external templates, validate/sanitize attribute values first
 *
 * @example
 * ```ts
 * import { mount } from 'bquery/view';
 * import { signal, computed } from 'bquery/reactive';
 *
 * const name = signal('World');
 * const greeting = computed(() => `Hello, ${name.value}!`);
 * const items = signal([
 *   { id: 1, text: 'Item 1' },
 *   { id: 2, text: 'Item 2' },
 * ]);
 *
 * const view = mount('#app', {
 *   name,
 *   greeting,
 *   items,
 *   addItem: () => {
 *     items.value = [...items.value, { id: Date.now(), text: 'New Item' }];
 *   },
 * });
 *
 * // Later, cleanup
 * view.destroy();
 * ```
 */
export const mount = (
  selector: string | Element,
  context: BindingContext,
  options: MountOptions = {}
): View => {
  const { prefix = 'bq', sanitize = true } = options;

  const el = typeof selector === 'string' ? document.querySelector(selector) : selector;

  if (!el) {
    throw new Error(`bQuery view: Element "${selector}" not found.`);
  }

  const cleanups: CleanupFn[] = [];

  // Process the root element and its children
  processElement(el, context, prefix, sanitize, cleanups);
  processChildren(el, context, prefix, sanitize, cleanups);

  return {
    el,
    context,

    update: (newContext: Partial<BindingContext>) => {
      Object.assign(context, newContext);
    },

    destroy: () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
      cleanups.length = 0;
    },
  };
};

/**
 * Creates a reactive template function.
 *
 * @param template - HTML template string
 * @returns A function that creates a mounted element with the given context
 *
 * @example
 * ```ts
 * import { createTemplate } from 'bquery/view';
 * import { signal } from 'bquery/reactive';
 *
 * const TodoItem = createTemplate(`
 *   <li bq-class="{ completed: done }">
 *     <input type="checkbox" bq-model="done" />
 *     <span bq-text="text"></span>
 *   </li>
 * `);
 *
 * const item = TodoItem({
 *   done: signal(false),
 *   text: 'Buy groceries',
 * });
 *
 * document.querySelector('#list').append(item.el);
 * ```
 */
export const createTemplate = (
  template: string,
  options: MountOptions = {}
): ((context: BindingContext) => View) => {
  return (context: BindingContext) => {
    const container = document.createElement('div');
    container.innerHTML = template.trim();

    const el = container.firstElementChild;
    if (!el) {
      throw new Error('bQuery view: Template must contain a single root element.');
    }

    return mount(el, context, options);
  };
};

// ============================================================================
// Utility Exports
// ============================================================================

/**
 * Re-export reactive primitives for convenience.
 */
export { batch, computed, effect, signal } from '../reactive/index';
