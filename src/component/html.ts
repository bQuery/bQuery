const BOOLEAN_ATTRIBUTE_MARKER: unique symbol = Symbol('bquery.booleanAttribute');
const BOOLEAN_ATTRIBUTE_NAME = /^[^\0-\x20"'/>=]+$/;

interface BooleanAttributeValue {
  readonly [BOOLEAN_ATTRIBUTE_MARKER]: true;
  readonly enabled: boolean;
  readonly name: string;
}

const isBooleanAttributeValue = (value: unknown): value is BooleanAttributeValue =>
  typeof value === 'object' && value !== null && BOOLEAN_ATTRIBUTE_MARKER in value;

const stringifyTemplateValue = (value: unknown): string => {
  if (isBooleanAttributeValue(value)) {
    return value.enabled ? value.name : '';
  }

  return String(value ?? '');
};

const escapeMap: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '`': '&#x60;',
};

const escapeTemplateValue = (value: unknown): string =>
  stringifyTemplateValue(value).replace(/[&<>"'`]/g, (char) => escapeMap[char]);

/**
 * Creates a boolean-attribute marker for the {@link html} and {@link safeHtml} template tags.
 *
 * When the condition is truthy, the attribute name is rendered without a value.
 * When the condition is falsy, an empty string is rendered and any surrounding
 * template-literal whitespace is preserved.
 *
 * @param name - HTML attribute name to emit
 * @param enabled - Whether the boolean attribute should be present
 * @returns Internal marker consumed by template tags
 *
 * @example
 * ```ts
 * html`<button ${bool('disabled', isDisabled)}>Save</button>`;
 * // Result when isDisabled = true: '<button disabled>Save</button>'
 * ```
 */
export const bool = (name: string, enabled: unknown): BooleanAttributeValue => {
  if (!BOOLEAN_ATTRIBUTE_NAME.test(name)) {
    throw new TypeError(`Invalid boolean attribute name: ${name}`);
  }

  return {
    [BOOLEAN_ATTRIBUTE_MARKER]: true,
    enabled: Boolean(enabled),
    name,
  };
};

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
  return strings.reduce((acc, part, index) => `${acc}${part}${stringifyTemplateValue(values[index])}`, '');
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
  return strings.reduce((acc, part, index) => `${acc}${part}${escapeTemplateValue(values[index])}`, '');
};
