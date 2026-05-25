/**
 * Locale negotiation and detection — 1.14.0 additions.
 *
 * Pure helpers that complement {@link createI18n}; they can be used at
 * application bootstrap to pick a starting locale before constructing
 * the i18n instance.
 *
 * @module bquery/i18n
 * @since 1.14.0
 */

const normalize = (tag: string): string => tag.toLowerCase().replace(/_/g, '-');

const parseLocale = (tag: string): { language: string; region: string | null } => {
  const parts = normalize(tag).split('-');
  return {
    language: parts[0] ?? '',
    region: parts.length > 1 ? (parts[parts.length - 1] ?? null) : null,
  };
};

/**
 * Options for {@link negotiateLocale}.
 *
 * @since 1.14.0
 */
export type NegotiateLocaleOptions = {
  /**
   * Fallback locale returned when no requested tag matches an available one.
   * Defaults to the first entry of `available`.
   */
  fallback?: string;
  /**
   * When `true` (default), a language match without an exact region match
   * is allowed (e.g. `'de-CH'` matches available `'de'`).
   */
  matchLanguage?: boolean;
};

/**
 * Pure locale negotiation — matches a list of requested locale tags
 * (in priority order) against the available set, returning the best match.
 *
 * Matching strategy:
 * 1. Exact match (case-insensitive).
 * 2. Language-only match when `matchLanguage` is `true`.
 * 3. Fallback (either the provided `fallback` option or the first available).
 *
 * @since 1.14.0
 *
 * @example
 * ```ts
 * import { negotiateLocale } from '@bquery/bquery/i18n';
 *
 * negotiateLocale(['de-CH', 'en'], ['en', 'de', 'fr']); // 'de'
 * negotiateLocale(['fr-CA'], ['en', 'fr']);              // 'fr'
 * negotiateLocale(['ja'], ['en', 'de'], { fallback: 'en' }); // 'en'
 * ```
 */
export const negotiateLocale = (
  requested: readonly string[],
  available: readonly string[],
  options: NegotiateLocaleOptions = {}
): string => {
  const { fallback, matchLanguage = true } = options;
  const availableNormalized = available.map((tag) => ({
    original: tag,
    normalized: normalize(tag),
    language: parseLocale(tag).language,
  }));

  for (const tag of requested) {
    const n = normalize(tag);
    // Exact match.
    const exact = availableNormalized.find((a) => a.normalized === n);
    if (exact) return exact.original;
    // Language-only match.
    if (matchLanguage) {
      const language = parseLocale(tag).language;
      const langMatch = availableNormalized.find((a) => a.language === language);
      if (langMatch) return langMatch.original;
    }
  }

  if (fallback !== undefined) return fallback;
  return available[0] ?? '';
};

/**
 * Options for {@link detectLocale}.
 *
 * @since 1.14.0
 */
export type DetectLocaleOptions = {
  /**
   * The full set of available locale tags. When provided, the detected
   * locale is run through {@link negotiateLocale}.
   */
  available?: readonly string[];
  /** Fallback locale returned when detection finds nothing usable. */
  fallback?: string;
  /**
   * Whether to read `document.documentElement.lang` first. Default `true`.
   */
  readHtmlLang?: boolean;
  /**
   * Whether to read `navigator.languages` / `navigator.language`. Default `true`.
   */
  readNavigator?: boolean;
  /**
   * Optional cookie name to read. When a value is found, it is used as the
   * highest-priority hint.
   */
  cookieName?: string;
  /**
   * Optional `localStorage` key to read. When present, takes priority over
   * navigator/html sources but yields to `cookieName`.
   */
  storageKey?: string;
};

const readCookie = (name: string): string | null => {
  if (typeof document === 'undefined' || typeof document.cookie !== 'string') return null;
  const cookies = document.cookie.split(';');
  for (const raw of cookies) {
    const trimmed = raw.trim();
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    if (trimmed.slice(0, eq) === name) {
      try {
        return decodeURIComponent(trimmed.slice(eq + 1));
      } catch {
        return trimmed.slice(eq + 1);
      }
    }
  }
  return null;
};

const readStorage = (key: string): string | null => {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {
    // localStorage may throw in restricted contexts
  }
  return null;
};

/**
 * Detects the user's preferred locale from a chain of common sources:
 * `cookieName` → `storageKey` → `<html lang>` → `navigator.languages`.
 *
 * When `available` is provided, the candidate list is funneled through
 * {@link negotiateLocale} so that the returned tag is guaranteed to be one
 * of the available locales (or `fallback`).
 *
 * @since 1.14.0
 *
 * @example
 * ```ts
 * import { detectLocale } from '@bquery/bquery/i18n';
 *
 * const locale = detectLocale({
 *   available: ['en', 'de', 'fr'],
 *   cookieName: 'lang',
 *   storageKey: 'locale',
 *   fallback: 'en',
 * });
 * ```
 */
export const detectLocale = (options: DetectLocaleOptions = {}): string => {
  const {
    available,
    fallback = 'en',
    readHtmlLang = true,
    readNavigator = true,
    cookieName,
    storageKey,
  } = options;

  const candidates: string[] = [];

  if (cookieName) {
    const fromCookie = readCookie(cookieName);
    if (fromCookie) candidates.push(fromCookie);
  }
  if (storageKey) {
    const fromStorage = readStorage(storageKey);
    if (fromStorage) candidates.push(fromStorage);
  }
  if (readHtmlLang && typeof document !== 'undefined') {
    const htmlLang = document.documentElement?.lang;
    if (htmlLang) candidates.push(htmlLang);
  }
  if (readNavigator && typeof navigator !== 'undefined') {
    if (Array.isArray(navigator.languages)) {
      candidates.push(...navigator.languages);
    } else if (navigator.language) {
      candidates.push(navigator.language);
    }
  }

  if (candidates.length === 0) return fallback;

  if (available && available.length > 0) {
    return negotiateLocale(candidates, available, { fallback });
  }
  return candidates[0] ?? fallback;
};

const RTL_LANGUAGES = new Set([
  'ar',
  'arc',
  'dv',
  'fa',
  'ha',
  'he',
  'khw',
  'ks',
  'ku',
  'ps',
  'sd',
  'ur',
  'uz-arab',
  'yi',
]);

/**
 * Returns `true` when the given locale or language tag uses a right-to-left
 * script. Detection uses {@link Intl.Locale} when available and falls back
 * to a hard-coded list of well-known RTL languages.
 *
 * @since 1.14.0
 *
 * @example
 * ```ts
 * import { isRTL } from '@bquery/bquery/i18n';
 *
 * isRTL('en');     // false
 * isRTL('ar-EG');  // true
 * isRTL('fa');     // true
 * ```
 */
export const isRTL = (locale: string): boolean => {
  if (!locale) return false;
  const normalizedLocale = normalize(locale);
  // Prefer the Intl.Locale text-info API where available.
  try {
    const Loc = (Intl as unknown as { Locale?: new (tag: string) => unknown }).Locale;
    if (typeof Loc === 'function') {
      const inst = new Loc(locale) as {
        textInfo?: { direction?: string };
        getTextInfo?: () => { direction?: string };
      };
      const info = inst.textInfo ?? (inst.getTextInfo ? inst.getTextInfo() : undefined);
      if (info && info.direction) return info.direction === 'rtl';
    }
  } catch {
    // ignore — fall through to manual lookup
  }
  const parts = normalizedLocale.split('-').filter(Boolean);
  for (let length = parts.length; length > 0; length--) {
    if (RTL_LANGUAGES.has(parts.slice(0, length).join('-'))) {
      return true;
    }
  }
  return false;
};
