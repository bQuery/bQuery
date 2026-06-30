/**
 * Internationalization (i18n) module for bQuery.js.
 *
 * Provides a reactive, TypeScript-first internationalization API
 * with interpolation, ICU MessageFormat pluralization (`plural`,
 * `selectordinal`, `select` via `Intl.PluralRules`), lazy-loading, and
 * locale-aware formatting — all backed by bQuery's signal-based reactivity
 * system. Optional, build-tool-agnostic message extraction ships separately
 * via `@bquery/bquery/i18n/extract`.
 *
 * Targeting **Stable** in 1.15.0: the formatting/locale surface is frozen for
 * one minor cycle; ICU coverage and the extraction tooling are additive.
 *
 * @module bquery/i18n
 *
 * @example
 * ```ts
 * import { createI18n } from '@bquery/bquery/i18n';
 *
 * const i18n = createI18n({
 *   locale: 'en',
 *   fallbackLocale: 'en',
 *   messages: {
 *     en: {
 *       greeting: 'Hello, {name}!',
 *       items: '{count} item | {count} items',
 *       nested: { deep: { key: 'Found it!' } },
 *     },
 *     de: {
 *       greeting: 'Hallo, {name}!',
 *       items: '{count} Gegenstand | {count} Gegenstände',
 *     },
 *   },
 * });
 *
 * // Basic translation
 * i18n.t('greeting', { name: 'Ada' }); // 'Hello, Ada!'
 *
 * // Pluralization
 * i18n.t('items', { count: 1 }); // '1 item'
 * i18n.t('items', { count: 5 }); // '5 items'
 *
 * // Reactive translation (auto-updates on locale change)
 * const label = i18n.tc('greeting', { name: 'Ada' });
 * console.log(label.value); // 'Hello, Ada!'
 *
 * i18n.$locale.value = 'de';
 * console.log(label.value); // 'Hallo, Ada!'
 *
 * // Number & date formatting
 * i18n.n(1234.56);                              // '1,234.56' (en)
 * i18n.d(new Date(), { dateStyle: 'long' });     // 'March 26, 2026'
 *
 * // Lazy-load a locale
 * i18n.loadLocale('fr', () => import('./locales/fr.json'));
 * await i18n.ensureLocale('fr');
 * i18n.$locale.value = 'fr';
 * ```
 */

export { createI18n } from './i18n';
export { defineMessages, formatMessage } from './define';
export { formatDate, formatNumber } from './formatting';
export {
  formatDisplayName,
  formatList,
  formatRelativeTime,
  segment,
  type ListFormatOptions,
  type RelativeTimeFormatOptions,
} from './formatting-extras';
export {
  detectLocale,
  isRTL,
  negotiateLocale,
  type DetectLocaleOptions,
  type NegotiateLocaleOptions,
} from './locale';

export type {
  DateFormatOptions,
  I18nConfig,
  I18nInstance,
  LocaleLoader,
  LocaleMessages,
  Messages,
  NumberFormatOptions,
  TranslateParams,
} from './types';
