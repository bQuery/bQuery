/**
 * i18n module tests.
 */

import { describe, expect, it } from 'bun:test';
import { createI18n, formatDate, formatNumber } from '../src/i18n/index';
import { effect } from '../src/reactive/index';

// ============================================================================
// Test messages
// ============================================================================

const enMessages = {
  greeting: 'Hello',
  welcome: 'Welcome, {name}!',
  farewell: 'Goodbye, {name}. See you in {place}.',
  items: '{count} item | {count} items',
  apples: 'no apples | {count} apple | {count} apples',
  nested: {
    deep: {
      key: 'Deep value',
    },
    level1: 'Level 1',
  },
  empty: '',
};

const deMessages = {
  greeting: 'Hallo',
  welcome: 'Willkommen, {name}!',
  items: '{count} Gegenstand | {count} Gegenstände',
  nested: {
    deep: {
      key: 'Tiefer Wert',
    },
  },
};

const frMessages = {
  greeting: 'Bonjour',
  welcome: 'Bienvenue, {name}!',
};

// ============================================================================
// createI18n
// ============================================================================

describe('i18n/createI18n', () => {
  const createTestI18n = () =>
    createI18n({
      locale: 'en',
      fallbackLocale: 'en',
      messages: { en: enMessages, de: deMessages },
    });

  describe('basic translation', () => {
    it('should translate a simple key', () => {
      const i18n = createTestI18n();
      expect(i18n.t('greeting')).toBe('Hello');
    });

    it('should translate with interpolation', () => {
      const i18n = createTestI18n();
      expect(i18n.t('welcome', { name: 'Ada' })).toBe('Welcome, Ada!');
    });

    it('should handle multiple interpolation params', () => {
      const i18n = createTestI18n();
      expect(i18n.t('farewell', { name: 'Bob', place: 'Berlin' })).toBe(
        'Goodbye, Bob. See you in Berlin.'
      );
    });

    it('should resolve nested keys with dot notation', () => {
      const i18n = createTestI18n();
      expect(i18n.t('nested.deep.key')).toBe('Deep value');
    });

    it('should resolve first-level nested key', () => {
      const i18n = createTestI18n();
      expect(i18n.t('nested.level1')).toBe('Level 1');
    });

    it('should return key when not found', () => {
      const i18n = createTestI18n();
      expect(i18n.t('nonexistent.key')).toBe('nonexistent.key');
    });

    it('should return key when partial path resolves to object', () => {
      const i18n = createTestI18n();
      expect(i18n.t('nested.deep')).toBe('nested.deep');
    });

    it('should handle empty string value', () => {
      const i18n = createTestI18n();
      expect(i18n.t('empty')).toBe('');
    });

    it('should leave unmatched placeholders as-is', () => {
      const i18n = createTestI18n();
      expect(i18n.t('welcome')).toBe('Welcome, {name}!');
    });

    it('should handle numeric interpolation values', () => {
      const i18n = createTestI18n();
      expect(i18n.t('welcome', { name: 42 })).toBe('Welcome, 42!');
    });

    it('should work when structuredClone is unavailable', () => {
      const originalStructuredClone = globalThis.structuredClone;
      const input = {
        en: {
          nested: {
            message: 'Hello',
          },
        },
      };

      try {
        // Simulate older runtimes that lack structuredClone
        Object.defineProperty(globalThis, 'structuredClone', {
          value: undefined,
          configurable: true,
          writable: true,
        });

        const i18n = createI18n({
          locale: 'en',
          fallbackLocale: 'en',
          messages: input,
        });

        input.en.nested.message = 'Mutated externally';

        expect(i18n.t('nested.message')).toBe('Hello');
      } finally {
        Object.defineProperty(globalThis, 'structuredClone', {
          value: originalStructuredClone,
          configurable: true,
          writable: true,
        });
      }
    });
  });

  describe('pluralization', () => {
    it('should select singular form for count=1 (two forms)', () => {
      const i18n = createTestI18n();
      expect(i18n.t('items', { count: 1 })).toBe('1 item');
    });

    it('should select plural form for count=0 (two forms)', () => {
      const i18n = createTestI18n();
      expect(i18n.t('items', { count: 0 })).toBe('0 items');
    });

    it('should select plural form for count=5 (two forms)', () => {
      const i18n = createTestI18n();
      expect(i18n.t('items', { count: 5 })).toBe('5 items');
    });

    it('should select zero form for count=0 (three forms)', () => {
      const i18n = createTestI18n();
      expect(i18n.t('apples', { count: 0 })).toBe('no apples');
    });

    it('should select one form for count=1 (three forms)', () => {
      const i18n = createTestI18n();
      expect(i18n.t('apples', { count: 1 })).toBe('1 apple');
    });

    it('should select many form for count=5 (three forms)', () => {
      const i18n = createTestI18n();
      expect(i18n.t('apples', { count: 5 })).toBe('5 apples');
    });

    it('should not pluralize when count is not in params', () => {
      const i18n = createTestI18n();
      // Without count, the pipe-delimited string is returned as-is
      expect(i18n.t('items')).toBe('{count} item | {count} items');
    });
  });

  describe('locale switching', () => {
    it('should switch locale via $locale signal', () => {
      const i18n = createTestI18n();
      expect(i18n.t('greeting')).toBe('Hello');

      i18n.$locale.value = 'de';
      expect(i18n.t('greeting')).toBe('Hallo');
    });

    it('should reflect current locale in $locale.value', () => {
      const i18n = createTestI18n();
      expect(i18n.$locale.value).toBe('en');

      i18n.$locale.value = 'de';
      expect(i18n.$locale.value).toBe('de');
    });

    it('should use translated pluralization in other locale', () => {
      const i18n = createTestI18n();
      i18n.$locale.value = 'de';
      expect(i18n.t('items', { count: 1 })).toBe('1 Gegenstand');
      expect(i18n.t('items', { count: 3 })).toBe('3 Gegenstände');
    });
  });

  describe('fallback locale', () => {
    it('should fall back when key missing in current locale', () => {
      const i18n = createTestI18n();
      i18n.$locale.value = 'de';
      // 'farewell' only exists in 'en'
      expect(i18n.t('farewell', { name: 'Bob', place: 'Berlin' })).toBe(
        'Goodbye, Bob. See you in Berlin.'
      );
    });

    it('should return key when not in current or fallback locale', () => {
      const i18n = createTestI18n();
      i18n.$locale.value = 'de';
      expect(i18n.t('totally.missing')).toBe('totally.missing');
    });

    it('should work without fallback locale', () => {
      const i18n = createI18n({
        locale: 'en',
        messages: { en: enMessages },
      });
      expect(i18n.t('greeting')).toBe('Hello');
      i18n.$locale.value = 'unknown';
      expect(i18n.t('greeting')).toBe('greeting');
    });
  });

  describe('reactive translation (tc)', () => {
    it('should return a computed signal with translation', () => {
      const i18n = createTestI18n();
      const label = i18n.tc('greeting');
      expect(label.value).toBe('Hello');
    });

    it('should update when locale changes', () => {
      const i18n = createTestI18n();
      const label = i18n.tc('greeting');
      expect(label.value).toBe('Hello');

      i18n.$locale.value = 'de';
      expect(label.value).toBe('Hallo');
    });

    it('should interpolate params in reactive translation', () => {
      const i18n = createTestI18n();
      const label = i18n.tc('welcome', { name: 'Ada' });
      expect(label.value).toBe('Welcome, Ada!');

      i18n.$locale.value = 'de';
      expect(label.value).toBe('Willkommen, Ada!');
    });

    it('should trigger effects when locale changes', () => {
      const i18n = createTestI18n();
      const label = i18n.tc('greeting');
      const results: string[] = [];

      const cleanup = effect(() => {
        results.push(label.value);
      });

      expect(results).toEqual(['Hello']);

      i18n.$locale.value = 'de';
      expect(results).toEqual(['Hello', 'Hallo']);

      cleanup();
    });
  });

  describe('lazy-loading', () => {
    it('should register a loader via loadLocale', () => {
      const i18n = createTestI18n();
      i18n.loadLocale('fr', async () => frMessages);
      expect(i18n.availableLocales()).toContain('fr');
    });

    it('should load locale via ensureLocale', async () => {
      const i18n = createTestI18n();
      i18n.loadLocale('fr', async () => frMessages);

      await i18n.ensureLocale('fr');
      i18n.$locale.value = 'fr';
      expect(i18n.t('greeting')).toBe('Bonjour');
    });

    it('should handle default export from loader', async () => {
      const i18n = createTestI18n();
      i18n.loadLocale('fr', async () => ({ default: frMessages }));

      await i18n.ensureLocale('fr');
      i18n.$locale.value = 'fr';
      expect(i18n.t('greeting')).toBe('Bonjour');
    });

    it('should not re-load already loaded locale', async () => {
      let loadCount = 0;
      const i18n = createTestI18n();
      i18n.loadLocale('fr', async () => {
        loadCount++;
        return frMessages;
      });

      await i18n.ensureLocale('fr');
      await i18n.ensureLocale('fr');
      expect(loadCount).toBe(1);
    });

    it('should throw for unknown locale without loader', async () => {
      const i18n = createTestI18n();
      expect(i18n.ensureLocale('zz')).rejects.toThrow('No messages or loader');
    });

    it('should not need ensureLocale for pre-loaded locales', async () => {
      const i18n = createTestI18n();
      await i18n.ensureLocale('en'); // Already loaded
      expect(i18n.t('greeting')).toBe('Hello');
    });
  });

  describe('mergeMessages', () => {
    it('should merge new keys into existing locale', () => {
      const i18n = createTestI18n();
      i18n.mergeMessages('en', { extra: 'Extra value' });
      expect(i18n.t('extra')).toBe('Extra value');
      // Existing keys preserved
      expect(i18n.t('greeting')).toBe('Hello');
    });

    it('should deep merge nested messages', () => {
      const i18n = createTestI18n();
      i18n.mergeMessages('en', { nested: { deep: { another: 'Another' } } });
      expect(i18n.t('nested.deep.another')).toBe('Another');
      // Existing nested key preserved
      expect(i18n.t('nested.deep.key')).toBe('Deep value');
    });

    it('should create new locale when merging into non-existent', () => {
      const i18n = createTestI18n();
      i18n.mergeMessages('ja', { greeting: 'こんにちは' });
      i18n.$locale.value = 'ja';
      expect(i18n.t('greeting')).toBe('こんにちは');
    });

    it('should not allow prototype pollution keys during merge', () => {
      const i18n = createTestI18n();
      i18n.mergeMessages('en', JSON.parse('{\"__proto__\":{\"polluted\":\"yes\"},\"safe\":\"ok\"}'));

      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
      expect(i18n.t('safe')).toBe('ok');
      expect(Object.getPrototypeOf(i18n.getMessages('en'))).toBeNull();
    });
  });

  describe('getMessages', () => {
    it('should return messages for loaded locale', () => {
      const i18n = createTestI18n();
      const msgs = i18n.getMessages('en');
      expect(msgs).toBeDefined();
      expect(msgs!.greeting).toBe('Hello');
    });

    it('should return undefined for unloaded locale', () => {
      const i18n = createTestI18n();
      expect(i18n.getMessages('zz')).toBeUndefined();
    });
  });

  describe('availableLocales', () => {
    it('should list pre-loaded locales', () => {
      const i18n = createTestI18n();
      expect(i18n.availableLocales()).toEqual(['de', 'en']);
    });

    it('should include registered loader locales', () => {
      const i18n = createTestI18n();
      i18n.loadLocale('fr', async () => frMessages);
      expect(i18n.availableLocales()).toEqual(['de', 'en', 'fr']);
    });
  });

  describe('number formatting', () => {
    it('should format numbers with current locale', () => {
      const i18n = createTestI18n();
      const result = i18n.n(1234.56);
      // en locale default
      expect(result).toContain('1');
      expect(result).toContain('234');
    });

    it('should format with style: currency', () => {
      const i18n = createTestI18n();
      const result = i18n.n(9.99, { style: 'currency', currency: 'USD' });
      expect(result).toContain('9.99');
    });

    it('should override locale for formatting', () => {
      const i18n = createTestI18n();
      const result = i18n.n(1234.56, { locale: 'de-DE' });
      // German uses . as thousands separator
      expect(result).toContain('1');
    });

    it('should format with style: percent', () => {
      const i18n = createTestI18n();
      const result = i18n.n(0.42, { style: 'percent' });
      expect(result).toContain('42');
    });
  });

  describe('date formatting', () => {
    it('should format Date objects', () => {
      const i18n = createTestI18n();
      const date = new Date(2026, 2, 26); // March 26, 2026
      const result = i18n.d(date);
      expect(result).toContain('2026');
    });

    it('should format timestamps', () => {
      const i18n = createTestI18n();
      const ts = new Date(2026, 2, 26).getTime();
      const result = i18n.d(ts);
      expect(result).toContain('2026');
    });

    it('should override locale for date formatting', () => {
      const i18n = createTestI18n();
      const date = new Date(2026, 2, 26);
      const result = i18n.d(date, { locale: 'de-DE' });
      // German date format includes 26.3.2026 or similar
      expect(result).toContain('26');
    });

    it('should use dateStyle option', () => {
      const i18n = createTestI18n();
      const date = new Date(2026, 2, 26);
      const result = i18n.d(date, { dateStyle: 'long' });
      expect(result.length).toBeGreaterThan(8);
    });
  });

  describe('isolation', () => {
    it('should not mutate the original messages config', () => {
      const originalMessages = {
        en: { greeting: 'Hello' },
      };
      const i18n = createI18n({
        locale: 'en',
        messages: originalMessages,
      });

      i18n.mergeMessages('en', { extra: 'Extra' });
      // Original should be unchanged
      expect((originalMessages.en as Record<string, string>).extra).toBeUndefined();
    });

    it('should create independent instances', () => {
      const i18n1 = createI18n({
        locale: 'en',
        messages: { en: { key: 'Value 1' } },
      });
      const i18n2 = createI18n({
        locale: 'en',
        messages: { en: { key: 'Value 2' } },
      });

      expect(i18n1.t('key')).toBe('Value 1');
      expect(i18n2.t('key')).toBe('Value 2');

      i18n1.$locale.value = 'de';
      expect(i18n2.$locale.value).toBe('en');
    });
  });

  describe('edge cases', () => {
    it('should handle empty messages object', () => {
      const i18n = createI18n({
        locale: 'en',
        messages: {},
      });
      expect(i18n.t('anything')).toBe('anything');
    });

    it('should handle empty key', () => {
      const i18n = createTestI18n();
      expect(i18n.t('')).toBe('');
    });

    it('should handle key with only dots', () => {
      const i18n = createTestI18n();
      expect(i18n.t('...')).toBe('...');
    });

    it('should handle locale switch to non-existent locale', () => {
      const i18n = createTestI18n();
      i18n.$locale.value = 'zz';
      // Falls back to 'en'
      expect(i18n.t('greeting')).toBe('Hello');
    });

    it('should handle params with special regex chars', () => {
      const i18n = createI18n({
        locale: 'en',
        messages: { en: { msg: 'Value: {val}' } },
      });
      expect(i18n.t('msg', { val: '$100.00' })).toBe('Value: $100.00');
    });
  });
});

// ============================================================================
// Standalone formatting functions
// ============================================================================

describe('i18n/formatNumber', () => {
  it('should format basic number', () => {
    const result = formatNumber(1234, 'en');
    expect(result).toContain('1');
    expect(result).toContain('234');
  });

  it('should handle NaN gracefully', () => {
    const result = formatNumber(NaN, 'en');
    expect(result).toBe('NaN');
  });

  it('should handle Infinity', () => {
    const result = formatNumber(Infinity, 'en');
    expect(result).toContain('∞');
  });

  it('should handle zero', () => {
    const result = formatNumber(0, 'en');
    expect(result).toBe('0');
  });

  it('should handle negative numbers', () => {
    const result = formatNumber(-42, 'en');
    expect(result).toContain('42');
  });
});

describe('i18n/formatDate', () => {
  it('should format Date object', () => {
    const date = new Date(2026, 0, 15);
    const result = formatDate(date, 'en');
    expect(result).toContain('2026');
  });

  it('should format timestamp number', () => {
    const ts = new Date(2026, 0, 15).getTime();
    const result = formatDate(ts, 'en');
    expect(result).toContain('2026');
  });

  it('should handle invalid date gracefully', () => {
    const result = formatDate(new Date('invalid'), 'en');
    expect(typeof result).toBe('string');
  });
});

// ============================================================================
// Module exports
// ============================================================================

describe('i18n/module exports', () => {
  it('should export createI18n', async () => {
    const mod = await import('../src/i18n/index');
    expect(typeof mod.createI18n).toBe('function');
  });

  it('should export formatNumber', async () => {
    const mod = await import('../src/i18n/index');
    expect(typeof mod.formatNumber).toBe('function');
  });

  it('should export formatDate', async () => {
    const mod = await import('../src/i18n/index');
    expect(typeof mod.formatDate).toBe('function');
  });
});
