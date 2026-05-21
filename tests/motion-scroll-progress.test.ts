import { describe, expect, it } from 'bun:test';
import { inView, scrollProgress } from '../src/motion/scroll-progress';

const setupElement = (top: number, height: number): Element => {
  const el = document.createElement('div');
  el.getBoundingClientRect = () =>
    ({
      top,
      left: 0,
      right: 100,
      bottom: top + height,
      width: 100,
      height,
      x: 0,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect;
  return el;
};

describe('motion/scrollProgress', () => {
  it('produces a value in [0, 1] on the initial sample', () => {
    const el = setupElement(200, 100);
    let last = -1;
    const cleanup = scrollProgress(el, { onProgress: (p) => (last = p) });
    expect(last).toBeGreaterThanOrEqual(0);
    expect(last).toBeLessThanOrEqual(1);
    cleanup();
  });

  it('reports 0 when the element sits well below the viewport', () => {
    // viewport ~= happy-dom default; place element below it.
    const el = setupElement(window.innerHeight + 500, 100);
    let last = -1;
    const cleanup = scrollProgress(el, { onProgress: (p) => (last = p) });
    // traveled = viewport - top → strongly negative → clamped to 0
    expect(last).toBe(0);
    cleanup();
  });

  it('cleanup detaches listeners and observers', () => {
    const el = setupElement(50, 100);
    const cleanup = scrollProgress(el, { onProgress: () => {} });
    expect(() => cleanup()).not.toThrow();
    // Idempotent
    expect(() => cleanup()).not.toThrow();
  });

  it('uses ownerDocument when window.innerHeight is unavailable and global document is missing', () => {
    const originalWindowHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
    const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    const el = {
      ownerDocument: {
        documentElement: { clientHeight: 200 },
      },
      getBoundingClientRect: () =>
        ({
          top: 50,
          left: 0,
          right: 100,
          bottom: 150,
          width: 100,
          height: 100,
          x: 0,
          y: 50,
          toJSON: () => ({}),
        }) as DOMRect,
    } as unknown as Element;
    let last = -1;

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 0 });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: undefined });

    try {
      const cleanup = scrollProgress(el, { onProgress: (progress) => (last = progress) });
      expect(last).toBe(0.5);
      cleanup();
    } finally {
      if (originalWindowHeight) {
        Object.defineProperty(window, 'innerHeight', originalWindowHeight);
      }
      if (originalDocument) {
        Object.defineProperty(globalThis, 'document', originalDocument);
      }
    }
  });
});

describe('motion/inView', () => {
  it('resolves immediately in DOM-less environments (when IntersectionObserver is missing)', async () => {
    const originalIO = (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = undefined;
    try {
      const el = document.createElement('div');
      await inView(el);
      // Pass: no timeout
      expect(true).toBe(true);
    } finally {
      (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = originalIO;
    }
  });

  it('cancel() is safe to call multiple times', () => {
    const el = document.createElement('div');
    const handle = inView(el);
    handle.cancel();
    expect(() => handle.cancel()).not.toThrow();
  });

  it('cancel() resolves awaiting callers before the first intersection', async () => {
    let disconnectCalls = 0;
    class MockIO {
      observe() {}
      disconnect() {
        disconnectCalls += 1;
      }
      unobserve() {}
    }
    const original = (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = MockIO;
    try {
      const el = document.createElement('div');
      const handle = inView(el);
      const awaited = Promise.resolve(handle);
      handle.cancel();
      await awaited;
      expect(disconnectCalls).toBe(1);
    } finally {
      (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = original;
    }
  });

  it('invokes onChange when an entry transitions to intersecting', async () => {
    // Mock IntersectionObserver for this test.
    let captured: ((entries: IntersectionObserverEntry[]) => void) | undefined;
    class MockIO {
      callback: (entries: IntersectionObserverEntry[]) => void;
      constructor(cb: (entries: IntersectionObserverEntry[]) => void) {
        this.callback = cb;
        captured = cb;
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    }
    const original = (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = MockIO;
    try {
      const el = document.createElement('div');
      const changes: boolean[] = [];
      const handle = inView(el, { onChange: (entered) => changes.push(entered) });
      // Simulate an entry.
      if (!captured) throw new Error('IntersectionObserver callback was not captured');
      captured([
        {
          target: el,
          isIntersecting: true,
        } as unknown as IntersectionObserverEntry,
      ]);
      await handle;
      expect(changes).toContain(true);
      handle.cancel();
    } finally {
      (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = original;
    }
  });
});
