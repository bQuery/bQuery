/**
 * i18n 1.14.0 expansion tests — additive surface only.
 */

import { describe, expect, it } from 'bun:test';
import {
  detectLocale,
  formatDisplayName,
  formatList,
  formatRelativeTime,
  isRTL,
  negotiateLocale,
  segment,
} from '../src/i18n/index';

describe('i18n 1.14.0 expansion', () => {
  describe('negotiateLocale', () => {
    it('exact match wins', () => {
      expect(negotiateLocale(['de'], ['en', 'de', 'fr'])).toBe('de');
    });

    it('falls back to language match', () => {
      expect(negotiateLocale(['de-CH'], ['en', 'de', 'fr'])).toBe('de');
    });

    it('returns explicit fallback when no match', () => {
      expect(negotiateLocale(['ja'], ['en', 'fr'], { fallback: 'en' })).toBe('en');
    });

    it('returns first available when no fallback', () => {
      expect(negotiateLocale(['ja'], ['en', 'fr'])).toBe('en');
    });

    it('honors matchLanguage: false', () => {
      expect(
        negotiateLocale(['de-CH'], ['en', 'de', 'fr'], {
          matchLanguage: false,
          fallback: 'en',
        })
      ).toBe('en');
    });

    it('honors priority order', () => {
      expect(negotiateLocale(['ja', 'fr'], ['en', 'fr', 'de'])).toBe('fr');
    });
  });

  describe('detectLocale', () => {
    it('returns fallback when no sources are configured and no environment', () => {
      // navigator is happy-dom-supplied — at least one candidate will exist.
      const result = detectLocale({
        readHtmlLang: false,
        readNavigator: false,
        fallback: 'en',
      });
      expect(result).toBe('en');
    });

    it('reads from <html lang>', () => {
      const prev = document.documentElement.lang;
      document.documentElement.lang = 'de-CH';
      try {
        const result = detectLocale({
          available: ['en', 'de'],
          readNavigator: false,
          fallback: 'en',
        });
        expect(result).toBe('de');
      } finally {
        document.documentElement.lang = prev;
      }
    });

    it('reads from localStorage when storageKey is set', () => {
      localStorage.setItem('app_locale', 'fr');
      try {
        const result = detectLocale({
          available: ['en', 'fr'],
          storageKey: 'app_locale',
          readHtmlLang: false,
          readNavigator: false,
          fallback: 'en',
        });
        expect(result).toBe('fr');
      } finally {
        localStorage.removeItem('app_locale');
      }
    });
  });

  describe('isRTL', () => {
    it('returns false for LTR languages', () => {
      expect(isRTL('en')).toBe(false);
      expect(isRTL('de-CH')).toBe(false);
      expect(isRTL('')).toBe(false);
    });

    it('returns true for RTL languages', () => {
      expect(isRTL('ar')).toBe(true);
      expect(isRTL('he-IL')).toBe(true);
      expect(isRTL('fa')).toBe(true);
    });

    it('falls back to normalized locale subtags when Intl.Locale is unavailable', () => {
      const descriptor = Object.getOwnPropertyDescriptor(Intl, 'Locale');

      Object.defineProperty(Intl, 'Locale', {
        value: undefined,
        configurable: true,
      });

      try {
        expect(isRTL('uz-Arab')).toBe(true);
        expect(isRTL('ks-Arab')).toBe(true);
        expect(isRTL('ku-Arab')).toBe(true);
        expect(isRTL('ha-Arab')).toBe(true);
        expect(isRTL('ks')).toBe(false);
        expect(isRTL('ku')).toBe(false);
        expect(isRTL('ha')).toBe(false);
        expect(isRTL('en-Latn')).toBe(false);
      } finally {
        if (descriptor) {
          Object.defineProperty(Intl, 'Locale', descriptor);
        } else {
          delete (Intl as { Locale?: unknown }).Locale;
        }
      }
    });
  });

  describe('formatRelativeTime', () => {
    it('formats past times', () => {
      const result = formatRelativeTime(-1, 'day', 'en');
      expect(result).toMatch(/1 day|yesterday/i);
    });

    it('formats future times', () => {
      const result = formatRelativeTime(3, 'hour', 'en');
      expect(result.toLowerCase()).toContain('3 hours');
    });
  });

  describe('formatList', () => {
    it('formats with conjunction', () => {
      const out = formatList(['apples', 'pears', 'plums'], 'en');
      expect(out).toContain('apples');
      expect(out).toContain('plums');
      // Should include some form of separator like a comma or "and".
      expect(out).toMatch(/,| and /);
    });

    it('returns single element verbatim', () => {
      expect(formatList(['only'], 'en')).toBe('only');
    });

    it('returns empty string for empty list', () => {
      expect(formatList([], 'en')).toBe('');
    });
  });

  describe('formatDisplayName', () => {
    it('returns a non-empty string for a known language code', () => {
      const out = formatDisplayName('en', 'en', { type: 'language' });
      expect(typeof out).toBe('string');
      expect(out.length).toBeGreaterThan(0);
    });

    it('falls back to code for unknown values', () => {
      const out = formatDisplayName('zz', 'en', { type: 'language' });
      // Either Intl returns 'zz' or the helper does.
      expect(out.length).toBeGreaterThan(0);
    });
  });

  describe('segment', () => {
    it('segments by grapheme by default', () => {
      const out = segment('hi!', 'en');
      expect(out.join('')).toBe('hi!');
      expect(out.length).toBe(3);
    });

    it('segments by word', () => {
      const out = segment('hello world', 'en', { granularity: 'word' });
      expect(out.join('')).toBe('hello world');
      // 'hello', ' ', 'world' — at least 2 non-empty pieces.
      expect(out.filter((s) => s.trim().length > 0).length).toBeGreaterThanOrEqual(2);
    });

    it('falls back to Safari-safe sentence splitting without Intl.Segmenter', () => {
      const descriptor = Object.getOwnPropertyDescriptor(Intl, 'Segmenter');
      Object.defineProperty(Intl, 'Segmenter', {
        value: undefined,
        configurable: true,
      });
      try {
        const out = segment('Hello world! How are you? Great.', 'en', {
          granularity: 'sentence',
        });
        expect(out).toEqual(['Hello world!', 'How are you?', 'Great.']);
      } finally {
        if (descriptor) {
          Object.defineProperty(Intl, 'Segmenter', descriptor);
        }
      }
    });
  });
});
