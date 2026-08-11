/**
 * Story authoring helpers: attribute and class-map builders, conditional
 * attribute helpers, keyed list rendering, and escape-only text rendering.
 *
 * @module bquery/storybook
 */

import { escapeHtml } from '../security/sanitize';
import type { StoryValue } from './story-html';
import { createUnsafeHtmlMarker, isUnsafeHtmlMarker } from './unsafe-html';
import type { UnsafeHtmlMarker } from './unsafe-html';

/**
 * Sentinel value emitted by {@link ifDefined} when a story attribute should
 * resolve to an empty string.
 *
 * @remarks
 * The empty string keeps string-based Storybook templates simple: when used as
 * `attr="${ifDefined(...)}"`, the rendered output becomes `attr=""`.
 */
const IF_DEFINED_OMITTED = '';

/**
 * Builds a space-joined class value from a record of class → boolean.
 * Truthy values include the class, falsy values skip it.
 *
 * @remarks
 * Mirrors the `lit-html` `classMap` directive for ergonomic parity with
 * existing community examples.
 *
 * @param classes - Record of class names → truthiness predicate
 * @returns A space-joined class value, or empty when no classes apply
 *
 * @example
 * ```ts
 * storyHtml`<bq-button class="${classMap({ primary: true, disabled: isDisabled })}">Save</bq-button>`;
 * ```
 */
export const classMap = (classes: Record<string, unknown>): string => {
  const enabled: string[] = [];
  for (const key of Object.keys(classes)) {
    if (classes[key]) enabled.push(key);
  }
  return enabled.join(' ');
};

/**
 * Builds a `style="..."` attribute value from a record of CSS properties.
 *
 * @remarks
 * Property names are passed through unchanged — supply hyphenated names like
 * `'background-color'`, or camelCase names which are converted to hyphenated
 * form (matching the `lit-html` `styleMap` semantics).
 *
 * Values are coerced to strings; `null`/`undefined`/`false` skip the property.
 *
 * @example
 * ```ts
 * storyHtml`<div style=${styleMap({ color: 'red', backgroundColor: theme.bg })}></div>`;
 * ```
 */
export const styleMap = (
  styles: Record<string, string | number | null | undefined | false>
): string => {
  const parts: string[] = [];
  for (const key of Object.keys(styles)) {
    const value = styles[key];
    if (value === null || value === undefined || value === false) continue;
    const property = key.includes('-') ? key : key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
    parts.push(`${property}:${value}`);
  }
  return parts.join(';');
};

/**
 * Conditionally includes an attribute value. When `value` is `null` or
 * `undefined`, returns an empty string so the surrounding template emits an
 * empty attribute value (`attr=""`). Otherwise the value is stringified.
 *
 * @example
 * ```ts
 * storyHtml`<bq-input placeholder="${ifDefined(args.placeholder)}"></bq-input>`;
 * ```
 */
export const ifDefined = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return IF_DEFINED_OMITTED;
  return String(value);
};

/**
 * Maps each item in `items` through `render` and joins the results, attaching
 * a stable key marker to each item so consumers can identify list entries.
 *
 * @remarks
 * Because Storybook's string renderer has no DOM diffing, `repeat` simply
 * concatenates fragments. Plain-string results are escaped as text; to insert
 * trusted markup, wrap the fragment with {@link unsafeHtml}. The key is
 * rendered as a `data-bq-key` attribute on the first opening tag of each
 * fragment if present, otherwise the fragment is inserted unchanged. The
 * optional `key` function is invoked once per item.
 *
 * @example
 * ```ts
 * storyHtml`<ul>${repeat(items, (item) => unsafeHtml(storyHtml`<li>${item.label}</li>`), (item) => item.id)}</ul>`;
 * ```
 */
export const repeat = <T>(
  items: readonly T[],
  render: (item: T, index: number) => StoryValue,
  key?: (item: T, index: number) => string | number
): UnsafeHtmlMarker => {
  const rendered: string[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const value = render(item, index);
    const fragment = resolvePlain(value);
    if (key === undefined) {
      rendered.push(fragment);
      continue;
    }
    const keyValue = String(key(item, index));
    rendered.push(injectKeyAttribute(fragment, keyValue));
  }
  // Fragments are escaped by default; callers must opt into trusted markup via
  // `unsafeHtml(...)`. Wrap the final concatenation in an internal marker so
  // surrounding `storyHtml` preserves the authored fragment structure without
  // emitting the opt-in warning for safe-by-default plain strings.
  return createUnsafeHtmlMarker(rendered.join(''));
};

/**
 * Resolves a {@link StoryValue} to a plain string without sanitization.
 *
 * @remarks
 * Used by `repeat()` to produce the raw concatenation. `repeat()` itself
 * returns an `unsafeHtml` marker so the surrounding `storyHtml` call does not
 * re-sanitize fragments that have already been sanitized by a nested
 * `storyHtml` call.
 *
 * @internal
 */
const resolvePlain = (value: StoryValue): string => {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(resolvePlain).join('');
  if (typeof value === 'function') return resolvePlain(value());
  if (isUnsafeHtmlMarker(value)) {
    return value.value;
  }
  return escapeHtml(String(value));
};

/**
 * Injects a `data-bq-key` attribute into the first opening tag of `fragment`,
 * or returns the fragment unchanged if no opening tag is present.
 *
 * @internal
 */
const injectKeyAttribute = (fragment: string, key: string): string => {
  const escaped = escapeHtml(key);
  // Find the first `<tagName` followed by space, `/`, or `>`.
  const match = fragment.match(/<([A-Za-z][A-Za-z0-9-]*)(\s|\/|>)/);
  if (!match) return fragment;
  const tagEnd = match.index! + 1 + match[1].length;
  return `${fragment.slice(0, tagEnd)} data-bq-key="${escaped}"${fragment.slice(tagEnd)}`;
};

/**
 * Escape-only helper for text-only fragments. Returns the input with HTML
 * entities encoded so it is safe to interpolate directly into a story
 * template.
 *
 * @remarks
 * Unlike {@link storyHtml}, `storyText` does not parse the template for tags
 * or attributes — it is intended for plain text. Use it whenever you want
 * args-provided strings to render verbatim without HTML interpretation.
 *
 * @example
 * ```ts
 * storyHtml`<bq-tooltip>${storyText(args.label)}</bq-tooltip>`;
 * ```
 */
export const storyText = (text: string | number | null | undefined): string => {
  if (text === null || text === undefined) return '';
  return escapeHtml(String(text));
};
