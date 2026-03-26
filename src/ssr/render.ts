/**
 * SSR rendering utilities.
 *
 * Server-side renders bQuery templates to HTML strings by evaluating
 * directive attributes against a plain data context. Uses a lightweight
 * DOM implementation to process templates without a browser.
 *
 * @module bquery/ssr
 */

import { isComputed, isSignal, type Signal } from '../reactive/index';
import type { BindingContext } from '../view/types';
import type { RenderOptions, SSRResult } from './types';
import { serializeStoreState } from './serialize';

/**
 * Unwraps a value — if it's a signal/computed, returns `.value`, otherwise returns as-is.
 * @internal
 */
const unwrap = (value: unknown): unknown => {
  if (isSignal(value) || isComputed(value)) {
    return (value as Signal<unknown>).value;
  }
  return value;
};

/**
 * Evaluates a simple expression against a context.
 * Supports dot-notation property access, negation, ternary, and basic comparisons.
 * Unlike the view module's `evaluate()`, this does NOT use `new Function()` —
 * it uses a safe subset for SSR to avoid `unsafe-eval` in server environments.
 *
 * Falls back to `new Function()` for complex expressions.
 *
 * @internal
 */
const evaluateSSR = <T = unknown>(expression: string, context: BindingContext): T => {
  const trimmed = expression.trim();

  // Handle negation: !expr
  if (trimmed.startsWith('!')) {
    return !evaluateSSR(trimmed.slice(1).trim(), context) as T;
  }

  // Handle string literals
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1) as T;
  }

  // Handle numeric literals
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed) as T;
  }

  // Handle boolean literals
  if (trimmed === 'true') return true as T;
  if (trimmed === 'false') return false as T;
  if (trimmed === 'null') return null as T;
  if (trimmed === 'undefined') return undefined as T;

  // Handle dot-notation property access: a.b.c
  if (/^[\w$]+(?:\.[\w$]+)*$/.test(trimmed)) {
    const parts = trimmed.split('.');
    let current: unknown = context;
    for (const part of parts) {
      if (current == null) return undefined as T;
      // First level: unwrap signals
      if (current === context) {
        current = unwrap((current as Record<string, unknown>)[part]);
      } else {
        current = (current as Record<string, unknown>)[part];
      }
    }
    return current as T;
  }

  // For complex expressions, fall back to Function-based evaluation
  try {
    const keys = Object.keys(context);
    const values = keys.map((k) => unwrap(context[k]));
    const fn = new Function(...keys, `return (${trimmed});`);
    return fn(...values) as T;
  } catch {
    return undefined as T;
  }
};

/**
 * Parses a `bq-for` expression like `item in items` or `(item, index) in items`.
 * @internal
 */
const parseForExpression = (
  expression: string
): { itemName: string; indexName?: string; listExpr: string } | null => {
  const match = expression.match(/^\(?(\w+)(?:\s*,\s*(\w+))?\)?\s+in\s+(\S.*)$/);
  if (!match) return null;
  return {
    itemName: match[1],
    indexName: match[2] || undefined,
    listExpr: match[3].trim(),
  };
};

/**
 * Processes an element's SSR directives, modifying it in place.
 * Returns `false` if the element should be removed from output (bq-if = false).
 * @internal
 */
const processSSRElement = (
  el: Element,
  context: BindingContext,
  prefix: string,
  doc: Document
): boolean => {
  // Handle bq-if: remove element if condition is falsy
  const ifExpr = el.getAttribute(`${prefix}-if`);
  if (ifExpr !== null) {
    const condition = evaluateSSR<boolean>(ifExpr, context);
    if (!condition) {
      return false; // Signal to remove this element
    }
  }

  // Handle bq-show: set display:none if falsy
  const showExpr = el.getAttribute(`${prefix}-show`);
  if (showExpr !== null) {
    const condition = evaluateSSR<boolean>(showExpr, context);
    if (!condition) {
      const htmlEl = el as unknown as { style?: { display?: string } };
      if (htmlEl.style) {
        htmlEl.style.display = 'none';
      } else {
        el.setAttribute('style', 'display: none;');
      }
    }
  }

  // Handle bq-text: set text content
  const textExpr = el.getAttribute(`${prefix}-text`);
  if (textExpr !== null) {
    const value = evaluateSSR(textExpr, context);
    el.textContent = String(value ?? '');
  }

  // Handle bq-html: set inner HTML (sanitized by default in client)
  const htmlExpr = el.getAttribute(`${prefix}-html`);
  if (htmlExpr !== null) {
    const value = evaluateSSR(htmlExpr, context);
    el.innerHTML = String(value ?? '');
  }

  // Handle bq-class: add classes
  const classExpr = el.getAttribute(`${prefix}-class`);
  if (classExpr !== null) {
    const trimmedClass = classExpr.trim();
    if (trimmedClass.startsWith('{')) {
      // Object syntax: { active: isActive, disabled: !enabled }
      const inner = trimmedClass.slice(1, -1).trim();
      const pairs = inner.split(',');
      for (const pair of pairs) {
        const colonIdx = pair.indexOf(':');
        if (colonIdx > -1) {
          const className = pair.slice(0, colonIdx).trim().replace(/^['"]|['"]$/g, '');
          const condExpr = pair.slice(colonIdx + 1).trim();
          const condition = evaluateSSR<boolean>(condExpr, context);
          if (condition) {
            el.classList.add(className);
          }
        }
      }
    } else {
      const result = evaluateSSR<string | string[]>(classExpr, context);
      if (typeof result === 'string') {
        result
          .split(/\s+/)
          .filter(Boolean)
          .forEach((cls) => el.classList.add(cls));
      } else if (Array.isArray(result)) {
        result.filter(Boolean).forEach((cls) => el.classList.add(cls));
      }
    }
  }

  // Handle bq-style: set inline styles
  const styleExpr = el.getAttribute(`${prefix}-style`);
  if (styleExpr !== null) {
    const result = evaluateSSR<Record<string, string>>(styleExpr, context);
    if (result && typeof result === 'object') {
      const htmlEl = el as HTMLElement;
      for (const [prop, val] of Object.entries(result)) {
        // Convert camelCase to kebab-case
        const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        htmlEl.style.setProperty(cssProp, String(val));
      }
    }
  }

  // Handle bq-bind:attr — set arbitrary attributes
  const attrs = Array.from(el.attributes);
  for (const attr of attrs) {
    if (attr.name.startsWith(`${prefix}-bind:`)) {
      const attrName = attr.name.slice(`${prefix}-bind:`.length);
      const value = evaluateSSR(attr.value, context);
      if (value === false || value === null || value === undefined) {
        el.removeAttribute(attrName);
      } else if (value === true) {
        el.setAttribute(attrName, '');
      } else {
        el.setAttribute(attrName, String(value));
      }
    }
  }

  // Handle bq-for: list rendering
  const forExpr = el.getAttribute(`${prefix}-for`);
  if (forExpr !== null) {
    const parsed = parseForExpression(forExpr);
    if (parsed) {
      const list = evaluateSSR<unknown[]>(parsed.listExpr, context);
      if (Array.isArray(list) && el.parentNode) {
        const parent = el.parentNode;
        for (let i = 0; i < list.length; i++) {
          const item = list[i];
          const clone = el.cloneNode(true) as Element;

          // Remove the bq-for attribute from clones
          clone.removeAttribute(`${prefix}-for`);
          clone.removeAttribute(':key');
          clone.removeAttribute(`${prefix}-key`);

          // Create item context
          const itemContext: BindingContext = {
            ...context,
            [parsed.itemName]: item,
          };
          if (parsed.indexName) {
            itemContext[parsed.indexName] = i;
          }

          // Recursively process the clone
          processSSRElement(clone, itemContext, prefix, doc);
          processSSRChildren(clone, itemContext, prefix, doc);

          parent.insertBefore(clone, el);
        }

        // Remove the original template element
        parent.removeChild(el);
        return true; // Already handled children
      }
    }
  }

  return true;
};

/**
 * Recursively processes children of an element for SSR.
 * @internal
 */
const processSSRChildren = (
  parent: Element,
  context: BindingContext,
  prefix: string,
  doc: Document
): void => {
  // Process children in reverse to handle removals safely
  const children = Array.from(parent.children);
  for (const child of children) {
    // Skip bq-for elements — they're handled by parent
    if (child.hasAttribute(`${prefix}-for`)) {
      // Process the for directive on this element
      const keep = processSSRElement(child, context, prefix, doc);
      if (!keep) {
        child.remove();
      }
      continue;
    }

    const keep = processSSRElement(child, context, prefix, doc);
    if (!keep) {
      child.remove();
      continue;
    }

    // Recurse into children
    processSSRChildren(child, context, prefix, doc);
  }
};

/**
 * Strips all directive attributes (bq-*) from an element and its descendants.
 * @internal
 */
const stripDirectiveAttributes = (el: Element, prefix: string): void => {
  // Remove directive attributes from this element
  const attrs = Array.from(el.attributes);
  for (const attr of attrs) {
    if (
      attr.name.startsWith(`${prefix}-`) ||
      attr.name.startsWith(':') ||
      attr.name === ':key'
    ) {
      el.removeAttribute(attr.name);
    }
  }

  // Recurse into children
  for (const child of Array.from(el.children)) {
    stripDirectiveAttributes(child, prefix);
  }
};

/**
 * Server-side renders a bQuery template to an HTML string.
 *
 * Takes an HTML template with bQuery directives (bq-text, bq-if, bq-for, etc.)
 * and a data context, then evaluates the directives to produce a static HTML string.
 * This HTML can be sent to the client and later hydrated with `mount()` using
 * `{ hydrate: true }`.
 *
 * Supported directives:
 * - `bq-text` — Sets text content
 * - `bq-html` — Sets innerHTML
 * - `bq-if` — Conditional rendering (removes element if falsy)
 * - `bq-show` — Toggle visibility via `display: none`
 * - `bq-class` — Dynamic class binding (object or expression syntax)
 * - `bq-style` — Dynamic inline styles
 * - `bq-for` — List rendering
 * - `bq-bind:attr` — Dynamic attribute binding
 *
 * @param template - HTML template string with bq-* directives
 * @param data - Plain data object (signals will be unwrapped automatically)
 * @param options - Rendering options
 * @returns SSR result with HTML string and optional store state
 *
 * @example
 * ```ts
 * import { renderToString } from '@bquery/bquery/ssr';
 * import { signal } from '@bquery/bquery/reactive';
 *
 * const result = renderToString(
 *   '<div><h1 bq-text="title"></h1><p bq-if="showBody">Hello!</p></div>',
 *   { title: 'Welcome', showBody: true }
 * );
 *
 * console.log(result.html);
 * // '<div><h1>Welcome</h1><p>Hello!</p></div>'
 * ```
 *
 * @example
 * ```ts
 * // With bq-for list rendering
 * const result = renderToString(
 *   '<ul><li bq-for="item in items" bq-text="item.name"></li></ul>',
 *   { items: [{ name: 'Alice' }, { name: 'Bob' }] }
 * );
 *
 * console.log(result.html);
 * // '<ul><li>Alice</li><li>Bob</li></ul>'
 * ```
 */
export const renderToString = (
  template: string,
  data: BindingContext,
  options: RenderOptions = {}
): SSRResult => {
  const { prefix = 'bq', stripDirectives = false, includeStoreState = false } = options;

  if (!template || typeof template !== 'string') {
    throw new Error('bQuery SSR: template must be a non-empty string.');
  }

  // Create a DOM document for processing
  // Use globalThis.document if available, otherwise DOMParser
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${template.trim()}</body>`, 'text/html');
  const body = doc.body || doc.documentElement;

  if (!body) {
    throw new Error('bQuery SSR: Failed to parse template.');
  }

  // Process all children of the body
  processSSRChildren(body, data, prefix, doc);

  // Strip directive attributes if requested
  if (stripDirectives) {
    for (const child of Array.from(body.children)) {
      stripDirectiveAttributes(child, prefix);
    }
  }

  const html = body.innerHTML;

  // Handle store state serialization
  let storeState: string | undefined;
  if (includeStoreState) {
    const storeIds = Array.isArray(includeStoreState) ? includeStoreState : undefined;
    storeState = serializeStoreState({ storeIds }).stateJson;
  }

  return { html, storeState };
};
