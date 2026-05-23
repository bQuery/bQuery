import { describe, expect, test } from 'bun:test';

/**
 * Verify that the canvas module imports cleanly in an SSR-like environment
 * with no DOM globals. We tear down the DOM globals from `tests/setup.ts`
 * before importing the module to simulate Node SSR.
 */
describe('canvas SSR import safety', () => {
  test('module imports without throwing when DOM is absent', async () => {
    const originalDocument = (globalThis as { document?: unknown }).document;
    const originalWindow = (globalThis as { window?: unknown }).window;
    const originalHTMLCanvasElement = (globalThis as { HTMLCanvasElement?: unknown })
      .HTMLCanvasElement;
    try {
      delete (globalThis as { document?: unknown }).document;
      delete (globalThis as { window?: unknown }).window;
      delete (globalThis as { HTMLCanvasElement?: unknown }).HTMLCanvasElement;
      // Use a fresh import via cache-busting query.
      const mod = await import(`../src/canvas/index?ssr=${Date.now()}`);
      expect(typeof mod.createCanvas).toBe('function');
      expect(typeof mod.$canvas).toBe('function');
      expect(typeof mod.createScene).toBe('function');
      // createCanvas should throw with a clear, actionable error in SSR.
      expect(() => mod.createCanvas()).toThrow();
    } finally {
      if (originalDocument !== undefined) (globalThis as { document: unknown }).document = originalDocument;
      if (originalWindow !== undefined) (globalThis as { window: unknown }).window = originalWindow;
      if (originalHTMLCanvasElement !== undefined) {
        (globalThis as { HTMLCanvasElement: unknown }).HTMLCanvasElement = originalHTMLCanvasElement;
      }
    }
  });
});
