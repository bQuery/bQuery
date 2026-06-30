/**
 * Translation resolution helpers.
 * @module bquery/i18n
 * @internal
 */

import { isPlainObject, isPrototypePollutionKey, merge } from '../core/utils/object';
import { formatICU, isICUMessage } from './icu';
import type { LocaleMessages, TranslateParams } from './types';

/**
 * Resolves a dot-delimited key path against a messages object.
 *
 * @param messages - The locale messages
 * @param key - Dot-delimited key (e.g. 'user.welcome')
 * @returns The resolved string, or `undefined` if not found
 *
 * @internal
 */
export const resolveKey = (messages: LocaleMessages, key: string): string | undefined => {
  const parts = key.split('.');
  let current: LocaleMessages | string = messages;

  for (const part of parts) {
    if (typeof current === 'string') return undefined;
    if (current[part] === undefined) return undefined;
    current = current[part];
  }

  return typeof current === 'string' ? current : undefined;
};

/**
 * Interpolates `{param}` placeholders in a string.
 *
 * @param template - The template string with `{key}` placeholders
 * @param params - Key-value pairs for replacement
 * @returns The interpolated string
 *
 * @example
 * ```ts
 * interpolate('Hello, {name}!', { name: 'Ada' });
 * // → 'Hello, Ada!'
 * ```
 *
 * @internal
 */
export const interpolate = (template: string, params: TranslateParams): string => {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    if (key in params) {
      return String(params[key]);
    }
    return match; // Leave unmatched placeholders as-is
  });
};

/**
 * Selects the correct plural form from a pipe-delimited string.
 *
 * Supports two formats:
 * - **Two forms:** `"singular | plural"` — singular when count === 1
 * - **Three forms:** `"zero | one | many"` — zero when count === 0,
 *   one when count === 1, many otherwise
 *
 * The `count` parameter must be present in `params` for pluralization.
 * If no `count` param exists or the string has no pipes, the string is
 * returned as-is.
 *
 * @param template - Pipe-delimited plural forms
 * @param params - Must include a `count` key for plural selection
 * @returns The selected form
 *
 * @example
 * ```ts
 * pluralize('{count} item | {count} items', { count: 1 });
 * // → '{count} item'
 *
 * pluralize('no items | {count} item | {count} items', { count: 0 });
 * // → 'no items'
 * ```
 *
 * @internal
 */
export const pluralize = (template: string, params: TranslateParams): string => {
  if (!template.includes('|')) return template;
  if (!('count' in params)) return template;

  const count = Number(params.count);
  const forms = template.split('|').map((s) => s.trim());

  if (forms.length === 3) {
    // zero | one | many
    if (count === 0) return forms[0];
    if (count === 1) return forms[1];
    return forms[2];
  }

  if (forms.length === 2) {
    // singular | plural
    return count === 1 ? forms[0] : forms[1];
  }

  // More than 3 forms: use last form for "many"
  if (count === 0 && forms.length > 0) return forms[0];
  if (count === 1 && forms.length > 1) return forms[1];
  return forms[forms.length - 1];
};

/**
 * Full translation pipeline: resolve → pluralize → interpolate.
 *
 * Messages using ICU MessageFormat typed arguments (`plural`,
 * `selectordinal`, `select`) are routed through the ICU formatter, which is
 * locale-aware via `Intl.PluralRules`. Plain `{name}` interpolation and
 * pipe-delimited plurals keep using the legacy fast path.
 *
 * @param messages - Locale messages
 * @param key - Dot-delimited key path
 * @param params - Interpolation + pluralization params
 * @param locale - The active locale (used for ICU plural selection / `#`)
 * @param fallbackMessages - Optional fallback locale messages
 * @returns The translated string, or the key if not found
 *
 * @internal
 */
export const translate = (
  messages: LocaleMessages | undefined,
  key: string,
  params: TranslateParams,
  locale: string,
  fallbackMessages?: LocaleMessages
): string => {
  let template: string | undefined;

  // Try current locale
  if (messages) {
    template = resolveKey(messages, key);
  }

  // Fallback locale
  if (template === undefined && fallbackMessages) {
    template = resolveKey(fallbackMessages, key);
  }

  // Key not found — return key as-is
  if (template === undefined) {
    return key;
  }

  // ICU MessageFormat (plural / selectordinal / select) — locale-aware path.
  if (isICUMessage(template)) {
    try {
      return formatICU(template, params, locale);
    } catch {
      // A malformed ICU string in the catalog must not crash translation; fall
      // back to simple `{name}` interpolation so the app keeps rendering.
      return interpolate(template, params);
    }
  }

  // Legacy path: pluralize first, then interpolate.
  const pluralized = pluralize(template, params);
  return interpolate(pluralized, params);
};

/**
 * Deep merges source into target and returns a sanitized, prototype-safe copy.
 *
 * @param target - Target messages object
 * @param source - Source messages to merge
 * @returns A new merged, sanitized messages object
 *
 * @internal
 */
export const deepMerge = (target: LocaleMessages, source: LocaleMessages): LocaleMessages => {
  const merged = merge(
    target as Record<string, unknown>,
    source as Record<string, unknown>
  ) as LocaleMessages;

  const cloneSafeMessages = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map((entry) => cloneSafeMessages(entry));
    }

    if (!isPlainObject(value)) {
      return value;
    }

    const safeObject = Object.create(null) as Record<string, unknown>;
    for (const [key, entry] of Object.entries(value)) {
      if (isPrototypePollutionKey(key)) {
        continue;
      }
      safeObject[key] = cloneSafeMessages(entry);
    }
    return safeObject;
  };

  return cloneSafeMessages(merged) as LocaleMessages;
};
