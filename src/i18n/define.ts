/**
 * Authoring helpers for translation catalogs.
 * @module bquery/i18n
 */

import { formatICU, isICUMessage } from './icu';
import { interpolate, pluralize } from './translate';
import type { LocaleMessages, TranslateParams } from './types';

/**
 * Identity helper that declares a translation catalog inline while preserving
 * its literal shape for type inference. It is also the anchor the optional
 * message-extraction tool recognises when scanning source for catalogs.
 *
 * @param messages - A (possibly nested) catalog of message strings
 * @returns The same object, unchanged
 *
 * @example
 * ```ts
 * import { defineMessages } from '@bquery/bquery/i18n';
 *
 * export const messages = defineMessages({
 *   cart: {
 *     items: '{count, plural, one {# item} other {# items}}',
 *     empty: 'Your cart is empty',
 *   },
 * });
 * ```
 */
export const defineMessages = <const T extends LocaleMessages>(messages: T): T => messages;

/**
 * Formats a single message string outside of a full i18n instance.
 *
 * Routes ICU MessageFormat strings (`plural`, `selectordinal`, `select`)
 * through the locale-aware ICU formatter, and plain templates through the
 * legacy pluralize → interpolate path. Useful for one-off formatting and tests.
 *
 * @param template - The message template (ICU or `{name}` / pipe-plural)
 * @param params - Interpolation / plural params
 * @param locale - Locale for ICU plural selection and `#` formatting (default `'en'`)
 * @returns The formatted string
 *
 * @example
 * ```ts
 * import { formatMessage } from '@bquery/bquery/i18n';
 *
 * formatMessage('{count, plural, one {# item} other {# items}}', { count: 3 });
 * // → '3 items'
 * formatMessage('Hello, {name}!', { name: 'Ada' });
 * // → 'Hello, Ada!'
 * ```
 */
export const formatMessage = (
  template: string,
  params: TranslateParams = {},
  locale = 'en'
): string => {
  if (isICUMessage(template)) {
    return formatICU(template, params, locale);
  }
  return interpolate(pluralize(template, params), params);
};
