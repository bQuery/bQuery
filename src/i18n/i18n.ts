/**
 * Core i18n factory function.
 * @module bquery/i18n
 */

import { computed, signal } from '../reactive/index';
import { clone, isPrototypePollutionKey } from '../core/utils/object';
import { formatDate, formatNumber } from './formatting';
import { deepMerge, translate } from './translate';
import type {
  DateFormatOptions,
  I18nConfig,
  I18nInstance,
  LocaleLoader,
  LocaleMessages,
  Messages,
  NumberFormatOptions,
  TranslateParams,
} from './types';

/**
 * Creates a reactive internationalization instance.
 *
 * The returned object provides:
 * - `$locale` — a reactive signal for the current locale
 * - `t()` — translation with interpolation and pluralization
 * - `tc()` — reactive translation that auto-updates on locale change
 * - `loadLocale()` — register lazy-loaded locale files
 * - `n()` — locale-aware number formatting
 * - `d()` — locale-aware date formatting
 *
 * @param config - Initial configuration
 * @returns An i18n instance
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
 *     },
 *     de: {
 *       greeting: 'Hallo, {name}!',
 *       items: '{count} Gegenstand | {count} Gegenstände',
 *     },
 *   },
 * });
 *
 * i18n.t('greeting', { name: 'Ada' }); // 'Hello, Ada!'
 * i18n.t('items', { count: 3 });       // '3 items'
 *
 * // Switch locale reactively
 * i18n.$locale.value = 'de';
 * i18n.t('greeting', { name: 'Ada' }); // 'Hallo, Ada!'
 * ```
 */
export const createI18n = (config: I18nConfig): I18nInstance => {
  const { locale: initialLocale, messages: initialMessages, fallbackLocale } = config;

  // Deep-clone initial messages to prevent external mutation
  const messages = Object.create(null) as Messages;
  for (const [loc, msgs] of Object.entries(initialMessages)) {
    if (isPrototypePollutionKey(loc)) {
      continue;
    }
    messages[loc] = clone(msgs);
  }

  // Reactive locale signal
  const $locale = signal(initialLocale);

  // Lazy-loader registry
  const loaders = new Map<string, LocaleLoader>();

  // Track which loaders have been invoked to avoid duplicate loads
  const loadedLocales = new Set<string>(Object.keys(messages));

  /**
   * Get messages for a locale, or undefined if not loaded.
   */
  const getMessages = (loc: string): LocaleMessages | undefined => {
    if (isPrototypePollutionKey(loc)) {
      return undefined;
    }
    return messages[loc];
  };

  /**
   * Register a lazy-loader for a locale.
   */
  const loadLocale = (loc: string, loader: LocaleLoader): void => {
    if (isPrototypePollutionKey(loc)) {
      return;
    }
    loaders.set(loc, loader);
  };

  /**
   * Ensure a locale's messages are loaded.
   */
  const ensureLocale = async (loc: string): Promise<void> => {
    if (isPrototypePollutionKey(loc)) return;
    if (loadedLocales.has(loc)) return;

    const loader = loaders.get(loc);
    if (!loader) {
      throw new Error(`bQuery i18n: No messages or loader registered for locale "${loc}".`);
    }

    const loaded = await loader();
    // Handle both default exports and direct objects
    const msgs = (loaded as { default?: LocaleMessages }).default ?? (loaded as LocaleMessages);
    messages[loc] = clone(msgs);
    loadedLocales.add(loc);
  };

  /**
   * Translate a key path.
   */
  const t = (key: string, params: TranslateParams = {}): string => {
    const currentLocale = $locale.value;
    const currentMessages = messages[currentLocale];
    const fallbackMessages = fallbackLocale ? messages[fallbackLocale] : undefined;

    return translate(currentMessages, key, params, fallbackMessages);
  };

  /**
   * Reactive translation — returns a computed signal.
   */
  const tc = (key: string, params: TranslateParams = {}) => {
    return computed(() => {
      // Reading $locale.value creates a reactive dependency
      const currentLocale = $locale.value;
      const currentMessages = messages[currentLocale];
      const fallbackMessages = fallbackLocale ? messages[fallbackLocale] : undefined;

      return translate(currentMessages, key, params, fallbackMessages);
    });
  };

  /**
   * Format a number with the current (or overridden) locale.
   */
  const n = (value: number, options?: NumberFormatOptions): string => {
    const loc = options?.locale ?? $locale.value;
    return formatNumber(value, loc, options);
  };

  /**
   * Format a date with the current (or overridden) locale.
   */
  const d = (value: Date | number, options?: DateFormatOptions): string => {
    const loc = options?.locale ?? $locale.value;
    return formatDate(value, loc, options);
  };

  /**
   * Merge additional messages into a locale.
   */
  const mergeMessages = (loc: string, newMessages: LocaleMessages): void => {
    if (isPrototypePollutionKey(loc)) {
      return;
    }
    if (!messages[loc]) {
      messages[loc] = Object.create(null) as LocaleMessages;
      loadedLocales.add(loc);
    }
    messages[loc] = deepMerge(messages[loc], newMessages);
  };

  /**
   * List all available locales (loaded + registered loaders).
   */
  const availableLocales = (): string[] => {
    const locales = new Set<string>([...loadedLocales, ...loaders.keys()]);
    return Array.from(locales).sort();
  };

  return {
    $locale,
    t,
    tc,
    loadLocale,
    ensureLocale,
    n,
    d,
    getMessages,
    mergeMessages,
    availableLocales,
  };
};
