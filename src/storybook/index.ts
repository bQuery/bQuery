/**
 * Storybook authoring helpers for bQuery components.
 *
 * Re-exports string-renderer-compatible tagged templates ({@link storyHtml},
 * {@link storySvg}) and ergonomic helpers ({@link classMap}, {@link styleMap},
 * {@link ifDefined}, {@link repeat}, {@link unsafeHtml}, {@link storyText},
 * {@link when}) that mirror `lit-html` conventions so existing community
 * examples translate one-to-one.
 *
 * @module bquery/storybook
 */

export { storyHtml, when } from './story-html';
export type { StoryValue } from './story-html';

export { storySvg } from './story-svg';

export { classMap, ifDefined, repeat, storyText, styleMap } from './helpers';

export { unsafeHtml } from './unsafe-html';
export type { UnsafeHtmlMarker } from './unsafe-html';
