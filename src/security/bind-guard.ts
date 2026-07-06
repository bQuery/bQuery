/**
 * Attribute-binding guards shared by the client `bq-bind` directive and the
 * SSR renderers.
 *
 * The attribute *name* comes from the template (author-trusted), but the
 * *value* is runtime data — exactly the class of input the framework tells
 * authors is safe to bind. URL-bearing attributes must therefore reject
 * dangerous protocols, inline event handlers must never be bindable, and
 * `srcdoc` must be treated as an HTML sink (the browser entity-decodes the
 * attribute and parses it as a full document, so attribute-escaping alone is
 * insufficient).
 *
 * @module bquery/security
 * @internal
 */

import { DANGEROUS_PROTOCOLS } from './constants';

/**
 * Attributes whose values the browser resolves as URLs.
 * @internal
 */
export const URL_BIND_ATTRIBUTES = new Set([
  'href',
  'src',
  'xlink:href',
  'formaction',
  'action',
  'poster',
  'background',
  'cite',
  'data',
]);

/**
 * Normalize a URL for protocol checks, stripping control characters,
 * zero-width characters, escaped Unicode sequences, and whitespace that
 * could hide a dangerous protocol.
 * @internal
 */
const normalizeUrlForCheck = (value: string): string =>
  value
    .replace(/[\u0000-\u001F\u007F]+/g, '')
    .replace(/[\u200B-\u200D\uFEFF\u2028\u2029]+/g, '')
    .replace(/\\u[\da-fA-F]{4}/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();

/**
 * Check whether a URL value bound to an attribute uses a safe protocol.
 * @internal
 */
export const isSafeBindUrl = (value: string): boolean => {
  const normalized = normalizeUrlForCheck(value);
  return !DANGEROUS_PROTOCOLS.some((protocol) => normalized.startsWith(protocol));
};

/**
 * Check every URL in a srcset value (comma-separated "url [descriptor]").
 * @internal
 */
export const isSafeBindSrcset = (value: string): boolean =>
  value.split(',').every((entry) => {
    const url = entry.trim().split(/\s+/)[0];
    return !url || isSafeBindUrl(url);
  });

/**
 * How a runtime-bound attribute value may be applied:
 * - `'set'` — safe to write as-is
 * - `'drop'` — must not be written (inline handler or unsafe URL)
 * - `'sanitize-html'` — value is an HTML sink and must be sanitized first
 * @internal
 */
export type BindAttributeVerdict = 'set' | 'drop' | 'sanitize-html';

/**
 * Decide how a runtime-bound attribute value may be applied to an element.
 * @internal
 */
export const checkBoundAttribute = (name: string, value: string): BindAttributeVerdict => {
  const n = name.toLowerCase();
  if (n.startsWith('on')) return 'drop';
  if (n === 'srcdoc') return 'sanitize-html';
  if (n === 'srcset') return isSafeBindSrcset(value) ? 'set' : 'drop';
  if (URL_BIND_ATTRIBUTES.has(n) && !isSafeBindUrl(value)) return 'drop';
  return 'set';
};
