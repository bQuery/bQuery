import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { clearImageCache, loadImage, peekImage } from '../src/canvas';
import { installCanvasMock, uninstallCanvasMock } from './canvas-test-helpers';

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  crossOrigin: string | null = null;
  referrerPolicy: string | null = null;
  private _src = '';
  get src(): string {
    return this._src;
  }
  set src(value: string) {
    this._src = value;
    if (value === '') return;
    queueMicrotask(() => {
      if (value.startsWith('fail:')) {
        this.onerror?.();
      } else {
        this.onload?.();
      }
    });
  }
}

const originalImage = (globalThis as { Image?: typeof Image }).Image;

const installFakeImage = (): void => {
  (globalThis as { Image: typeof Image }).Image = FakeImage as unknown as typeof Image;
};

const restoreImage = (): void => {
  if (originalImage) (globalThis as { Image: typeof Image }).Image = originalImage;
  else delete (globalThis as { Image?: typeof Image }).Image;
};

describe('canvas loadImage', () => {
  beforeEach(() => {
    installCanvasMock();
    installFakeImage();
    clearImageCache();
  });
  afterEach(() => {
    restoreImage();
    uninstallCanvasMock();
  });

  test('rejects when src is not a string', async () => {
    await expect(loadImage('' as string)).rejects.toThrow(/non-empty string/);
  });

  test('resolves the loaded image', async () => {
    const img = await loadImage('/icon.png');
    expect(img).toBeDefined();
  });

  test('caches results across calls', async () => {
    const first = await loadImage('/same.png');
    expect(peekImage('/same.png')).toBe(first);
    const second = await loadImage('/same.png');
    expect(second).toBe(first);
  });

  test('rejects on error', async () => {
    await expect(loadImage('fail:/missing.png')).rejects.toThrow(/failed to load/);
  });

  test('aborts via AbortSignal', async () => {
    const controller = new AbortController();
    const promise = loadImage('/slow.png', { signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toThrow();
  });

  test('clearImageCache empties the cache', async () => {
    await loadImage('/a.png');
    expect(peekImage('/a.png')).toBeDefined();
    clearImageCache();
    expect(peekImage('/a.png')).toBeUndefined();
  });
});
