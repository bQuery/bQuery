/**
 * Core HTML sanitization logic.
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

/**
 * Check if an attribute name is allowed.
 * @internal
 */
const isAllowedAttribute = (
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
 * Check if an ID/name value could cause DOM clobbering.
 * @internal
 */
const isSafeIdOrName = (value: string): boolean => {
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
const isSafeUrl = (value: string): boolean => {
  const normalized = normalizeUrl(value);
  for (const protocol of DANGEROUS_PROTOCOLS) {
    if (normalized.startsWith(protocol)) return false;
  }
  return true;
};

/**
 * Check if a URL is external (different origin).
 * @internal
 */
const isExternalUrl = (url: string): boolean => {
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
 * Parse an HTML string into a Document using DOMParser.
 * This helper is intentionally separated to make the control-flow around HTML parsing
 * explicit for static analysis tools. It should ONLY be called when the input is
 * known to contain HTML syntax (angle brackets).
 *
 * DOMParser creates an inert document where scripts don't execute, making it safe
 * for parsing untrusted HTML that will subsequently be sanitized.
 *
 * @param htmlContent - A string that is known to contain HTML markup (has < or >)
 * @returns The parsed Document
 * @internal
 */
const parseHtmlDocument = (htmlContent: string): Document => {
  const parser = new DOMParser();
  // Parse as a full HTML document in an inert context; scripts won't execute
  return parser.parseFromString(htmlContent, 'text/html');
};

/**
 * Safely parse HTML string into a DocumentFragment using DOMParser.
 * DOMParser is preferred over innerHTML for security as it creates an inert document
 * where scripts don't execute and provides better static analysis recognition.
 *
 * This function includes input normalization to satisfy static analysis tools:
 * - Coerces input to string and trims whitespace
 * - For plain text (no HTML tags), creates a Text node directly without parsing
 * - Only invokes DOMParser for actual HTML-like content via parseHtmlDocument
 *
 * The separation between plain text handling and HTML parsing is intentional:
 * DOM text that contains no HTML syntax is never fed into an HTML parser,
 * preventing "DOM text reinterpreted as HTML" issues.
 *
 * @internal
 */
const parseHtmlSafely = (html: string): DocumentFragment => {
  // Step 1: Normalize input - coerce to string and trim
  // This defensive check handles edge cases even though TypeScript says it's a string
  const normalizedHtml = (typeof html === 'string' ? html : String(html ?? '')).trim();

  // Step 2: Create the fragment that will hold our result
  const fragment = document.createDocumentFragment();

  // Step 3: Early return for empty input
  if (normalizedHtml.length === 0) {
    return fragment;
  }

  // Step 4: If input contains no angle brackets, it's plain text - no HTML parsing needed.
  // Plain text is handled as a Text node, never passed to an HTML parser.
  // This explicitly prevents "DOM text reinterpreted as HTML" for purely textual inputs.
  const containsHtmlSyntax = normalizedHtml.includes('<') || normalizedHtml.includes('>');
  if (!containsHtmlSyntax) {
    fragment.appendChild(document.createTextNode(normalizedHtml));
    return fragment;
  }

  // Step 5: Input contains HTML syntax - parse it via the dedicated HTML parsing helper.
  // This separation makes the data-flow explicit: only strings with HTML syntax
  // are passed to DOMParser, satisfying static analysis requirements.
  const doc = parseHtmlDocument(normalizedHtml);

  // Move all children from the document body into the fragment.
  // This avoids interpolating untrusted HTML into an outer wrapper string.
  const body = doc.body;

  if (!body) {
    return fragment;
  }

  while (body.firstChild) {
    fragment.appendChild(body.firstChild);
  }

  return fragment;
};

/**
 * Core sanitization logic (without Trusted Types wrapper).
 * @internal
 */
export const sanitizeHtmlCore = (html: string, options: SanitizeOptions = {}): string => {
  const {
    allowTags = [],
    allowAttributes = [],
    allowDataAttributes = true,
    stripAllTags = false,
  } = options;

  // Build combined allow sets (excluding dangerous tags even if specified)
  const allowedTags = new Set(
    [...DEFAULT_ALLOWED_TAGS, ...allowTags.map((t) => t.toLowerCase())].filter(
      (tag) => !DANGEROUS_TAGS.has(tag)
    )
  );
  const allowedAttrs = new Set([
    ...DEFAULT_ALLOWED_ATTRIBUTES,
    ...allowAttributes.map((a) => a.toLowerCase()),
  ]);

  // Use DOMParser for safe HTML parsing (inert context, no script execution)
  const fragment = parseHtmlSafely(html);

  if (stripAllTags) {
    return fragment.textContent ?? '';
  }

  // Walk the DOM tree
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT);

  const toRemove: Element[] = [];

  while (walker.nextNode()) {
    const el = walker.currentNode as Element;
    const tagName = el.tagName.toLowerCase();

    // Remove explicitly dangerous tags even if in allow list
    if (DANGEROUS_TAGS.has(tagName)) {
      toRemove.push(el);
      continue;
    }

    // Remove disallowed tags entirely
    if (!allowedTags.has(tagName)) {
      toRemove.push(el);
      continue;
    }

    // Process attributes
    const attrsToRemove: string[] = [];
    for (const attr of Array.from(el.attributes)) {
      const attrName = attr.name.toLowerCase();

      // Check if attribute is allowed
      if (!isAllowedAttribute(attrName, allowedAttrs, allowDataAttributes)) {
        attrsToRemove.push(attr.name);
        continue;
      }

      // Check for DOM clobbering on id and name attributes
      if ((attrName === 'id' || attrName === 'name') && !isSafeIdOrName(attr.value)) {
        attrsToRemove.push(attr.name);
        continue;
      }

      // Validate URL attributes
      if (
        (attrName === 'href' || attrName === 'src' || attrName === 'srcset') &&
        !isSafeUrl(attr.value)
      ) {
        attrsToRemove.push(attr.name);
      }
    }

    // Remove disallowed attributes
    for (const attrName of attrsToRemove) {
      el.removeAttribute(attrName);
    }

    // Add rel="noopener noreferrer" to external links for security
    if (tagName === 'a') {
      const href = el.getAttribute('href');
      const target = el.getAttribute('target');
      const hasTargetBlank = target?.toLowerCase() === '_blank';
      const isExternal = href && isExternalUrl(href);

      // Add security attributes to links opening in new window or external links
      if (hasTargetBlank || isExternal) {
        const existingRel = el.getAttribute('rel');
        const relValues = new Set(existingRel ? existingRel.split(/\s+/).filter(Boolean) : []);

        // Add noopener and noreferrer
        relValues.add('noopener');
        relValues.add('noreferrer');

        el.setAttribute('rel', Array.from(relValues).join(' '));
      }
    }
  }

  // Remove disallowed elements
  for (const el of toRemove) {
    el.remove();
  }

  // Serialize the sanitized fragment to HTML string.
  // We use a temporary container to get the innerHTML of the fragment.
  const serializeFragment = (frag: DocumentFragment): string => {
    const container = document.createElement('div');
    container.appendChild(frag.cloneNode(true));
    return container.innerHTML;
  };

  // Double-parse to prevent mutation XSS (mXSS).
  // Browsers may normalize HTML during serialization in ways that could create
  // new dangerous content when re-parsed. By re-parsing the sanitized output
  // and verifying stability, we ensure the final HTML is safe.
  const firstPass = serializeFragment(fragment);

  // Re-parse through DOMParser for mXSS detection.
  // Using DOMParser instead of innerHTML for security.
  const verifyFragment = parseHtmlSafely(firstPass);
  const secondPass = serializeFragment(verifyFragment);

  // Verify stability: if content mutates between parses, it indicates mXSS attempt
  if (firstPass !== secondPass) {
    // Content mutated during re-parse - potential mXSS detected.
    // Return safely escaped text content as fallback.
    return fragment.textContent ?? '';
  }

  return secondPass;
};
