/**
 * Shared escaping helpers for SSR inline script payloads and HTML attributes.
 *
 * @module bquery/ssr
 * @internal
 */

/**
 * Escapes a string for safe embedding in an inline `<script>` body.
 * @internal
 */
export const escapeForScript = (str: string): string =>
  str
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\//g, '\\u002f')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

/**
 * Escapes a string for safe embedding in an HTML attribute value.
 * @internal
 */
export const escapeForHtmlAttribute = (str: string): string =>
  str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
