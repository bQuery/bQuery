/**
 * Security module providing sanitization, CSP compatibility, and Trusted Types.
 *
 * @module bquery/security
 */

export {
  createTrustedHtml,
  escapeHtml,
  generateNonce,
  getTrustedTypesPolicy,
  hasCSPDirective,
  isTrustedTypesSupported,
  sanitizeHtml as sanitize,
  sanitizeHtml,
  stripTags,
} from './sanitize';
export type { SanitizeOptions } from './sanitize';
