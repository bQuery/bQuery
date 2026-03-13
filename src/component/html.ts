import {
  isTrustedHtml,
  type SanitizedHtml,
  toSanitizedHtml,
  unwrapTrustedHtml,
} from '../security/trusted-html';
const BOOLEAN_ATTRIBUTE_MARKER: unique symbol = Symbol('bquery.booleanAttribute');
const BOOLEAN_ATTRIBUTE_NAME = /^[^\0-\x20"'/>=]+$/;

/**
 * Public shape of a boolean HTML attribute created by {@link bool}.
 *
 * This type is returned from {@link bool} and can be interpolated into
 * {@link html} / {@link safeHtml} templates to conditionally include or omit
 * an attribute by name. The internal marker property used for runtime checks
 * remains private and is not part of the public API.
 *
 * @example
 * ```ts
 * const disabled = bool('disabled', isDisabled);
 * const button = html`<button ${disabled}>Click</button>`;
 * ```
 */
export interface BooleanAttribute {
  readonly enabled: boolean;
  readonly name: string;
}

interface BooleanAttributeValue extends BooleanAttribute {
  readonly [BOOLEAN_ATTRIBUTE_MARKER]: true;
}

const isBooleanAttributeValue = (value: unknown): value is BooleanAttributeValue => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<BooleanAttributeValue>;
  return (
    candidate[BOOLEAN_ATTRIBUTE_MARKER] === true &&
    typeof candidate.enabled === 'boolean' &&
    typeof candidate.name === 'string'
  );
};

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

const escapeTemplateValue = (value: unknown): string => {
  if (isBooleanAttributeValue(value)) {
    return value.enabled ? value.name : '';
  }

  return stringifyTemplateValue(value).replace(/[&<>"'`]/g, (char) => escapeMap[char]);
};

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
export const bool = (name: string, enabled: unknown): BooleanAttribute => {
  if (!BOOLEAN_ATTRIBUTE_NAME.test(name)) {
    throw new TypeError(`Invalid boolean attribute name: ${name}`);
  }

  const attribute: BooleanAttributeValue = {
    [BOOLEAN_ATTRIBUTE_MARKER]: true,
    enabled: Boolean(enabled),
    name,
  };

  return Object.freeze(attribute);
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
 * @returns Branded escaped HTML string safe for bQuery template composition
 *
 * @example
 * ```ts
 * const userInput = '<script>alert("xss")</script>';
 * const safe = safeHtml`<div>${userInput}</div>`;
 * // Result: '<div>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</div>'
 * ```
 */
export const safeHtml = (
  strings: TemplateStringsArray,
  ...values: unknown[]
): SanitizedHtml => {
  const escape = (value: unknown): string => {
    if (isTrustedHtml(value)) return unwrapTrustedHtml(value);
    return escapeTemplateValue(value);
  };

  return toSanitizedHtml(
    strings.reduce(
      (acc, part, index) => `${acc}${part}${index < values.length ? escape(values[index]) : ''}`,
      ''
    )
  );
};
