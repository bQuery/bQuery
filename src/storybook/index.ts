/**
 * Storybook template helpers for authoring bQuery component stories.
 *
 * `storyHtml` mirrors bQuery's string-based `html` tag while adding support for
 * Storybook-friendly boolean attribute shorthand (`?disabled=${true}`).
 *
 * @module bquery/storybook
 */

import { sanitizeHtml } from '../security/sanitize';

type StoryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | StoryValue[]
  | (() => StoryValue);

const BOOLEAN_ATTRIBUTE_PATTERN = /(\s*)\?([^\s=/>]+)\s*=\s*$/;
const CUSTOM_ELEMENT_PATTERN = /<\s*\/?\s*([a-z][\w:-]*-[\w:-]*)\b/gi;
const ATTRIBUTE_PATTERN = /(?:^|[\s<])\?*([^\s=/>]+)\s*=/g;

const collectTemplateSanitizeOptions = (strings: TemplateStringsArray) => {
  const template = strings.join('');
  const allowTags = new Set<string>();
  const allowAttributes = new Set<string>();

  for (const match of template.matchAll(CUSTOM_ELEMENT_PATTERN)) {
    allowTags.add(match[1].toLowerCase());
  }

  for (const match of template.matchAll(ATTRIBUTE_PATTERN)) {
    allowAttributes.add(match[1].toLowerCase());
  }

  return {
    allowTags: Array.from(allowTags),
    allowAttributes: Array.from(allowAttributes),
  };
};

const resolveStoryValue = (value: StoryValue): string => {
  if (value == null) {
    return '';
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveStoryValue(item)).join('');
  }

  if (typeof value === 'function') {
    return resolveStoryValue(value());
  }

  return String(value);
};

/**
 * Tagged template literal for Storybook render functions.
 *
 * Supports boolean attribute shorthand compatible with Storybook's string
 * renderer:
 *
 * ```ts
 * storyHtml`<bq-button ?disabled=${true}>Save</bq-button>`;
 * // => '<bq-button disabled>Save</bq-button>'
 * ```
 *
 * @param strings - Template literal string parts
 * @param values - Interpolated values
 * @returns HTML string compatible with `@storybook/web-components`
 */
export const storyHtml = (strings: TemplateStringsArray, ...values: StoryValue[]): string => {
  const rendered = strings.reduce((acc, part, index) => {
    if (index >= values.length) {
      return `${acc}${part}`;
    }

    const booleanAttributeMatch = part.match(BOOLEAN_ATTRIBUTE_PATTERN);

    if (booleanAttributeMatch) {
      const [, spacing, attribute] = booleanAttributeMatch;
      const basePart = part.slice(0, part.length - booleanAttributeMatch[0].length);
      const preservedSpacing = /[\r\n]/.test(spacing) ? spacing : '';

      return `${acc}${basePart}${values[index] ? `${spacing}${attribute}` : preservedSpacing}`;
    }

    return `${acc}${part}${resolveStoryValue(values[index])}`;
  }, '');

  return sanitizeHtml(rendered, collectTemplateSanitizeOptions(strings));
};

/**
 * Conditionally render a value or template fragment.
 *
 * @param condition - Condition that controls rendering
 * @param truthyValue - Value or callback rendered when the condition is truthy
 * @param falsyValue - Optional value or callback rendered when the condition is falsy
 * @returns Rendered string fragment, or an empty string when the condition is
 * falsy and no fallback is provided
 */
export const when = (
  condition: unknown,
  truthyValue: StoryValue,
  falsyValue?: StoryValue
): string => {
  return resolveStoryValue(condition ? truthyValue : falsyValue);
};
