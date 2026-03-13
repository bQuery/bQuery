/**
 * Security module providing sanitization, CSP compatibility, and Trusted Types.
 *
 * @module bquery/security
 */

export { generateNonce, hasCSPDirective } from './csp';
export {
  escapeHtml,
  sanitizeHtml as sanitize,
  sanitizeHtml,
  stripTags,
} from './sanitize';
export { trusted } from './trusted-html';
export { createTrustedHtml, getTrustedTypesPolicy, isTrustedTypesSupported } from './trusted-types';
export type { SanitizedHtml, TrustedHtml } from './trusted-html';
export type { SanitizeOptions } from './sanitize';
