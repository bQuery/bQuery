/**
 * `unsafeHtml()` — opt-in sanitizer bypass marker for {@link storyHtml}.
 *
 * @module bquery/storybook
 */

/** @internal */
export const UNSAFE_HTML_PLACEHOLDER_PREFIX = '\u0001BQ_UNSAFE_HTML_';
/** @internal */
export const UNSAFE_HTML_PLACEHOLDER_SUFFIX = '_END\u0001';

/** @internal */
const UNSAFE_HTML_BRAND: unique symbol = Symbol('bquery.storybook.unsafeHtml');

/**
 * Marker returned by {@link unsafeHtml}. Identifies an interpolated story
 * value that should bypass the {@link storyHtml} sanitizer.
 */
export interface UnsafeHtmlMarker {
  /** @internal */
  readonly [UNSAFE_HTML_BRAND]: true;
  /** The raw HTML that will be re-inserted after sanitization. */
  readonly value: string;
}

let warnedOnce = false;

/** @internal */
export const createUnsafeHtmlMarker = (value: string): UnsafeHtmlMarker => ({
  [UNSAFE_HTML_BRAND]: true,
  value,
});

const emitDevWarning = (): void => {
  if (warnedOnce) return;
  warnedOnce = true;
  if (typeof console === 'undefined' || typeof console.warn !== 'function') return;
  console.warn(
    '[bquery/storybook] unsafeHtml() bypasses sanitization for the wrapped value. ' +
      'Only use it with trusted, author-controlled markup.'
  );
};

/**
 * Wraps an HTML fragment so {@link storyHtml} re-inserts it verbatim after
 * sanitizing the surrounding template. The wrapped value is **not** sanitized.
 *
 * @remarks
 * Mirrors `lit-html`'s `unsafeHTML` directive. Only use with trusted,
 * author-controlled markup — never with user-supplied input.
 *
 * @param value - The HTML fragment to insert verbatim
 * @returns An opaque marker recognised by {@link storyHtml}
 *
 * @example
 * ```ts
 * import { storyHtml, unsafeHtml } from '@bquery/bquery/storybook';
 *
 * const trustedSvg = '<svg width="16" height="16"><circle cx="8" cy="8" r="6"/></svg>';
 * storyHtml`<bq-icon>${unsafeHtml(trustedSvg)}</bq-icon>`;
 * ```
 */
export const unsafeHtml = (value: string): UnsafeHtmlMarker => {
  emitDevWarning();
  return createUnsafeHtmlMarker(value);
};

/**
 * Type guard for {@link UnsafeHtmlMarker}.
 * @internal
 */
export const isUnsafeHtmlMarker = (value: unknown): value is UnsafeHtmlMarker => {
  if (value === null || typeof value !== 'object') return false;
  return (value as { [UNSAFE_HTML_BRAND]?: true })[UNSAFE_HTML_BRAND] === true;
};
