/**
 * Content Security Policy helpers.
 *
 * @module bquery/security
 */

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
