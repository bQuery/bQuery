/**
 * Storybook authoring helpers for bQuery components.
 *
 * Re-exports string-renderer-compatible tagged templates ({@link storyHtml},
 * {@link storySvg}) and ergonomic helpers ({@link classMap}, {@link styleMap},
 * {@link ifDefined}, {@link repeat}, {@link unsafeHtml}, {@link storyText},
 * {@link when}) that mirror `lit-html` conventions so existing community
 * examples translate one-to-one.
 *
 * Targeting **Stable** in 1.15.0: the helper surface is frozen for one minor
 * cycle. `storyHtml` / `storySvg` sanitize every interpolation via the security
 * module; `unsafeHtml()` is the single, brand-checked opt-out for trusted,
 * author-controlled markup.
 *
 * @module bquery/storybook
 */

export { storyHtml, when } from './story-html';
export type { StoryValue } from './story-html';

export { storySvg } from './story-svg';

export { classMap, ifDefined, repeat, storyText, styleMap } from './helpers';

export { unsafeHtml } from './unsafe-html';
export type { UnsafeHtmlMarker } from './unsafe-html';
