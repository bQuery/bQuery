/**
 * Tagged template literal for creating HTML strings.
 *
 * This function handles interpolation of values into HTML templates,
 * converting null/undefined to empty strings.
 *
 * @param strings - Template literal string parts
 * @param values - Interpolated values
 * @returns Combined HTML string
 *
 * @example
 * ```ts
 * const name = 'World';
 * const greeting = html`<h1>Hello, ${name}!</h1>`;
 * // Result: '<h1>Hello, World!</h1>'
 * ```
 */
export const html = (strings: TemplateStringsArray, ...values: unknown[]): string => {
  return strings.reduce((acc, part, index) => `${acc}${part}${values[index] ?? ''}`, '');
};

/**
 * Escapes HTML entities in interpolated values for XSS prevention.
 * Use this when you need to safely embed user content in templates.
 *
 * @param strings - Template literal string parts
 * @param values - Interpolated values to escape
 * @returns Combined HTML string with escaped values
 *
 * @example
 * ```ts
 * const userInput = '<script>alert("xss")</script>';
 * const safe = safeHtml`<div>${userInput}</div>`;
 * // Result: '<div>&lt;script&gt;alert("xss")&lt;/script&gt;</div>'
 * ```
 */
export const safeHtml = (strings: TemplateStringsArray, ...values: unknown[]): string => {
  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;',
  };

  const escape = (value: unknown): string => {
    const str = String(value ?? '');
    return str.replace(/[&<>"'`]/g, (char) => escapeMap[char]);
  };

  return strings.reduce((acc, part, index) => `${acc}${part}${escape(values[index])}`, '');
};
