import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  clearMeasureCache,
  createCanvas,
  measureText,
  offscreen,
  pickPixel,
  toBlob,
  toDataURL,
} from '../src/canvas';
import { installCanvasMock, uninstallCanvasMock } from './canvas-test-helpers';

describe('canvas util helpers', () => {
  beforeEach(() => {
    installCanvasMock();
    clearMeasureCache();
  });
  afterEach(() => uninstallCanvasMock());

  test('toBlob wraps callback into a promise', async () => {
    const canvas = createCanvas({ width: 10, height: 10 });
    const blob = await toBlob(canvas);
    expect(blob).toBeDefined();
    expect(typeof (blob as Blob).size).toBe('number');
  });

  test('toDataURL delegates to the underlying canvas', () => {
    const canvas = createCanvas({ width: 10, height: 10 });
    const url = toDataURL(canvas);
    expect(typeof url).toBe('string');
    expect(url.startsWith('data:')).toBe(true);
  });

  test('pickPixel returns an RGBA object', () => {
    const canvas = createCanvas({ width: 10, height: 10 });
    const pixel = pickPixel(canvas, 0, 0);
    expect(pixel).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  test('measureText caches results per font + text', () => {
    const canvas = createCanvas();
    const first = measureText(canvas.ctx, 'hello', '14px serif');
    const second = measureText(canvas.ctx, 'hello', '14px serif');
    expect(first).toBe(second);
  });

  test('offscreen returns a canvas-like element', () => {
    const o = offscreen(50, 30);
    expect(o).toBeDefined();
    expect(o.width).toBe(50);
    expect(o.height).toBe(30);
  });
});
