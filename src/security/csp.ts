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
 * @throws {Error} If crypto.getRandomValues or btoa are not available
 */
export const generateNonce = (length: number = 16): string => {
  // Check for required globals in browser/crypto environments
  if (
    typeof globalThis.crypto === 'undefined' ||
    typeof globalThis.crypto.getRandomValues !== 'function'
  ) {
    throw new Error(
      'generateNonce requires crypto.getRandomValues (not available in this environment)'
    );
  }
  if (typeof globalThis.btoa !== 'function') {
    throw new Error('generateNonce requires btoa (not available in this environment)');
  }

  const array = new Uint8Array(length);
  globalThis.crypto.getRandomValues(array);
  return globalThis
    .btoa(String.fromCharCode(...array))
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
  // Guard for non-DOM environments (SSR, tests, etc.)
  if (typeof document === 'undefined') {
    return false;
  }

  // Check meta tag
  const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  if (meta) {
    const content = meta.getAttribute('content') ?? '';
    return content.includes(directive);
  }
  return false;
};
