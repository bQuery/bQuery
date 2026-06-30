/**
 * i18n → Stable (1.15.0) tests — issue #141.
 *
 * Covers the prerequisites that gate promotion:
 *  - ICU MessageFormat coverage (plural, selectordinal, select, nested args, `#`, offset, `=N`)
 *  - `defineMessages` / `formatMessage` authoring helpers
 *  - ICU integration through `createI18n().t()` / `tc()` with locale-aware plurals
 *  - Legacy pipe-plural + `{name}` interpolation still work (no regression)
 */

import { describe, expect, it } from 'bun:test';
import { createI18n, defineMessages, formatMessage } from '../src/i18n/index';
import { effect } from '../src/reactive/index';

describe('i18n Stable — ICU MessageFormat (#141)', () => {
  it('selects cardinal plural categories', () => {
    const msg = '{count, plural, one {# item} other {# items}}';
    expect(formatMessage(msg, { count: 1 })).toBe('1 item');
    expect(formatMessage(msg, { count: 5 })).toBe('5 items');
    expect(formatMessage(msg, { count: 0 })).toBe('0 items');
  });

  it('honours exact `=N` selectors over plural categories', () => {
    const msg = '{count, plural, =0 {No items} one {# item} other {# items}}';
    expect(formatMessage(msg, { count: 0 })).toBe('No items');
    expect(formatMessage(msg, { count: 1 })).toBe('1 item');
  });

  it('applies `offset:` and formats `#` as value − offset', () => {
    const msg = '{count, plural, offset:1 one {You and # other} other {You and # others}}';
    expect(formatMessage(msg, { count: 2 })).toBe('You and 1 other');
    expect(formatMessage(msg, { count: 3 })).toBe('You and 2 others');
  });

  it('supports selectordinal via Intl ordinal rules (en)', () => {
    const msg = '{place, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}';
    expect(formatMessage(msg, { place: 1 }, 'en')).toBe('1st');
    expect(formatMessage(msg, { place: 2 }, 'en')).toBe('2nd');
    expect(formatMessage(msg, { place: 3 }, 'en')).toBe('3rd');
    expect(formatMessage(msg, { place: 4 }, 'en')).toBe('4th');
    expect(formatMessage(msg, { place: 11 }, 'en')).toBe('11th');
  });

  it('supports select (grammatical gender)', () => {
    const msg = '{gender, select, male {He} female {She} other {They}} replied';
    expect(formatMessage(msg, { gender: 'male' })).toBe('He replied');
    expect(formatMessage(msg, { gender: 'female' })).toBe('She replied');
    expect(formatMessage(msg, { gender: 'nonbinary' })).toBe('They replied');
  });

  it('supports nested arguments inside sub-messages', () => {
    const msg = '{count, plural, one {{name} has # message} other {{name} has # messages}}';
    expect(formatMessage(msg, { count: 1, name: 'Ada' })).toBe('Ada has 1 message');
    expect(formatMessage(msg, { count: 4, name: 'Ada' })).toBe('Ada has 4 messages');
  });

  it('is locale-aware: German uses its own plural rules and number format', () => {
    const msg = '{count, plural, one {# Datei} other {# Dateien}}';
    expect(formatMessage(msg, { count: 1 }, 'de')).toBe('1 Datei');
    expect(formatMessage(msg, { count: 1000 }, 'de')).toBe('1.000 Dateien');
  });

  it('honours apostrophe escaping for literal braces and `#`', () => {
    expect(formatMessage("It's a test", {})).toBe("It's a test");
    expect(formatMessage("{count, plural, other {'#' literal #}}", { count: 5 })).toBe(
      '# literal 5'
    );
  });
});

describe('i18n Stable — authoring helpers (#141)', () => {
  it('defineMessages returns the catalog unchanged (identity)', () => {
    const m = defineMessages({ cart: { items: '{count, plural, one {# item} other {# items}}' } });
    expect(m.cart.items).toContain('plural');
  });

  it('formatMessage falls back to legacy interpolation/pluralization', () => {
    expect(formatMessage('Hello, {name}!', { name: 'Ada' })).toBe('Hello, Ada!');
    expect(formatMessage('{count} item | {count} items', { count: 2 })).toBe('2 items');
  });
});

describe('i18n Stable — ICU through createI18n (#141)', () => {
  const i18n = createI18n({
    locale: 'en',
    fallbackLocale: 'en',
    messages: {
      en: {
        cart: { items: '{count, plural, one {# item} other {# items}}' },
        greeting: 'Hello, {name}!',
        legacy: '{count} item | {count} items',
      },
      de: {
        cart: { items: '{count, plural, one {# Artikel} other {# Artikel}}' },
      },
    },
  });

  it('routes ICU keys through the formatter', () => {
    expect(i18n.t('cart.items', { count: 1 })).toBe('1 item');
    expect(i18n.t('cart.items', { count: 3 })).toBe('3 items');
  });

  it('keeps legacy interpolation and pipe-plurals working', () => {
    expect(i18n.t('greeting', { name: 'Ada' })).toBe('Hello, Ada!');
    expect(i18n.t('legacy', { count: 5 })).toBe('5 items');
  });

  it('reactively re-selects plurals when the locale changes', () => {
    const label = i18n.tc('cart.items', { count: 1 });
    const seen: string[] = [];
    const stop = effect(() => {
      seen.push(label.value);
    });
    expect(label.value).toBe('1 item');
    i18n.$locale.value = 'de';
    expect(label.value).toBe('1 Artikel');
    stop();
    i18n.$locale.value = 'en';
    expect(seen.length).toBeGreaterThanOrEqual(2);
  });
});
