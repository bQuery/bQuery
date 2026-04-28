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
import { DANGEROUS_PROTOCOLS } from '../security/constants';
import { sanitizeHtml } from '../security/sanitize';
import type { BindingContext } from '../view/types';
import { getDOMParserImpl, resolveBackend } from './config';
import { cheapHash, collectDirectiveSignatureFromElement, HYDRATION_HASH_ATTR } from './hash';
import { renderTemplatePure } from './renderer';
import type { RenderOptions, SSRResult } from './types';
import { serializeStoreState } from './serialize';

const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

const TEXT_NODE_TYPE = 3;
const ELEMENT_NODE_TYPE = 1;

const escapeHtmlText = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escapeHtmlAttribute = (value: string): string =>
  escapeHtmlText(value).replace(/"/g, '&quot;');

const isUnsafeUrlAttribute = (name: string): boolean => {
  const normalized = name.toLowerCase();
  return (
    normalized === 'href' ||
    normalized === 'src' ||
    normalized === 'xlink:href' ||
    normalized === 'formaction' ||
    normalized === 'action' ||
    normalized === 'poster' ||
    normalized === 'background' ||
    normalized === 'cite' ||
    normalized === 'data'
  );
};

const sanitizeUrlForProtocolCheck = (value: string): string =>
  value
    .trim()
    .replace(/[\u0000-\u001F\u007F]+/g, '')
    .replace(/[\u200B-\u200D\uFEFF\u2028\u2029]+/g, '')
    .replace(/\\u[\da-fA-F]{4}/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();

const isUnsafeUrlValue = (value: string): boolean => {
  const normalized = sanitizeUrlForProtocolCheck(value);
  return DANGEROUS_PROTOCOLS.some((protocol) => normalized.startsWith(protocol));
};

const serializeSSRNode = (node: Node): string => {
  if (node.nodeType === TEXT_NODE_TYPE) {
    return escapeHtmlText(node.textContent ?? '');
  }

  if (node.nodeType !== ELEMENT_NODE_TYPE) {
    return '';
  }

  const el = node as Element;
  const tagName = el.tagName.toLowerCase();

  if (tagName === 'script') {
    return '';
  }

  let attrs = '';
  for (const attr of el.attributes) {
    const attrName = attr.name.toLowerCase();
    if (attrName.startsWith('on')) {
      continue;
    }
    if (isUnsafeUrlAttribute(attrName) && isUnsafeUrlValue(attr.value)) {
      continue;
    }
    attrs += ` ${attr.name}="${escapeHtmlAttribute(attr.value)}"`;
  }

  if (VOID_ELEMENTS.has(tagName)) {
    return `<${tagName}${attrs}>`;
  }

  let childrenHtml = '';
  for (const child of el.childNodes) {
    childrenHtml += serializeSSRNode(child);
  }

  return `<${tagName}${attrs}>${childrenHtml}</${tagName}>`;
};

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
  doc: Document,
  annotateHydration = false
): boolean => {
  // Handle bq-for before other directives so each clone gets an item-scoped context.
  const forExpr = el.getAttribute(`${prefix}-for`);
  const parsedFor = forExpr !== null ? parseForExpression(forExpr) : null;
  if (forExpr !== null && !parsedFor) {
    // Remove invalid directives before signature capture so hydration hashes
    // match the DOM-free renderer's normalized output.
    el.removeAttribute(`${prefix}-for`);
  }

  // Capture directive signature after normalizing invalid directives, but
  // before mutating any still-effective directive attributes.
  const signature = annotateHydration ? collectDirectiveSignatureFromElement(el, prefix) : '';

  if (forExpr !== null) {
    if (parsedFor) {
      const list = evaluateSSR<unknown[]>(parsedFor.listExpr, context);
      if (el.parentNode) {
        const parent = el.parentNode;
        if (!Array.isArray(list)) {
          parent.removeChild(el);
          return true;
        }

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
            [parsedFor.itemName]: item,
          };
          if (parsedFor.indexName) {
            itemContext[parsedFor.indexName] = i;
          }

          // Recursively process the clone
          const shouldRenderClone = processSSRElement(
            clone,
            itemContext,
            prefix,
            doc,
            annotateHydration
          );
          if (!shouldRenderClone) {
            continue;
          }
          processSSRChildren(clone, itemContext, prefix, doc, annotateHydration);

          parent.insertBefore(clone, el);
        }

        // Remove the original template element
        parent.removeChild(el);
        return true; // Already handled children
      }
    }
  }

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

  // Handle bq-html: sanitize to match client-side default behavior
  const htmlExpr = el.getAttribute(`${prefix}-html`);
  if (htmlExpr !== null) {
    const value = evaluateSSR(htmlExpr, context);
    el.innerHTML = String(sanitizeHtml(String(value ?? '')));
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
          const className = pair
            .slice(0, colonIdx)
            .trim()
            .replace(/^['"]|['"]$/g, '');
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

  if (signature) {
    el.setAttribute(HYDRATION_HASH_ATTR, cheapHash(signature));
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
  doc: Document,
  annotateHydration = false
): void => {
  // Process children in reverse to handle removals safely
  const children = Array.from(parent.children);
  for (const child of children) {
    let processedForDirective = false;

    // Handle elements that start with bq-for before the normal per-element pass.
    if (child.hasAttribute(`${prefix}-for`)) {
      const keep = processSSRElement(child, context, prefix, doc, annotateHydration);
      processedForDirective = true;
      if (!keep) {
        child.remove();
        continue;
      }

      // Valid bq-for handling removes/replaces the original template node. If the
      // original child is no longer attached here, recursion has already been
      // handled by the bq-for expansion path.
      if (child.parentNode !== parent) {
        continue;
      }
    }

    if (!processedForDirective) {
      const keep = processSSRElement(child, context, prefix, doc, annotateHydration);
      if (!keep) {
        child.remove();
        continue;
      }
    }

    // Recurse into children
    processSSRChildren(child, context, prefix, doc, annotateHydration);
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
    if (attr.name.startsWith(`${prefix}-`) || attr.name.startsWith(':') || attr.name === ':key') {
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
  const {
    prefix = 'bq',
    stripDirectives = false,
    includeStoreState = false,
    annotateHydration = false,
  } = options;

  if (!template || typeof template !== 'string') {
    throw new Error('bQuery SSR: template must be a non-empty string.');
  }

  const normalizedTemplate = template.trim();

  // Resolve the renderer backend. Defaults to the legacy DOM-based path when
  // a `DOMParser` is available (browser/happy-dom in tests); otherwise the
  // pure DOM-free renderer kicks in automatically — this is what makes
  // `renderToString()` work seamlessly on Bun, Deno and Node ≥ 24.
  const backend = resolveBackend();

  if (backend === 'pure') {
    const html = renderTemplatePure(normalizedTemplate, data, {
      prefix,
      stripDirectives,
      annotateHydration,
    });
    let storeState: string | undefined;
    if (includeStoreState) {
      const storeIds = Array.isArray(includeStoreState) ? includeStoreState : undefined;
      storeState = serializeStoreState({ storeIds }).stateJson;
    }
    return { html, storeState };
  }

  const DOMParserImpl = getDOMParserImpl();
  if (!DOMParserImpl) {
    throw new Error(
      'bQuery SSR: DOMParser is not available in this environment. Provide a DOMParser-compatible implementation before calling renderToString().'
    );
  }

  // Create a DOM document for processing
  const parser = new DOMParserImpl();
  const doc = parser.parseFromString(normalizedTemplate, 'text/html');
  const body = doc.body || doc.documentElement;

  if (!body) {
    throw new Error('bQuery SSR: Failed to parse template.');
  }

  // Process all children of the body
  processSSRChildren(body, data, prefix, doc, annotateHydration);

  // Strip directive attributes if requested
  if (stripDirectives) {
    for (const child of Array.from(body.children)) {
      stripDirectiveAttributes(child, prefix);
    }
  }

  let html = '';
  for (const child of body.childNodes) {
    html += serializeSSRNode(child);
  }

  // Handle store state serialization
  let storeState: string | undefined;
  if (includeStoreState) {
    const storeIds = Array.isArray(includeStoreState) ? includeStoreState : undefined;
    storeState = serializeStoreState({ storeIds }).stateJson;
  }

  return { html, storeState };
};
