/**
 * `storySvg` — sibling of {@link storyHtml} for authoring SVG-rooted stories.
 *
 * @module bquery/storybook
 */

import { escapeHtml } from '../security/sanitize';
import type { StoryValue } from './story-html';
import { isUnsafeHtmlMarker } from './unsafe-html';

const resolveSvgValue = (value: StoryValue): string => {
  if (value === null || value === undefined) return '';
  if (isUnsafeHtmlMarker(value)) {
    // `unsafeHtml()` is an explicit opt-in to bypass escaping. Authors take
    // responsibility for the contents of the marker.
    return value.value;
  }
  if (Array.isArray(value)) return value.map(resolveSvgValue).join('');
  if (typeof value === 'function') return resolveSvgValue(value());
  return escapeHtml(String(value));
};

/**
 * Tagged template literal for authoring SVG-rooted Storybook stories.
 *
 * @remarks
 * Unlike {@link storyHtml}, `storySvg` does not run the SVG output through the
 * HTML sanitizer (the HTML sanitizer blocks `<svg>` as a dangerous tag because
 * the SVG namespace can host script-execution sinks). Instead, the static
 * template is treated as developer-authored (and therefore trusted), while
 * every interpolated value is HTML-escaped so user-supplied args cannot break
 * out of an attribute slot or inject elements. Use {@link unsafeHtml} for the
 * rare case where you need to splice in pre-built SVG markup.
 *
 * @example
 * ```ts
 * import { storySvg } from '@bquery/bquery/storybook';
 *
 * export const Icon = {
 *   args: { size: 24, color: 'currentColor' },
 *   render: ({ size, color }) => storySvg`
 *     <svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">
 *       <circle cx="12" cy="12" r="10" fill="${color}" />
 *     </svg>
 *   `,
 * };
 * ```
 */
export const storySvg = (strings: TemplateStringsArray, ...values: StoryValue[]): string => {
  return strings.reduce((acc, part, index) => {
    if (index >= values.length) return `${acc}${part}`;
    return `${acc}${part}${resolveSvgValue(values[index])}`;
  }, '');
};

