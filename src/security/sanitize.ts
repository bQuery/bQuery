/**
 * Security utilities for HTML sanitization, CSP compatibility, and Trusted Types.
 * All DOM writes are sanitized by default to prevent XSS attacks.
 *
 * @module bquery/security
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Sanitizer configuration options.
 */
export interface SanitizeOptions {
  /** Allow these additional tags (default: none) */
  allowTags?: string[];
  /** Allow these additional attributes (default: none) */
  allowAttributes?: string[];
  /** Allow data-* attributes (default: true) */
  allowDataAttributes?: boolean;
  /** Strip all tags and return plain text (default: false) */
  stripAllTags?: boolean;
}

/**
 * Trusted Types policy name.
 */
const POLICY_NAME = 'bquery-sanitizer';

// ============================================================================
// Trusted Types Support
// ============================================================================

/** Window interface extended with Trusted Types */
interface TrustedTypesWindow extends Window {
  trustedTypes?: {
    createPolicy: (
      name: string,
      rules: { createHTML?: (input: string) => string }
    ) => TrustedTypePolicy;
    isHTML?: (value: unknown) => boolean;
  };
}

/** Trusted Types policy interface */
interface TrustedTypePolicy {
  createHTML: (input: string) => TrustedHTML;
}

/** Trusted HTML type placeholder for environments without Trusted Types */
interface TrustedHTML {
  toString(): string;
}

/** Cached Trusted Types policy */
let cachedPolicy: TrustedTypePolicy | null = null;

/**
 * Check if Trusted Types API is available.
 * @returns True if Trusted Types are supported
 */
export const isTrustedTypesSupported = (): boolean => {
  return typeof (window as TrustedTypesWindow).trustedTypes !== 'undefined';
};

/**
 * Get or create the bQuery Trusted Types policy.
 * @returns The Trusted Types policy or null if unsupported
 */
export const getTrustedTypesPolicy = (): TrustedTypePolicy | null => {
  if (cachedPolicy) return cachedPolicy;

  const win = window as TrustedTypesWindow;
  if (!win.trustedTypes) return null;

  try {
    cachedPolicy = win.trustedTypes.createPolicy(POLICY_NAME, {
      createHTML: (input: string) => sanitizeHtmlCore(input),
    });
    return cachedPolicy;
  } catch {
    // Policy may already exist or be blocked by CSP
    console.warn(`bQuery: Could not create Trusted Types policy "${POLICY_NAME}"`);
    return null;
  }
};

// ============================================================================
// Default Safe Lists
// ============================================================================

/**
 * Default allowed HTML tags considered safe.
 */
const DEFAULT_ALLOWED_TAGS = new Set([
  'a',
  'abbr',
  'address',
  'article',
  'aside',
  'b',
  'bdi',
  'bdo',
  'blockquote',
  'br',
  'button',
  'caption',
  'cite',
  'code',
  'col',
  'colgroup',
  'data',
  'dd',
  'del',
  'details',
  'dfn',
  'div',
  'dl',
  'dt',
  'em',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hgroup',
  'hr',
  'i',
  'img',
  'input',
  'ins',
  'kbd',
  'label',
  'legend',
  'li',
  'main',
  'mark',
  'nav',
  'ol',
  'optgroup',
  'option',
  'p',
  'picture',
  'pre',
  'progress',
  'q',
  'rp',
  'rt',
  'ruby',
  's',
  'samp',
  'section',
  'select',
  'small',
  'source',
  'span',
  'strong',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'textarea',
  'tfoot',
  'th',
  'thead',
  'time',
  'tr',
  'u',
  'ul',
  'var',
  'wbr',
]);

/**
 * Explicitly dangerous tags that should never be allowed.
 * These are checked even if somehow added to allowTags.
 */
const DANGEROUS_TAGS = new Set([
  'script',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'applet',
  'link',
  'meta',
  'style',
  'base',
  'template',
  'slot',
  'math',
  'svg',
  'foreignobject',
  'noscript',
]);

/**
 * Reserved IDs that could cause DOM clobbering attacks.
 * These are prevented to avoid overwriting global browser objects.
 */
const RESERVED_IDS = new Set([
  // Global objects
  'document',
  'window',
  'location',
  'top',
  'self',
  'parent',
  'frames',
  'history',
  'navigator',
  'screen',
  // Dangerous functions
  'alert',
  'confirm',
  'prompt',
  'eval',
  'Function',
  // Document properties
  'cookie',
  'domain',
  'referrer',
  'body',
  'head',
  'forms',
  'images',
  'links',
  'scripts',
  // DOM traversal properties
  'children',
  'parentNode',
  'firstChild',
  'lastChild',
  // Content manipulation
  'innerHTML',
  'outerHTML',
  'textContent',
]);

/**
 * Default allowed attributes considered safe.
 */
const DEFAULT_ALLOWED_ATTRIBUTES = new Set([
  'alt',
  'class',
  'dir',
  'height',
  'hidden',
  'href',
  'id',
  'lang',
  'loading',
  'name',
  'rel',
  'role',
  'src',
  'srcset',
  'style',
  'tabindex',
  'target',
  'title',
  'type',
  'width',
  'aria-*',
]);

/**
 * Dangerous attribute prefixes to always remove.
 */
const DANGEROUS_ATTR_PREFIXES = ['on', 'formaction', 'xlink:', 'xmlns:'];

/**
 * Dangerous URL protocols to block.
 */
const DANGEROUS_PROTOCOLS = ['javascript:', 'data:', 'vbscript:', 'file:'];

// ============================================================================
// Core Sanitization
// ============================================================================

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
    
    // Protocol-relative URLs (//example.com) are always external
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
 * Core sanitization logic (without Trusted Types wrapper).
 * @internal
 */
const sanitizeHtmlCore = (html: string, options: SanitizeOptions = {}): string => {
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

  // Use template for parsing
  const template = document.createElement('template');
  template.innerHTML = html;

  if (stripAllTags) {
    return template.content.textContent ?? '';
  }

  // Walk the DOM tree
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);

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
        const relValues = new Set(
          existingRel ? existingRel.split(/\s+/).filter(Boolean) : []
        );
        
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

  return template.innerHTML;
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Sanitize HTML string, removing dangerous elements and attributes.
 * Uses Trusted Types when available for CSP compliance.
 *
 * @param html - The HTML string to sanitize
 * @param options - Sanitization options
 * @returns Sanitized HTML string
 *
 * @example
 * ```ts
 * const safe = sanitizeHtml('<div onclick="alert(1)">Hello</div>');
 * // Returns: '<div>Hello</div>'
 * ```
 */
export const sanitizeHtml = (html: string, options: SanitizeOptions = {}): string => {
  return sanitizeHtmlCore(html, options);
};

/**
 * Create a Trusted HTML value for use with Trusted Types-enabled sites.
 * Falls back to regular string when Trusted Types are unavailable.
 *
 * @param html - The HTML string to wrap
 * @returns Trusted HTML value or sanitized string
 */
export const createTrustedHtml = (html: string): TrustedHTML | string => {
  const policy = getTrustedTypesPolicy();
  if (policy) {
    return policy.createHTML(html);
  }
  return sanitizeHtml(html);
};

/**
 * Escape HTML entities to prevent XSS.
 * Use this for displaying user content as text.
 *
 * @param text - The text to escape
 * @returns Escaped HTML string
 *
 * @example
 * ```ts
 * escapeHtml('<script>alert(1)</script>');
 * // Returns: '&lt;script&gt;alert(1)&lt;/script&gt;'
 * ```
 */
export const escapeHtml = (text: string): string => {
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
 * Strip all HTML tags and return plain text.
 *
 * @param html - The HTML string to strip
 * @returns Plain text content
 */
export const stripTags = (html: string): string => {
  return sanitizeHtmlCore(html, { stripAllTags: true });
};

// ============================================================================
// CSP Helpers
// ============================================================================

/**
 * Generate a nonce for inline scripts/styles.
 * Use with Content-Security-Policy nonce directives.
 *
 * @param length - Nonce length (default: 16)
 * @returns Cryptographically random nonce string
 */
export const generateNonce = (length: number = 16): string => {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

/**
 * Check if a CSP header is present with specific directive.
 * Useful for feature detection and fallback strategies.
 *
 * @param directive - The CSP directive to check (e.g., 'script-src')
 * @returns True if the directive appears to be enforced
 */
export const hasCSPDirective = (directive: string): boolean => {
  // Check meta tag
  const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  if (meta) {
    const content = meta.getAttribute('content') ?? '';
    return content.includes(directive);
  }
  return false;
};
