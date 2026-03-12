/**
 * Platform module tests.
 * Tests for storage, cache, buckets, and notifications APIs.
 */
import { beforeEach, describe, expect, it } from 'bun:test';
import { notifications } from '../src/platform/notifications';

const withMockCookies = async (callback: () => Promise<void> | void): Promise<void> => {
  const original = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
  const jar = new Map<string, string>();

  Object.defineProperty(document, 'cookie', {
    configurable: true,
    get() {
      return [...jar.entries()]
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');
    },
    set(value: string) {
      const [pair] = value.split(';');
      const [rawName, rawValue = ''] = pair.split('=');
      const name = rawName.trim();
      const decodedValue = rawValue.trim();

      if (value.includes('Expires=Thu, 01 Jan 1970 00:00:00 GMT') || decodedValue === '') {
        jar.delete(name);
        return;
      }

      jar.set(name, decodedValue);
    },
  });

  try {
    await callback();
  } finally {
    if (original) {
      Object.defineProperty(document, 'cookie', original);
    }
  }
};

describe('platform/notifications', () => {
  it('isSupported returns boolean', () => {
    const result = notifications.isSupported();
    expect(typeof result).toBe('boolean');
  });

  it('getPermission returns permission state', () => {
    const permission = notifications.getPermission();
    expect(['granted', 'denied', 'default']).toContain(permission);
  });

  it('requestPermission returns a promise', async () => {
    const result = notifications.requestPermission();
    expect(result).toBeInstanceOf(Promise);
  });

  it('send returns null when permission not granted', () => {
    // In test environment, Notification is not available
    const result = notifications.send('Test');
    expect(result).toBeNull();
  });
});

describe('platform/storage interface', () => {
  // Mock localStorage for testing
  const mockStorage: Record<string, string> = {};

  beforeEach(() => {
    // Clear mock storage before each test
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
  });

  it('storage adapters follow StorageAdapter interface', async () => {
    // Test that storage module exports correctly
    const { storage } = await import('../src/platform/storage');

    expect(storage).toBeDefined();
    expect(typeof storage.local).toBe('function');
    expect(typeof storage.session).toBe('function');
    expect(typeof storage.indexedDB).toBe('function');
  });

  it('local adapter has required methods', async () => {
    // Skip in test environment without localStorage
    if (typeof localStorage === 'undefined') {
      expect(true).toBe(true); // Pass test gracefully
      return;
    }
    const { storage } = await import('../src/platform/storage');
    const local = storage.local();

    expect(typeof local.get).toBe('function');
    expect(typeof local.set).toBe('function');
    expect(typeof local.remove).toBe('function');
    expect(typeof local.clear).toBe('function');
    expect(typeof local.keys).toBe('function');
  });

  it('local adapter keys() returns storage keys', async () => {
    if (typeof localStorage === 'undefined') {
      expect(true).toBe(true);
      return;
    }
    const { storage } = await import('../src/platform/storage');
    const local = storage.local();

    // Use unique prefixed keys to avoid cross-test interference
    const key1 = '__bquery_test_keys_1__';
    const key2 = '__bquery_test_keys_2__';

    await local.set(key1, 'value1');
    await local.set(key2, 'value2');

    const keys = await local.keys();
    expect(keys).toContain(key1);
    expect(keys).toContain(key2);

    // Clean up only our test keys
    await local.remove(key1);
    await local.remove(key2);
  });

  it('session adapter has required methods', async () => {
    // Skip in test environment without sessionStorage
    if (typeof sessionStorage === 'undefined') {
      expect(true).toBe(true); // Pass test gracefully
      return;
    }
    const { storage } = await import('../src/platform/storage');
    const session = storage.session();

    expect(typeof session.get).toBe('function');
    expect(typeof session.set).toBe('function');
    expect(typeof session.remove).toBe('function');
    expect(typeof session.clear).toBe('function');
    expect(typeof session.keys).toBe('function');
  });

  it('indexedDB adapter has required methods', async () => {
    const { storage } = await import('../src/platform/storage');
    const db = storage.indexedDB({ name: 'test', store: 'kv' });

    expect(typeof db.get).toBe('function');
    expect(typeof db.set).toBe('function');
    expect(typeof db.remove).toBe('function');
    expect(typeof db.clear).toBe('function');
    expect(typeof db.keys).toBe('function');
  });
});

describe('platform/buckets interface', () => {
  it('buckets module exports open function', async () => {
    const { buckets } = await import('../src/platform/buckets');

    expect(buckets).toBeDefined();
    expect(typeof buckets.open).toBe('function');
  });

  it('bucket has required methods', async () => {
    const { buckets } = await import('../src/platform/buckets');
    const bucket = await buckets.open('test-bucket');

    expect(typeof bucket.put).toBe('function');
    expect(typeof bucket.get).toBe('function');
    expect(typeof bucket.remove).toBe('function');
    expect(typeof bucket.keys).toBe('function');
  });
});

describe('platform/cache interface', () => {
  it('cache module exports expected functions', async () => {
    const { cache } = await import('../src/platform/cache');

    expect(cache).toBeDefined();
    expect(typeof cache.isSupported).toBe('function');
    expect(typeof cache.open).toBe('function');
    expect(typeof cache.delete).toBe('function');
    expect(typeof cache.keys).toBe('function');
  });

  it('isSupported returns boolean', async () => {
    const { cache } = await import('../src/platform/cache');
    const result = cache.isSupported();
    expect(typeof result).toBe('boolean');
  });
});

describe('platform/useCookie', () => {
  it('reads and writes reactive cookie values', async () => {
    await withMockCookies(async () => {
      const { useCookie } = await import('../src/platform/index');
      document.cookie = 'theme=dark; Path=/';

      const theme = useCookie<string>('theme');
      expect(theme.value).toBe('dark');

      theme.value = 'light';
      expect(document.cookie).toContain('theme=light');

      theme.value = null;
      expect(document.cookie).not.toContain('theme=light');
    });
  });

  it('supports typed defaults without writing immediately', async () => {
    await withMockCookies(async () => {
      const { useCookie } = await import('../src/platform/index');
      const cookieName = `prefs-${Date.now()}`;

      const prefs = useCookie<{ mode: string }>(cookieName, {
        defaultValue: { mode: 'system' },
      });

      expect(prefs.value).toEqual({ mode: 'system' });
      expect(document.cookie).not.toContain(cookieName);

      prefs.value = { mode: 'dark' };
      expect(document.cookie).toContain(encodeURIComponent(cookieName));
    });
  });
});

describe('platform/definePageMeta', () => {
  it('applies and restores document metadata', async () => {
    const { defineBqueryConfig, definePageMeta } = await import('../src/platform/index');
    defineBqueryConfig({
      pageMeta: {
        titleTemplate: (title) => `${title} · bQuery`,
      },
    });

    const cleanup = definePageMeta({
      title: 'Dashboard',
      description: 'Overview page',
      htmlAttributes: { lang: 'de' },
      bodyAttributes: { 'data-page': 'dashboard' },
      link: [{ rel: 'canonical', href: 'https://example.com/dashboard' }],
    });

    expect(document.title).toBe('Dashboard · bQuery');
    expect(document.documentElement.getAttribute('lang')).toBe('de');
    expect(document.body.getAttribute('data-page')).toBe('dashboard');
    expect(document.head.querySelector('meta[name=\"description\"]')?.getAttribute('content')).toBe(
      'Overview page'
    );

    cleanup();

    expect(document.title).not.toBe('Dashboard · bQuery');
    expect(document.head.querySelector('meta[name=\"description\"]')).toBeNull();
  });

  it('does not mutate the provided meta entries array', async () => {
    const { definePageMeta } = await import('../src/platform/index');
    const meta = [{ property: 'og:title', content: 'Dashboard' }];

    const cleanup = definePageMeta({
      description: 'Overview page',
      meta,
    });

    expect(meta).toEqual([{ property: 'og:title', content: 'Dashboard' }]);

    cleanup();
  });
});

describe('platform/useAnnouncer', () => {
  it('creates a live region and announces messages', async () => {
    const { useAnnouncer } = await import('../src/platform/index');
    const announcer = useAnnouncer({ delay: 0, clearDelay: 0, id: `announcer-${Date.now()}` });

    announcer.announce('Saved');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(announcer.element?.getAttribute('aria-live')).toBe('polite');
    expect(announcer.element?.textContent).toBe('Saved');

    announcer.clear();
    expect(announcer.element?.textContent).toBe('');

    announcer.destroy();
    expect(document.getElementById(announcer.element?.id ?? '')).toBeNull();
  });

  it('disposes reactive updates when destroyed', async () => {
    const { useAnnouncer } = await import('../src/platform/index');
    const announcer = useAnnouncer({ delay: 0, clearDelay: 0, id: `announcer-destroy-${Date.now()}` });

    announcer.destroy();
    announcer.message.value = 'Should not render';

    expect(announcer.element?.textContent).toBe('');
    expect(document.getElementById(announcer.element?.id ?? '')).toBeNull();
  });
});

describe('platform/defineBqueryConfig', () => {
  it('merges nested config values', async () => {
    const { defineBqueryConfig, getBqueryConfig } = await import('../src/platform/index');

    defineBqueryConfig({
      fetch: { baseUrl: 'https://api.example.com' },
      components: { prefix: 'ui' },
    });

    const config = getBqueryConfig();
    expect(config.fetch?.baseUrl).toBe('https://api.example.com');
    expect(config.fetch?.parseAs).toBe('json');
    expect(config.components?.prefix).toBe('ui');
  });

  it('returns cloned transition arrays from config snapshots', async () => {
    const { defineBqueryConfig, getBqueryConfig } = await import('../src/platform/index');

    defineBqueryConfig({
      transitions: {
        classes: ['is-transitioning'],
        types: ['navigation'],
      },
    });

    const snapshot = getBqueryConfig();
    snapshot.transitions?.classes?.push('mutated');
    snapshot.transitions?.types?.push('other');

    const nextSnapshot = getBqueryConfig();
    expect(nextSnapshot.transitions?.classes).toEqual(['is-transitioning']);
    expect(nextSnapshot.transitions?.types).toEqual(['navigation']);
  });
});
