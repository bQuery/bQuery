/**
 * Storybook template helpers for authoring bQuery component stories.
 *
 * `storyHtml` mirrors bQuery's string-based `html` tag while adding support for
 * Storybook-friendly boolean attribute shorthand (`?disabled=${true}`).
 *
 * @module bquery/storybook
 */

import { sanitizeHtml } from '../security/sanitize';

type StoryValue = string | number | boolean | null | undefined | StoryValue[] | (() => StoryValue);

/**
 * Marks template interpolation boundaries while inferring sanitizer allowlists.
 * Uses the null character because authored HTML/template strings should not
 * contain it, making it a safe internal sentinel during parsing.
 */
const INTERPOLATION_BOUNDARY_MARKER = '\u0000';

const isWhitespace = (value: string): boolean => {
  return value === ' ' || value === '\t' || value === '\n' || value === '\r' || value === '\f';
};

/**
 * Detects interpolation boundaries embedded into joined template string fragments.
 */
const isInterpolationBoundaryMarker = (value: string): boolean => value === INTERPOLATION_BOUNDARY_MARKER;

const isAttributeSeparator = (value: string): boolean => {
  return isWhitespace(value) || isInterpolationBoundaryMarker(value);
};

const isAsciiLetter = (value: string): boolean => {
  const code = value.charCodeAt(0);

  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
};

const isAttributeNameStart = (value: string): boolean => isAsciiLetter(value);

const isAttributeNameChar = (value: string): boolean => {
  const code = value.charCodeAt(0);

  return (
    isAsciiLetter(value) ||
    (code >= 48 && code <= 57) ||
    value === ':' ||
    value === '.' ||
    value === '_' ||
    value === '-'
  );
};

const isQuoteChar = (value: string): boolean => value === '"' || value === "'";

const isTagNameChar = (value: string): boolean => {
  const code = value.charCodeAt(0);

  return (
    isAsciiLetter(value) ||
    (code >= 48 && code <= 57) ||
    value === '.' ||
    value === '_' ||
    value === '-'
  );
};

const hasLineBreak = (value: string): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '\n' || value[index] === '\r') {
      return true;
    }
  }

  return false;
};

const getTagNameEnd = (fragment: string): number => {
  let index = 0;

  while (
    index < fragment.length &&
    !isAttributeSeparator(fragment[index]) &&
    fragment[index] !== '/' &&
    fragment[index] !== '>'
  ) {
    index += 1;
  }

  return index;
};

const isCustomElementTagName = (tagName: string): boolean => {
  if (!tagName.includes('-') || !isAsciiLetter(tagName[0])) {
    return false;
  }

  const last = tagName[tagName.length - 1];
  const code = last.charCodeAt(0);

  return isAsciiLetter(last) || (code >= 48 && code <= 57) || last === '.' || last === '_';
};

const isAutoAllowedStoryAttribute = (attributeName: string): boolean => {
  return attributeName !== 'style' && !attributeName.startsWith('on');
};

const findBooleanAttributeSuffix = (
  part: string
): { attribute: string; basePart: string; spacing: string } | null => {
  let index = part.length - 1;

  while (index >= 0 && isWhitespace(part[index])) {
    index -= 1;
  }

  if (index < 0 || part[index] !== '=') {
    return null;
  }

  index -= 1;

  while (index >= 0 && isWhitespace(part[index])) {
    index -= 1;
  }

  const attributeEnd = index;

  while (
    index >= 0 &&
    !isWhitespace(part[index]) &&
    part[index] !== '?' &&
    part[index] !== '=' &&
    part[index] !== '/' &&
    part[index] !== '>'
  ) {
    index -= 1;
  }

  const attributeStart = index + 1;

  if (attributeStart > attributeEnd || part[index] !== '?') {
    return null;
  }

  const questionMarkIndex = index;
  let spacingStart = questionMarkIndex;

  while (spacingStart > 0 && isWhitespace(part[spacingStart - 1])) {
    spacingStart -= 1;
  }

  return {
    attribute: part.slice(attributeStart, attributeEnd + 1),
    basePart: part.slice(0, spacingStart),
    spacing: part.slice(spacingStart, questionMarkIndex),
  };
};

const collectOpeningTagFragments = (template: string): string[] => {
  const fragments: string[] = [];
  let index = 0;

  while (index < template.length) {
    if (template[index] !== '<') {
      index += 1;
      continue;
    }

    const next = template[index + 1];

    if (!next || next === '/' || next === '!' || next === '?') {
      index += 1;
      continue;
    }

    let cursor = index + 1;

    if (!isAsciiLetter(template[cursor])) {
      index += 1;
      continue;
    }

    while (cursor < template.length && isTagNameChar(template[cursor])) {
      cursor += 1;
    }

    const tagStart = index + 1;
    const tagName = template.slice(tagStart, cursor);

    if (!tagName) {
      index += 1;
      continue;
    }

    let inQuote: '"' | "'" | null = null;
    let tagEnd = cursor;

    while (tagEnd < template.length) {
      const char = template[tagEnd];

      if (inQuote) {
        if (char === inQuote) {
          inQuote = null;
        }

        tagEnd += 1;
        continue;
      }

      if (char === '"' || char === "'") {
        inQuote = char;
        tagEnd += 1;
        continue;
      }

      if (char === '>') {
        fragments.push(template.slice(index + 1, tagEnd));
        tagEnd += 1;
        break;
      }

      tagEnd += 1;
    }

    index = tagEnd;
  }

  return fragments;
};

/**
 * Consumes a literal HTML attribute value starting at the given index.
 *
 * Returns the position immediately after a quoted or unquoted value. When the
 * current position reaches an interpolation boundary (optionally after
 * whitespace), the returned index advances past the boundary marker so
 * interpolated attributes do not swallow following authored attributes during
 * sanitizer allowlist inference.
 *
 * @param fragment - The opening-tag fragment currently being scanned
 * @param index - The position immediately after the `=` sign
 * @returns The index after the consumed literal value, or just past an
 * interpolation boundary when no literal value should be consumed from the
 * current template fragment.
 */
const skipAttributeValue = (fragment: string, index: number): number => {
  if (index >= fragment.length) {
    return index;
  }

  let cursor = index;

  if (isInterpolationBoundaryMarker(fragment[cursor])) {
    return cursor + 1;
  }

  while (cursor < fragment.length && isWhitespace(fragment[cursor])) {
    cursor += 1;
  }

  if (cursor >= fragment.length) {
    return cursor;
  }

  if (isInterpolationBoundaryMarker(fragment[cursor])) {
    return cursor + 1;
  }

  const quote = fragment[cursor];

  if (isQuoteChar(quote)) {
    cursor += 1;

    while (cursor < fragment.length) {
      if (fragment[cursor] === quote) {
        return cursor + 1;
      }

      cursor += 1;
    }

    return cursor;
  }

  while (
    cursor < fragment.length &&
    !isAttributeSeparator(fragment[cursor]) &&
    fragment[cursor] !== '/' &&
    fragment[cursor] !== '>'
  ) {
    cursor += 1;
  }

  if (cursor < fragment.length && isInterpolationBoundaryMarker(fragment[cursor])) {
    return cursor + 1;
  }

  return cursor;
};

const collectAttributesFromTagFragment = (
  fragment: string,
  allowAttributes: Set<string>,
  autoAllowAttributes: boolean
): void => {
  let index = 0;

  while (index < fragment.length && !isAttributeSeparator(fragment[index])) {
    index += 1;
  }

  while (index < fragment.length) {
    while (index < fragment.length && isAttributeSeparator(fragment[index])) {
      index += 1;
    }

    if (index >= fragment.length || fragment[index] === '/') {
      return;
    }

    // Skip standalone colons (e.g. namespace prefixes or framework-specific bindings)
    if (fragment[index] === ':') {
      index += 1;
      continue;
    }

    const hasBooleanPrefix = fragment[index] === '?';

    if (hasBooleanPrefix) {
      index += 1;
    }

    if (index >= fragment.length || !isAttributeNameStart(fragment[index])) {
      // Skip unrecognised character to avoid an infinite loop
      index += 1;
      continue;
    }

    const nameStart = index;

    index += 1;

    while (index < fragment.length && isAttributeNameChar(fragment[index])) {
      index += 1;
    }

    const attributeName = fragment.slice(nameStart, index).toLowerCase();

    while (index < fragment.length && isAttributeSeparator(fragment[index])) {
      index += 1;
    }

    if (index < fragment.length && fragment[index] === '=') {
      if (autoAllowAttributes && isAutoAllowedStoryAttribute(attributeName)) {
        allowAttributes.add(attributeName);
      }
      index = skipAttributeValue(fragment, index + 1);
      continue;
    }

    if (hasBooleanPrefix && autoAllowAttributes && isAutoAllowedStoryAttribute(attributeName)) {
      allowAttributes.add(attributeName);
    }
  }
};

const collectTemplateSanitizeOptions = (strings: TemplateStringsArray) => {
  const template = strings.join(INTERPOLATION_BOUNDARY_MARKER);
  const allowTags = new Set<string>();
  const allowAttributes = new Set<string>();

  for (const fragment of collectOpeningTagFragments(template)) {
    const tagName = fragment.slice(0, getTagNameEnd(fragment)).toLowerCase();
    const isCustomElement = isCustomElementTagName(tagName);

    if (isCustomElement) {
      allowTags.add(tagName);
    }

    collectAttributesFromTagFragment(fragment, allowAttributes, isCustomElement);
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

const resolveBooleanStoryValue = (value: StoryValue): boolean => {
  if (value == null) {
    return false;
  }

  if (typeof value === 'function') {
    return resolveBooleanStoryValue(value());
  }

  if (Array.isArray(value)) {
    return Boolean(resolveStoryValue(value));
  }

  if (typeof value === 'boolean') {
    return value;
  }

  return Boolean(value);
};

/**
 * Tagged template literal for Storybook render functions.
 *
 * Supports boolean attribute shorthand compatible with Storybook's string
 * renderer:
 *
 * ```ts
 * storyHtml`<bq-button ?disabled=${true}>Save</bq-button>`;
 * // => '<bq-button disabled="">Save</bq-button>'
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

    const booleanAttributeMatch = findBooleanAttributeSuffix(part);

    if (booleanAttributeMatch) {
      const { attribute, basePart, spacing } = booleanAttributeMatch;
      const preservedSpacing = hasLineBreak(spacing) ? spacing : '';
      const isEnabled = resolveBooleanStoryValue(values[index]);

      return `${acc}${basePart}${isEnabled ? `${spacing}${attribute}` : preservedSpacing}`;
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
