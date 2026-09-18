/**
 * DOM-backed HTML sanitizer backend.
 *
 * Parses with `DOMParser` into an inert document, walks the tree applying the
 * shared policy from `sanitize-policy.ts`, and re-serializes. Used wherever a
 * DOM exists; `sanitize-string.ts` covers the runtimes that have none (#229).
 *
 * @module bquery/security
 * @internal
 */

import { DANGEROUS_TAGS } from './constants';
import { escapeHtmlText, isAttributeAllowed, relForAnchor, resolvePolicy } from './sanitize-policy';
import type { SanitizeOptions } from './types';

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
export const sanitizeHtmlDom = (html: string, options: SanitizeOptions = {}): string => {
  const policy = resolvePolicy(options);

  // Use DOMParser for safe HTML parsing (inert context, no script execution)
  const fragment = parseHtmlSafely(html);

  if (policy.stripAllTags) {
    return fragment.textContent ?? '';
  }

  // Walk the DOM tree
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT);

  const toRemove: Element[] = [];
  // Track ids already emitted so duplicate ids within the fragment are dropped:
  // two elements sharing an id turn `document.getElementById`/named access into
  // a clobberable HTMLCollection (the classic `<a id=x><a id=x name=y>` vector).
  const seenIds = new Set<string>();

  while (walker.nextNode()) {
    const el = walker.currentNode as Element;
    const tagName = el.tagName.toLowerCase();

    // Remove explicitly dangerous tags even if in allow list
    if (DANGEROUS_TAGS.has(tagName)) {
      toRemove.push(el);
      continue;
    }

    // Remove disallowed tags entirely
    if (!policy.allowedTags.has(tagName)) {
      toRemove.push(el);
      continue;
    }

    // Process attributes against the shared policy
    const attrsToRemove: string[] = [];
    for (const attr of Array.from(el.attributes)) {
      if (!isAttributeAllowed(attr.name, attr.value, policy, seenIds)) {
        attrsToRemove.push(attr.name);
      }
    }

    // Remove disallowed attributes
    for (const attrName of attrsToRemove) {
      el.removeAttribute(attrName);
    }

    // Add rel="noopener noreferrer" to external links for security
    if (tagName === 'a') {
      const rel = relForAnchor(
        el.getAttribute('href'),
        el.getAttribute('target'),
        el.getAttribute('rel')
      );
      if (rel !== null) el.setAttribute('rel', rel);
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
    // Callers assign this return value to HTML sinks (innerHTML etc.), so the
    // text fallback must be HTML-escaped: entity-decoded text nodes can contain
    // live markup (e.g. `&lt;img onerror=...&gt;` decoded to `<img onerror=...>`).
    return escapeHtmlText(fragment.textContent ?? '');
  }

  return secondPass;
};
