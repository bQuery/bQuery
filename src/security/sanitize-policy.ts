/**
 * The sanitization policy, shared by both sanitizer backends.
 *
 * There are two parsers — the DOM one in `sanitize-dom.ts` and the DOM-free
 * one in `sanitize-string.ts` — but there must only ever be one set of rules
 * about what is safe. Every predicate a backend needs lives here, so a policy
 * change cannot land in one backend and miss the other.
 *
 * @module bquery/security
 * @internal
 */

import {
  DANGEROUS_ATTR_PREFIXES,
  DANGEROUS_PROTOCOLS,
  DANGEROUS_TAGS,
  DEFAULT_ALLOWED_ATTRIBUTES,
  DEFAULT_ALLOWED_TAGS,
  RESERVED_IDS,
} from './constants';
import type { SanitizeOptions } from './types';

/** The resolved allow lists for one `sanitizeHtml()` call. */
export interface SanitizePolicy {
  allowedTags: Set<string>;
  allowedAttrs: Set<string>;
  allowDataAttributes: boolean;
  stripAllTags: boolean;
}

/**
 * Resolve caller options into allow sets. Dangerous tags are filtered out even
 * when explicitly allowed, so `allowTags: ['script']` cannot open a hole.
 * @internal
 */
export const resolvePolicy = (options: SanitizeOptions = {}): SanitizePolicy => {
  const {
    allowTags = [],
    allowAttributes = [],
    allowDataAttributes = true,
    stripAllTags = false,
  } = options;

  return {
    allowedTags: new Set(
      [...DEFAULT_ALLOWED_TAGS, ...allowTags.map((tag) => tag.toLowerCase())].filter(
        (tag) => !DANGEROUS_TAGS.has(tag)
      )
    ),
    allowedAttrs: new Set([
      ...DEFAULT_ALLOWED_ATTRIBUTES,
      ...allowAttributes.map((attr) => attr.toLowerCase()),
    ]),
    allowDataAttributes,
    stripAllTags,
  };
};

/** Whether an element may appear in the output at all. @internal */
export const isAllowedTag = (tagName: string, policy: SanitizePolicy): boolean =>
  !DANGEROUS_TAGS.has(tagName) && policy.allowedTags.has(tagName);

/**
 * Check if an attribute name is allowed.
 * @internal
 */
export const isAllowedAttribute = (
  name: string,
  allowedSet: Set<string>,
  allowDataAttrs: boolean
): boolean => {
  const lowerName = name.toLowerCase();

  // Check dangerous prefixes
  for (const prefix of DANGEROUS_ATTR_PREFIXES) {
    if (lowerName.startsWith(prefix)) return false;
  }

  // Check data attributes
  if (allowDataAttrs && lowerName.startsWith('data-')) return true;

  // Check aria attributes (allowed by default)
  if (lowerName.startsWith('aria-')) return true;

  // Check explicit allow list
  return allowedSet.has(lowerName);
};

/**
 * An attribute name safe to serialize into a tag. Deliberately stricter than
 * what the HTML spec tolerates: anything outside this shape is dropped rather
 * than emitted, so the output cannot depend on a consumer's error recovery.
 *
 * Shared by every serializer — the string sanitizer backend and the SSR
 * renderer — because an emitter that trusts its parser to have rejected a
 * hostile name inherits that parser's blind spots. `src/ssr/html-parser.ts`
 * stops an attribute name at whitespace, `=`, `>` and `/`, but not at a quote,
 * so a name can carry one. Validating at the point of emission means no such
 * gap can reach output.
 * @internal
 */
export const VALID_ATTRIBUTE_NAME = /^[a-zA-Z_:][a-zA-Z0-9_:.-]*$/;

/**
 * Whether an attribute name is safe to serialize into a tag.
 * @internal
 */
export const isValidAttributeName = (name: string): boolean => VALID_ATTRIBUTE_NAME.test(name);

/**
 * A tag name safe to serialize. Covers HTML elements and custom elements,
 * and nothing that could close or open a tag on its own.
 * @internal
 */
export const VALID_TAG_NAME = /^[a-zA-Z][a-zA-Z0-9._:-]*$/;

/**
 * Whether a tag name is safe to serialize.
 * @internal
 */
export const isValidTagName = (tag: string): boolean => VALID_TAG_NAME.test(tag);

/**
 * Escape HTML entities so text is inert when assigned to an HTML sink.
 * @internal
 */
export const escapeHtmlText = (text: string): string => {
  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;',
  };
  return text.replace(/[&<>"'`]/g, (char) => escapeMap[char]);
};

/**
 * Check if an ID/name value could cause DOM clobbering.
 * @internal
 */
export const isSafeIdOrName = (value: string): boolean => {
  const lowerValue = value.toLowerCase().trim();
  return !RESERVED_IDS.has(lowerValue);
};

/**
 * Normalize URL by removing control characters, whitespace, and Unicode tricks.
 * Enhanced to prevent various bypass techniques.
 * @internal
 */
const normalizeUrl = (value: string): string =>
  value
    // Remove null bytes and control characters
    .replace(/[\u0000-\u001F\u007F]+/g, '')
    // Remove zero-width characters that could hide malicious content
    .replace(/[\u200B-\u200D\uFEFF\u2028\u2029]+/g, '')
    // Remove escaped Unicode sequences
    .replace(/\\u[\da-fA-F]{4}/g, '')
    // Remove whitespace
    .replace(/\s+/g, '')
    // Normalize case
    .toLowerCase();

/**
 * Check if a URL value is safe.
 * @internal
 */
export const isSafeUrl = (value: string): boolean => {
  const normalized = normalizeUrl(value);
  for (const protocol of DANGEROUS_PROTOCOLS) {
    if (normalized.startsWith(protocol)) return false;
  }
  return true;
};

/**
 * Check if a srcset attribute value is safe.
 * srcset contains comma-separated entries of "url [descriptor]".
 * Each individual URL must be validated.
 * @internal
 */
export const isSafeSrcset = (value: string): boolean => {
  const entries = value.split(',');
  for (const entry of entries) {
    const url = entry.trim().split(/\s+/)[0];
    if (url && !isSafeUrl(url)) return false;
  }
  return true;
};

/** Attributes whose value is a single URL. @internal */
export const URL_ATTRIBUTES = new Set(['href', 'src', 'action']);

/**
 * Check if a URL is external (different origin).
 * @internal
 */
export const isExternalUrl = (url: string): boolean => {
  try {
    // Normalize URL by trimming whitespace
    const trimmedUrl = url.trim();

    // Protocol-relative URLs (//example.com) are always external.
    // CRITICAL: This check must run before the relative-URL check below;
    // otherwise, a protocol-relative URL like "//evil.com" would be treated
    // as a non-http(s) relative URL and incorrectly classified as same-origin.
    // Handling them up front guarantees correct security classification.
    if (trimmedUrl.startsWith('//')) {
      return true;
    }

    // Normalize URL for case-insensitive protocol checks
    const lowerUrl = trimmedUrl.toLowerCase();

    // Check for non-http(s) protocols which are considered external/special
    // (mailto:, tel:, ftp:, etc.)
    const hasProtocol = /^[a-z][a-z0-9+.-]*:/i.test(trimmedUrl);
    if (hasProtocol && !lowerUrl.startsWith('http://') && !lowerUrl.startsWith('https://')) {
      // These are special protocols, not traditional "external" links
      // but we treat them as external for security consistency
      return true;
    }

    // Relative URLs are not external
    if (!lowerUrl.startsWith('http://') && !lowerUrl.startsWith('https://')) {
      return false;
    }

    // In non-browser environments (e.g., Node.js), treat all absolute URLs as external
    if (typeof window === 'undefined' || !window.location) {
      return true;
    }

    const urlObj = new URL(trimmedUrl, window.location.href);
    return urlObj.origin !== window.location.origin;
  } catch {
    // If URL parsing fails, treat as potentially external for safety
    return true;
  }
};

/**
 * The `rel` value an `<a>` should carry, or null to leave it alone.
 *
 * External links and `target="_blank"` links get `noopener noreferrer`, which
 * closes the reverse-tabnabbing hole. Existing `rel` tokens are preserved.
 * @internal
 */
export const relForAnchor = (
  href: string | null,
  target: string | null,
  existingRel: string | null
): string | null => {
  const hasTargetBlank = target?.toLowerCase() === '_blank';
  const isExternal = Boolean(href) && isExternalUrl(href as string);
  if (!hasTargetBlank && !isExternal) return null;

  const relValues = new Set(existingRel ? existingRel.split(/\s+/).filter(Boolean) : []);
  relValues.add('noopener');
  relValues.add('noreferrer');
  return Array.from(relValues).join(' ');
};

/**
 * Decide whether one attribute survives, given the element's policy and the
 * ids already emitted in this fragment.
 *
 * Duplicate ids are dropped because two elements sharing an id turn
 * `document.getElementById`/named access into a clobberable HTMLCollection
 * (the classic `<a id=x><a id=x name=y>` vector). The first occurrence wins.
 * @internal
 */
export const isAttributeAllowed = (
  name: string,
  value: string,
  policy: SanitizePolicy,
  seenIds: Set<string>
): boolean => {
  const attrName = name.toLowerCase();

  if (!isAllowedAttribute(attrName, policy.allowedAttrs, policy.allowDataAttributes)) {
    return false;
  }

  // Check for DOM clobbering on id and name attributes
  if ((attrName === 'id' || attrName === 'name') && !isSafeIdOrName(value)) {
    return false;
  }

  if (attrName === 'id') {
    const idValue = value.trim();
    if (seenIds.has(idValue)) return false;
    seenIds.add(idValue);
  }

  if (URL_ATTRIBUTES.has(attrName) && !isSafeUrl(value)) {
    return false;
  }

  if (attrName === 'srcset' && !isSafeSrcset(value)) {
    return false;
  }

  return true;
};
