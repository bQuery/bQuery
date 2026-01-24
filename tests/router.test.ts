/**
 * Router module tests
 *
 * Note: Router tests require a full browser environment with History API.
 * These tests are skipped in happy-dom as it doesn't fully implement history.
 */

import { describe, expect, it } from 'bun:test';

// Router requires full browser History API which happy-dom doesn't fully support
// We test the pure functions only

describe('Router', () => {
  describe('module exports', () => {
    it('should export createRouter', async () => {
      const mod = await import('../src/router/index');
      expect(typeof mod.createRouter).toBe('function');
    });

    it('should export navigate', async () => {
      const mod = await import('../src/router/index');
      expect(typeof mod.navigate).toBe('function');
    });

    it('should export back and forward', async () => {
      const mod = await import('../src/router/index');
      expect(typeof mod.back).toBe('function');
      expect(typeof mod.forward).toBe('function');
    });

    it('should export resolve', async () => {
      const mod = await import('../src/router/index');
      expect(typeof mod.resolve).toBe('function');
    });

    it('should export isActive and isActiveSignal', async () => {
      const mod = await import('../src/router/index');
      expect(typeof mod.isActive).toBe('function');
      expect(typeof mod.isActiveSignal).toBe('function');
    });

    it('should export link and interceptLinks', async () => {
      const mod = await import('../src/router/index');
      expect(typeof mod.link).toBe('function');
      expect(typeof mod.interceptLinks).toBe('function');
    });

    it('should export currentRoute signal', async () => {
      const mod = await import('../src/router/index');
      expect(mod.currentRoute).toBeDefined();
      expect(typeof mod.currentRoute.value).toBe('object');
    });
  });
});
