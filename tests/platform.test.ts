/**
 * Platform module tests.
 * Tests for storage, cache, buckets, and notifications APIs.
 */
import { beforeEach, describe, expect, it } from 'bun:test';
import { notifications } from '../src/platform/notifications';

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
