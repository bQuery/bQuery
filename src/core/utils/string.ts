/**
 * String-focused utility helpers.
 *
 * @module bquery/core/utils/string
 */

/**
 * Capitalizes the first letter of a string.
 *
 * @param str - The string to capitalize
 * @returns The capitalized string
 *
 * @example
 * ```ts
 * capitalize('hello'); // 'Hello'
 * ```
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Converts a string to kebab-case.
 *
 * @param str - The string to convert
 * @returns The kebab-cased string
 *
 * @example
 * ```ts
 * toKebabCase('myVariableName'); // 'my-variable-name'
 * ```
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * Converts a string to camelCase.
 *
 * @param str - The string to convert
 * @returns The camelCased string
 *
 * @example
 * ```ts
 * toCamelCase('my-variable-name'); // 'myVariableName'
 * ```
 */
export function toCamelCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, char) => (char ? char.toUpperCase() : ''))
    .replace(/^[A-Z]/, (char) => char.toLowerCase());
}

/**
 * Truncates a string to a maximum length.
 *
 * @param str - The string to truncate
 * @param maxLength - The maximum length
 * @param suffix - The suffix to append when truncating (default: '…')
 * @returns The truncated string
 *
 * @example
 * ```ts
 * truncate('Hello world', 8); // 'Hello w…'
 * ```
 */
export function truncate(str: string, maxLength: number, suffix = '…'): string {
  if (maxLength <= 0) return '';
  if (str.length <= maxLength) return str;
  const sliceLength = Math.max(0, maxLength - suffix.length);
  return `${str.slice(0, sliceLength)}${suffix}`;
}

/**
 * Converts a string to a URL-friendly slug.
 *
 * @param str - The string to slugify
 * @returns The slugified string
 *
 * @example
 * ```ts
 * slugify('Hello, World!'); // 'hello-world'
 * ```
 */
export function slugify(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .toLowerCase();
}

/**
 * Escapes a string for safe usage inside a RegExp.
 *
 * @param str - The string to escape
 * @returns The escaped string
 *
 * @example
 * ```ts
 * escapeRegExp('[a-z]+'); // '\\[a-z\\]+'
 * ```
 */
export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Converts a string to `snake_case`.
 *
 * @example
 * ```ts
 * toSnakeCase('myVariableName'); // 'my_variable_name'
 * toSnakeCase('MyVariableName'); // 'my_variable_name'
 * ```
 */
export function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

/**
 * Converts a string to `PascalCase`.
 *
 * @example
 * ```ts
 * toPascalCase('my-variable-name'); // 'MyVariableName'
 * ```
 */
export function toPascalCase(str: string): string {
  const camel = toCamelCase(str);
  if (!camel) return camel;
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/**
 * Converts a string to `Title Case`. Each whitespace-separated word is
 * capitalized.
 *
 * @example
 * ```ts
 * toTitleCase('hello world'); // 'Hello World'
 * ```
 */
export function toTitleCase(str: string): string {
  return str.replace(
    /\w\S*/g,
    (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  );
}

/**
 * Pads a string symmetrically to the given length with `char` (default
 * space). Returns the original string if it is already at or above the
 * target length.
 */
export function pad(str: string, length: number, char = ' '): string {
  if (str.length >= length) return str;
  const total = length - str.length;
  const left = Math.floor(total / 2);
  const right = total - left;
  return char.repeat(left) + str + char.repeat(right);
}

/**
 * Pads the start of the string to the given length with `char` (default
 * space). Convenience wrapper around `String.prototype.padStart` to keep
 * a consistent string-utility namespace.
 */
export function padStart(str: string, length: number, char = ' '): string {
  return str.padStart(length, char);
}

/**
 * Pads the end of the string to the given length with `char` (default
 * space). Convenience wrapper around `String.prototype.padEnd`.
 */
export function padEnd(str: string, length: number, char = ' '): string {
  return str.padEnd(length, char);
}

/**
 * Counts whitespace-separated words in a string.
 */
export function wordCount(str: string): number {
  const trimmed = str.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Substitutes `${name}` placeholders with values from `vars`. Does not
 * evaluate code — substitution is purely string-based, so this is safe to
 * use with untrusted templates.
 *
 * @remarks Variable names are limited to 200 characters per placeholder to
 * guard against pathological inputs.
 *
 * @example
 * ```ts
 * template('Hello ${name}!', { name: 'world' }); // 'Hello world!'
 * ```
 */
export function template(str: string, vars: Record<string, unknown>): string {
  return str.replace(/\$\{([^}]{1,200})\}/g, (_, raw: string) => {
    const key = raw.trim();
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      const value = vars[key];
      return value == null ? '' : String(value);
    }
    return '';
  });
}

/**
 * Strips HTML tags from a string using a DOM-free linear scanner. This is
 * intentionally **not** a sanitizer for arbitrary untrusted HTML — prefer
 * `sanitizeHtml()` from `@bquery/bquery/security` for that purpose. Use
 * `stripHtml()` when you simply need a plaintext snippet (e.g. generating
 * a meta description from server-side Markdown output).
 *
 * The scanner discards the bodies of `<script>` and `<style>` blocks
 * (handling case variations and `</script foo bar>` style closers), then
 * removes any residual tag delimiters.
 *
 * @remarks DOM-free; safe to use in SSR.
 */
export function stripHtml(str: string): string {
  const len = str.length;
  const chunks: string[] = [];
  let i = 0;
  while (i < len) {
    const ch = str.charCodeAt(i);
    if (ch !== 60 /* '<' */) {
      const nextTag = str.indexOf('<', i);
      const end = nextTag === -1 ? len : nextTag;
      chunks.push(str.slice(i, end));
      i = end;
      continue;
    }
    // We're at '<'. Determine whether it's an opening <script|style> raw-text
    // block, a regular tag, or stray text.
    const rawTag = matchRawTextOpen(str, i);
    if (rawTag !== null) {
      // Skip everything up to and including the matching close tag (case-insensitive).
      const closeStart = findRawTextClose(str, i + rawTag.length + 1, rawTag);
      if (closeStart === -1) {
        // No closing tag — drop the rest, matching browser tolerance.
        break;
      }
      // Advance past the closing tag's '>'.
      const closeEnd = str.indexOf('>', closeStart);
      i = closeEnd === -1 ? len : closeEnd + 1;
      continue;
    }
    // Generic tag: drop everything up to and including the next '>'.
    const end = str.indexOf('>', i + 1);
    if (end === -1) break;
    i = end + 1;
  }
  return chunks.join('').replace(/\s+/g, ' ').trim();
}

/**
 * If `str` starts a raw-text element at position `at`, returns the
 * lowercased tag name ('script' | 'style'). Returns null otherwise.
 *
 * @internal
 */
function matchRawTextOpen(str: string, at: number): 'script' | 'style' | null {
  // Need at least '<script' or '<style' followed by a valid tag-name terminator.
  const tryMatch = (name: 'script' | 'style'): boolean => {
    const nlen = name.length;
    if (at + 1 + nlen > str.length) return false;
    for (let k = 0; k < nlen; k += 1) {
      const c = str.charCodeAt(at + 1 + k);
      // Lowercase A-Z to a-z by OR'ing 0x20 when in [A,Z].
      const lc = c >= 65 && c <= 90 ? c | 0x20 : c;
      if (lc !== name.charCodeAt(k)) return false;
    }
    const next = str.charCodeAt(at + 1 + nlen);
    // Valid terminators: whitespace, '>', '/'
    return (
      next === 32 ||
      next === 9 ||
      next === 10 ||
      next === 13 ||
      next === 12 ||
      next === 62 /* > */ ||
      next === 47
    ); /* / */
  };
  if (tryMatch('script')) return 'script';
  if (tryMatch('style')) return 'style';
  return null;
}

/**
 * Finds the position of `</tagName` (case-insensitive) followed by a valid
 * tag-name terminator, scanning forward from `from`. Returns -1 when none.
 *
 * @internal
 */
function findRawTextClose(str: string, from: number, tagName: 'script' | 'style'): number {
  const len = str.length;
  const nlen = tagName.length;
  let i = from;
  while (i < len) {
    if (str.charCodeAt(i) !== 60 /* < */) {
      i += 1;
      continue;
    }
    if (str.charCodeAt(i + 1) !== 47 /* / */) {
      i += 1;
      continue;
    }
    let matched = true;
    for (let k = 0; k < nlen; k += 1) {
      const c = str.charCodeAt(i + 2 + k);
      const lc = c >= 65 && c <= 90 ? c | 0x20 : c;
      if (lc !== tagName.charCodeAt(k)) {
        matched = false;
        break;
      }
    }
    if (!matched) {
      i += 1;
      continue;
    }
    const next = str.charCodeAt(i + 2 + nlen);
    if (
      next === 32 ||
      next === 9 ||
      next === 10 ||
      next === 13 ||
      next === 12 ||
      next === 62 /* > */ ||
      Number.isNaN(next)
    ) {
      return i;
    }
    i += 1;
  }
  return -1;
}

const DEFAULT_RANDOM_STRING_CHARSET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Returns a random string of the given length using the supplied charset.
 * Uses `crypto.getRandomValues` when available, falling back to
 * `Math.random()` (which is non-cryptographic).
 */
export function randomString(length: number, charset = DEFAULT_RANDOM_STRING_CHARSET): string {
  if (length <= 0) return '';
  if (charset.length === 0) throw new RangeError('randomString: charset must not be empty');
  const cryptoApi: Crypto | undefined =
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.getRandomValues === 'function'
      ? globalThis.crypto
      : undefined;
  if (cryptoApi) {
    const limit = Math.floor(0x100000000 / charset.length) * charset.length;
    let out = '';
    while (out.length < length) {
      const bytes = new Uint32Array(length - out.length);
      cryptoApi.getRandomValues(bytes);
      for (let i = 0; i < bytes.length && out.length < length; i += 1) {
        const value = bytes[i];
        if (value >= limit) continue;
        out += charset[value % charset.length];
      }
    }
    return out;
  }
  let out = '';
  for (let i = 0; i < length; i += 1) out += charset[Math.floor(Math.random() * charset.length)];
  return out;
}

/**
 * Splits a string on universal line terminators, preserving empty lines.
 *
 * @example
 * ```ts
 * lines('a\r\nb\n\nc'); // ['a', 'b', '', 'c']
 * ```
 */
export function lines(str: string): string[] {
  return str.split(/\r\n|\r|\n/);
}
