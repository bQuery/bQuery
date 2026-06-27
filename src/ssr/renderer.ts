/**
 * DOM-free SSR renderer.
 *
 * Operates on the virtual node tree produced by `html-parser.ts` and
 * evaluates `bq-*` directives without depending on any browser DOM API.
 * Runs unmodified on Bun, Deno and Node and is the default backend used by
 * `renderToString()` whenever the global `DOMParser` is not configured to
 * take precedence.
 *
 * @module bquery/ssr
 * @internal
 */

import {
  DANGEROUS_ATTR_PREFIXES,
  DANGEROUS_PROTOCOLS,
  DANGEROUS_TAGS,
  DEFAULT_ALLOWED_ATTRIBUTES,
  DEFAULT_ALLOWED_TAGS,
  RESERVED_IDS,
} from '../security/constants';
import type { BindingContext } from '../view/types';
import {
  classifyUnsupportedDirective,
  collectOnEvents,
  directiveHead,
  reportUnsupportedDirective,
  resolveModelReflection,
  SSR_ON_MARKER_ATTR,
  type SSRDirectiveMode,
  type UnsupportedDirectiveStrategy,
} from './directive-support';
import { evaluateExpression } from './expression';
import { cheapHash, collectDirectiveSignatureFromAttrs, HYDRATION_HASH_ATTR } from './hash';
import {
  cloneNode,
  parseTemplate,
  serializeTree,
  type SSRElement,
  type SSRNode,
} from './html-parser';

const isUnsafeUrlAttribute = (name: string): boolean => {
  const n = name.toLowerCase();
  return (
    n === 'href' ||
    n === 'src' ||
    n === 'xlink:href' ||
    n === 'formaction' ||
    n === 'action' ||
    n === 'poster' ||
    n === 'background' ||
    n === 'cite' ||
    n === 'data'
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

const URL_PROTOCOL_PATTERN = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;
const REL_SPLIT_PATTERN = /\s+/;

const isAllowedHtmlAttribute = (name: string): boolean => {
  const lowerName = name.toLowerCase();

  for (const prefix of DANGEROUS_ATTR_PREFIXES) {
    if (lowerName.startsWith(prefix)) return false;
  }

  if (lowerName.startsWith('data-')) return true;
  if (lowerName.startsWith('aria-')) return true;

  return DEFAULT_ALLOWED_ATTRIBUTES.has(lowerName);
};

const isSafeHtmlIdOrName = (value: string): boolean =>
  !RESERVED_IDS.has(value.toLowerCase().trim());

const isExternalHtmlUrl = (url: string): boolean => {
  try {
    const trimmedUrl = url.trim();
    if (trimmedUrl.startsWith('//')) return true;

    const lowerUrl = trimmedUrl.toLowerCase();
    if (!lowerUrl.startsWith('http://') && !lowerUrl.startsWith('https://')) {
      if (!URL_PROTOCOL_PATTERN.test(trimmedUrl)) {
        return false;
      }
      return true;
    }

    if (typeof window === 'undefined' || !window.location) {
      return true;
    }

    const urlObj = new URL(trimmedUrl, window.location.href);
    return urlObj.origin !== window.location.origin;
  } catch {
    return true;
  }
};

interface RenderOpts {
  prefix: string;
  stripDirectives: boolean;
  /** Whether to add `data-bq-h` mismatch hashes to elements with directives. */
  annotateHydration: boolean;
  /** Directive set to evaluate: `'static'` (default) or `'full'`. */
  mode: SSRDirectiveMode;
  /** How to report directives that cannot be server-rendered. */
  onUnsupported: UnsupportedDirectiveStrategy;
}

/**
 * `cheapHash` and `HYDRATION_HASH_ATTR` are imported from `./hash` so the
 * server-side annotation and client-side verifier stay in lock-step.
 */

const setClass = (el: SSRElement, cls: string): void => {
  if (!cls) return;
  const existing = el.attributes['class'];
  const merged = existing ? `${existing} ${cls}` : cls;
  if (!('class' in el.attributes)) el.attributeOrder.push('class');
  el.attributes['class'] = merged;
};

const setStyle = (el: SSRElement, declarations: Record<string, unknown>): void => {
  let css = el.attributes['style'] ?? '';
  for (const [prop, val] of Object.entries(declarations)) {
    if (val === undefined || val === null || val === false) continue;
    const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
    if (css && !css.endsWith(';')) css += '; ';
    css += `${cssProp}: ${String(val)};`;
  }
  if (!('style' in el.attributes)) el.attributeOrder.push('style');
  el.attributes['style'] = css;
};

const removeAttr = (el: SSRElement, name: string): void => {
  if (name in el.attributes) {
    delete el.attributes[name];
    const idx = el.attributeOrder.indexOf(name);
    if (idx !== -1) el.attributeOrder.splice(idx, 1);
  }
};

const setAttr = (el: SSRElement, name: string, value: string): void => {
  if (!(name in el.attributes)) el.attributeOrder.push(name);
  el.attributes[name] = value;
};

const collectDirectiveSignature = (el: SSRElement, prefix: string): string =>
  collectDirectiveSignatureFromAttrs(el.attributeOrder, el.attributes, prefix);

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

const stripDirectiveAttributes = (node: SSRNode, prefix: string): void => {
  if (node.type !== 'element') {
    if (node.type === 'fragment') {
      for (const child of node.children) stripDirectiveAttributes(child, prefix);
    }
    return;
  }
  for (const name of [...node.attributeOrder]) {
    if (name.startsWith(`${prefix}-`) || name.startsWith(':')) {
      removeAttr(node, name);
    }
  }
  for (const child of node.children) stripDirectiveAttributes(child, prefix);
};

const setText = (el: SSRElement, value: string): void => {
  el.children = [{ type: 'text', value }];
};

/** Recursively collects `<option>` descendants of a virtual `<select>`. */
const collectOptionElements = (node: SSRNode, out: SSRElement[]): void => {
  if (node.type === 'element') {
    if (node.tag === 'option') out.push(node);
    for (const child of node.children) collectOptionElements(child, out);
  } else if (node.type === 'fragment') {
    for (const child of node.children) collectOptionElements(child, out);
  }
};

/** Returns the text content of a virtual option element (used as its value fallback). */
const optionText = (el: SSRElement): string => {
  let text = '';
  for (const child of el.children) {
    if (child.type === 'text') text += child.value;
  }
  return text.trim();
};

/** Reflects a resolved `bq-model` value onto a virtual form-control element. */
const applyModelToPureElement = (el: SSRElement, value: unknown): void => {
  const reflection = resolveModelReflection(
    el.tag,
    el.attributes['type'],
    el.attributes['value'],
    value
  );
  switch (reflection.kind) {
    case 'attr':
      setAttr(el, reflection.name, reflection.value);
      break;
    case 'boolean-attr':
      if (reflection.present) setAttr(el, reflection.name, '');
      else removeAttr(el, reflection.name);
      break;
    case 'text':
      setText(el, reflection.value);
      break;
    case 'select': {
      const options: SSRElement[] = [];
      collectOptionElements(el, options);
      for (const option of options) {
        const optionValue = option.attributes['value'] ?? optionText(option);
        if (optionValue === reflection.value) setAttr(option, 'selected', '');
        else removeAttr(option, 'selected');
      }
      break;
    }
    case 'none':
      break;
  }
};

const setHtml = (el: SSRElement, raw: string): void => {
  // Parse the sanitized HTML and replace children with the resulting tree.
  const fragment = parseTemplate(raw);
  el.children = fragment.children;
};

export const sanitizeHtmlForSSR = (raw: string): string => {
  const sanitizeNode = (node: SSRNode): SSRNode | null => {
    if (node.type === 'fragment') {
      node.children = node.children.flatMap((child) => {
        const sanitized = sanitizeNode(child);
        return sanitized ? [sanitized] : [];
      });
      return node;
    }

    if (node.type !== 'element') {
      return node;
    }

    if (DANGEROUS_TAGS.has(node.tag) || !DEFAULT_ALLOWED_TAGS.has(node.tag)) {
      return null;
    }

    for (const name of [...node.attributeOrder]) {
      const value = node.attributes[name];
      const attrName = name.toLowerCase();

      if (!isAllowedHtmlAttribute(attrName)) {
        removeAttr(node, name);
        continue;
      }

      if ((attrName === 'id' || attrName === 'name') && !isSafeHtmlIdOrName(value)) {
        removeAttr(node, name);
        continue;
      }

      if ((attrName === 'href' || attrName === 'src') && isUnsafeUrlValue(value)) {
        removeAttr(node, name);
        continue;
      }
    }

    if (node.tag === 'a') {
      const href = node.attributes.href;
      const target = node.attributes.target;
      const hasTargetBlank = target?.toLowerCase() === '_blank';
      const isExternal = href ? isExternalHtmlUrl(href) : false;

      if (hasTargetBlank || isExternal) {
        const relValues = new Set(
          (node.attributes.rel ?? '').trim().split(REL_SPLIT_PATTERN).filter(Boolean)
        );
        relValues.add('noopener');
        relValues.add('noreferrer');
        setAttr(node, 'rel', Array.from(relValues).join(' '));
      }
    }

    node.children = node.children.flatMap((child) => {
      const sanitized = sanitizeNode(child);
      return sanitized ? [sanitized] : [];
    });

    return node;
  };

  return serializeTree(sanitizeNode(parseTemplate(raw)) ?? { type: 'fragment', children: [] });
};

const evaluateChildren = (parent: SSRElement, context: BindingContext, opts: RenderOpts): void => {
  const out: SSRNode[] = [];
  for (const child of parent.children) {
    if (child.type !== 'element') {
      out.push(child);
      continue;
    }
    const result = evaluateElement(child, context, opts);
    if (result === null) continue;
    if (Array.isArray(result)) {
      for (const r of result) out.push(r);
    } else {
      out.push(result);
    }
  }
  parent.children = out;
};

/**
 * Evaluates directives on a single element. Returns:
 * - `null` to remove the element (e.g. `bq-if` falsy);
 * - an array to replace the element with N siblings (e.g. `bq-for`);
 * - the element itself (possibly mutated) otherwise.
 */
const evaluateElement = (
  el: SSRElement,
  context: BindingContext,
  opts: RenderOpts
): SSRNode | SSRNode[] | null => {
  const { prefix } = opts;

  // bq-for: handled before bq-if/etc. so each clone is processed independently.
  const forExpr = el.attributes[`${prefix}-for`];
  if (forExpr !== undefined) {
    const parsed = parseForExpression(forExpr);
    if (!parsed) {
      removeAttr(el, `${prefix}-for`);
    }
    if (parsed) {
      const list = evaluateExpression<unknown>(parsed.listExpr, context);
      if (!Array.isArray(list)) return null;
      const out: SSRNode[] = [];
      for (let i = 0; i < list.length; i++) {
        const clone = cloneNode(el) as SSRElement;
        removeAttr(clone, `${prefix}-for`);
        removeAttr(clone, `${prefix}-key`);
        removeAttr(clone, ':key');
        const childCtx: BindingContext = {
          ...context,
          [parsed.itemName]: list[i],
        };
        if (parsed.indexName) childCtx[parsed.indexName] = i;
        const result = evaluateElement(clone, childCtx, opts);
        if (result === null) continue;
        if (Array.isArray(result)) out.push(...result);
        else out.push(result);
      }
      return out;
    }
  }

  // Capture directive signature for hydration mismatch detection (before stripping).
  const signature = opts.annotateHydration ? collectDirectiveSignature(el, prefix) : '';

  // bq-if
  const ifExpr = el.attributes[`${prefix}-if`];
  if (ifExpr !== undefined) {
    const cond = evaluateExpression<unknown>(ifExpr, context);
    if (!cond) return null;
  }

  // bq-show
  const showExpr = el.attributes[`${prefix}-show`];
  if (showExpr !== undefined) {
    const cond = evaluateExpression<unknown>(showExpr, context);
    if (!cond) {
      setStyle(el, { display: 'none' });
    }
  }

  // bq-text
  const textExpr = el.attributes[`${prefix}-text`];
  if (textExpr !== undefined) {
    const value = evaluateExpression<unknown>(textExpr, context);
    setText(el, String(value ?? ''));
  }

  // bq-html
  const htmlExpr = el.attributes[`${prefix}-html`];
  if (htmlExpr !== undefined) {
    const value = evaluateExpression<unknown>(htmlExpr, context);
    setHtml(el, sanitizeHtmlForSSR(String(value ?? '')));
  }

  // bq-class
  const classExpr = el.attributes[`${prefix}-class`];
  if (classExpr !== undefined) {
    const trimmed = classExpr.trim();
    if (trimmed.startsWith('{')) {
      const inner = trimmed.slice(1, -1);
      const pairs = inner.split(',');
      for (const pair of pairs) {
        const colon = pair.indexOf(':');
        if (colon < 0) continue;
        const name = pair
          .slice(0, colon)
          .trim()
          .replace(/^['"]|['"]$/g, '');
        const cond = evaluateExpression<unknown>(pair.slice(colon + 1), context);
        if (cond) setClass(el, name);
      }
    } else {
      const result = evaluateExpression<unknown>(classExpr, context);
      if (typeof result === 'string') {
        for (const cls of result.split(/\s+/).filter(Boolean)) setClass(el, cls);
      } else if (Array.isArray(result)) {
        for (const cls of result) {
          if (typeof cls === 'string' && cls) setClass(el, cls);
        }
      } else if (result && typeof result === 'object') {
        for (const [name, cond] of Object.entries(result as Record<string, unknown>)) {
          if (cond) setClass(el, name);
        }
      }
    }
  }

  // bq-style
  const styleExpr = el.attributes[`${prefix}-style`];
  if (styleExpr !== undefined) {
    const result = evaluateExpression<unknown>(styleExpr, context);
    if (result && typeof result === 'object') {
      setStyle(el, result as Record<string, unknown>);
    }
  }

  // bq-bind:*
  for (const name of [...el.attributeOrder]) {
    if (!name.startsWith(`${prefix}-bind:`)) continue;
    const attrName = name.slice(`${prefix}-bind:`.length);
    const value = evaluateExpression<unknown>(el.attributes[name], context);
    if (value === false || value == null) {
      removeAttr(el, attrName);
    } else if (value === true) {
      setAttr(el, attrName, '');
    } else {
      setAttr(el, attrName, String(value));
    }
  }

  // bq-model / bq-on — interactive directive parity (#128).
  if (opts.mode === 'full') {
    const modelExpr = el.attributes[`${prefix}-model`];
    if (modelExpr !== undefined) {
      applyModelToPureElement(el, evaluateExpression<unknown>(modelExpr, context));
    }
    const onEvents = collectOnEvents(el.attributeOrder, prefix);
    if (onEvents.length > 0) {
      setAttr(el, SSR_ON_MARKER_ATTR, onEvents.join(' '));
    }
  }

  // Report directives that this backend cannot server-render.
  if (opts.onUnsupported !== 'ignore') {
    for (const name of el.attributeOrder) {
      const head = directiveHead(name, prefix);
      if (!head) continue;
      const kind = classifyUnsupportedDirective(head, opts.mode);
      if (kind) reportUnsupportedDirective(name, el.tag, kind, opts.onUnsupported);
    }
  }

  // Drop on*-attributes and unsafe URL attributes for security parity with the
  // legacy serializer.
  for (const name of [...el.attributeOrder]) {
    const n = name.toLowerCase();
    if (n.startsWith('on')) {
      removeAttr(el, name);
      continue;
    }
    if (isUnsafeUrlAttribute(n) && isUnsafeUrlValue(el.attributes[name] ?? '')) {
      removeAttr(el, name);
    }
  }

  if (el.tag === 'script') {
    return null;
  }

  // Recurse into children
  evaluateChildren(el, context, opts);

  if (signature) {
    setAttr(el, HYDRATION_HASH_ATTR, cheapHash(signature));
  }

  return el;
};

/**
 * Renders a template through the DOM-free pipeline.
 *
 * @internal
 */
export const renderTemplatePure = (
  template: string,
  data: BindingContext,
  options: {
    prefix?: string;
    stripDirectives?: boolean;
    annotateHydration?: boolean;
    mode?: SSRDirectiveMode;
    onUnsupported?: UnsupportedDirectiveStrategy;
  } = {}
): string => {
  const opts: RenderOpts = {
    prefix: options.prefix ?? 'bq',
    stripDirectives: options.stripDirectives ?? false,
    annotateHydration: options.annotateHydration ?? false,
    mode: options.mode ?? 'static',
    onUnsupported: options.onUnsupported ?? 'ignore',
  };

  const fragment = parseTemplate(template);
  evaluateChildren(fragment as unknown as SSRElement, data, opts);

  if (opts.stripDirectives) {
    stripDirectiveAttributes(fragment, opts.prefix);
  }

  return serializeTree(fragment);
};
