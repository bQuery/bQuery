/**
 * Security utilities for HTML sanitization.
 * All DOM writes are sanitized by default to prevent XSS attacks.
 *
 * @module bquery/security
 */

import { sanitizeHtmlCore } from './sanitize-core';
import type { SanitizeOptions } from './types';

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

export type { SanitizeOptions } from './types';
