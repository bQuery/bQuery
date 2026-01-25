/**
 * Security module providing sanitization, CSP compatibility, and Trusted Types.
 *
 * @module bquery/security
 */

export { generateNonce, hasCSPDirective } from './csp';
export { escapeHtml, sanitizeHtml as sanitize, sanitizeHtml, stripTags } from './sanitize';
export { createTrustedHtml, getTrustedTypesPolicy, isTrustedTypesSupported } from './trusted-types';
export type { SanitizeOptions } from './types';
