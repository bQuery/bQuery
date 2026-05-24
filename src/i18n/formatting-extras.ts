/**
 * Additional Intl-based formatting helpers — 1.14.0.
 *
 * Standalone equivalents to the existing {@link formatNumber}/{@link formatDate}
 * for relative time, lists, language/region display names, and grapheme/word
 * segmentation. All helpers feature-detect their backing API and fall back
 * gracefully where the runtime predates the relevant Intl support.
 *
 * @module bquery/i18n
 * @since 1.14.0
 */

/**
 * Options accepted by {@link formatRelativeTime}.
 *
 * @since 1.14.0
 */
export type RelativeTimeFormatOptions = Intl.RelativeTimeFormatOptions;

/**
 * Format a duration as a localized relative time string
 * (e.g. `'in 3 days'`, `'1 hour ago'`).
 *
 * @since 1.14.0
 *
 * @example
 * ```ts
 * formatRelativeTime(-1, 'day', 'en'); // '1 day ago'
 * formatRelativeTime(3, 'hour', 'en'); // 'in 3 hours'
 * ```
 */
export const formatRelativeTime = (
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  locale: string,
  options?: RelativeTimeFormatOptions
): string => {
  try {
    const Ctor = (Intl as unknown as {
      RelativeTimeFormat?: new (
        locale: string,
        options?: Intl.RelativeTimeFormatOptions
      ) => Intl.RelativeTimeFormat;
    }).RelativeTimeFormat;
    if (typeof Ctor === 'function') {
      return new Ctor(locale, options).format(value, unit);
    }
  } catch {
    // fall through
  }
  // Best-effort fallback: English-style "in N unit" / "N unit ago".
  const abs = Math.abs(value);
  const suffix = abs === 1 ? unit : `${unit}s`;
  return value < 0 ? `${abs} ${suffix} ago` : `in ${abs} ${suffix}`;
};

/**
 * Options accepted by {@link formatList}. Mirrors the standard
 * `Intl.ListFormat` constructor options; defined locally so the project
 * doesn't depend on TypeScript lib targets that expose
 * `Intl.ListFormatOptions`.
 *
 * @since 1.14.0
 */
export type ListFormatOptions = {
  type?: 'conjunction' | 'disjunction' | 'unit';
  style?: 'long' | 'short' | 'narrow';
  localeMatcher?: 'best fit' | 'lookup';
};

/**
 * Format an array of strings as a localized list (e.g. `'a, b, and c'`).
 *
 * @since 1.14.0
 *
 * @example
 * ```ts
 * formatList(['apples', 'pears', 'plums'], 'en'); // 'apples, pears, and plums'
 * formatList(['apples', 'pears'], 'en', { type: 'disjunction' }); // 'apples or pears'
 * ```
 */
export const formatList = (
  values: readonly string[],
  locale: string,
  options?: ListFormatOptions
): string => {
  try {
    const Ctor = (Intl as unknown as {
      ListFormat?: new (
        locale: string,
        options?: ListFormatOptions
      ) => { format: (values: readonly string[]) => string };
    }).ListFormat;
    if (typeof Ctor === 'function') {
      return new Ctor(locale, options).format(values);
    }
  } catch {
    // fall through
  }
  // Minimal fallback: comma-join with "and" before last.
  if (values.length === 0) return '';
  if (values.length === 1) return values[0] ?? '';
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
};

/**
 * Get the localized display name for a code (language, region, currency,
 * script, or calendar). Wraps {@link Intl.DisplayNames}.
 *
 * @since 1.14.0
 *
 * @example
 * ```ts
 * formatDisplayName('en', 'de', { type: 'language' }); // 'Englisch'
 * formatDisplayName('US', 'en', { type: 'region' });   // 'United States'
 * formatDisplayName('USD', 'en', { type: 'currency' });// 'US Dollar'
 * ```
 */
export const formatDisplayName = (
  code: string,
  locale: string,
  options: Intl.DisplayNamesOptions
): string => {
  try {
    const Ctor = (Intl as unknown as {
      DisplayNames?: new (
        locale: string | string[],
        options: Intl.DisplayNamesOptions
      ) => { of: (code: string) => string | undefined };
    }).DisplayNames;
    if (typeof Ctor === 'function') {
      const result = new Ctor(locale, options).of(code);
      return result ?? code;
    }
  } catch {
    // fall through
  }
  return code;
};

/**
 * Returns an array of grapheme- or word-segmented substrings using
 * {@link Intl.Segmenter}. Falls back to a simple character/whitespace split
 * when the API is unavailable.
 *
 * @since 1.14.0
 *
 * @example
 * ```ts
 * segment('hello world', 'en', { granularity: 'word' });
 * // [ 'hello', ' ', 'world' ]
 * ```
 */
export const segment = (
  text: string,
  locale: string,
  options: { granularity?: 'grapheme' | 'word' | 'sentence' } = {}
): string[] => {
  const { granularity = 'grapheme' } = options;
  try {
    const Ctor = (Intl as unknown as {
      Segmenter?: new (
        locale: string,
        options: { granularity?: string }
      ) => { segment: (input: string) => Iterable<{ segment: string }> };
    }).Segmenter;
    if (typeof Ctor === 'function') {
      const seg = new Ctor(locale, { granularity });
      const out: string[] = [];
      for (const piece of seg.segment(text)) {
        out.push(piece.segment);
      }
      return out;
    }
  } catch {
    // fall through
  }
  if (granularity === 'word') {
    // Naive whitespace fallback that preserves whitespace runs as separators.
    return text.split(/(\s+)/).filter((s) => s !== '');
  }
  if (granularity === 'sentence') {
    return text.split(/(?<=[.!?])\s+/);
  }
  return Array.from(text);
};
