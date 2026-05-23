/**
 * Utility helpers for the canvas module.
 *
 * @module bquery/canvas
 */

import { Signal, signal } from '../../reactive/index';
import type { BQueryCanvas } from '../bquery-canvas';
import { hasHTMLCanvasElement, hasOffscreenCanvas } from '../internal/env';
import type { RGBA, SnapshotOptions } from '../types';

/**
 * Promise-based wrapper around `HTMLCanvasElement.toBlob`. Rejects when
 * `toBlob` returns `null` (e.g. when the canvas is empty or unsupported).
 */
export const toBlob = (
  canvas: HTMLCanvasElement | BQueryCanvas,
  options?: SnapshotOptions
): Promise<Blob> => {
  const el = canvas instanceof HTMLCanvasElement ? canvas : canvas.el;
  return new Promise<Blob>((resolve, reject) => {
    el.toBlob(
      blob => {
        if (blob) resolve(blob);
        else reject(new Error('bQuery canvas: toBlob returned null.'));
      },
      options?.type,
      options?.quality
    );
  });
};

/** Synchronous wrapper around `HTMLCanvasElement.toDataURL`. */
export const toDataURL = (
  canvas: HTMLCanvasElement | BQueryCanvas,
  options?: SnapshotOptions
): string => {
  const el = canvas instanceof HTMLCanvasElement ? canvas : canvas.el;
  return el.toDataURL(options?.type, options?.quality);
};

/** Read the RGBA color of a single pixel at the given canvas coordinates. */
export const pickPixel = (
  canvas: HTMLCanvasElement | BQueryCanvas,
  x: number,
  y: number
): RGBA => {
  const ctx =
    canvas instanceof HTMLCanvasElement
      ? canvas.getContext('2d')
      : canvas.ctx;
  if (!ctx) {
    throw new Error('bQuery canvas: pickPixel could not acquire a 2D context.');
  }
  const data = ctx.getImageData(x, y, 1, 1).data;
  return {
    r: data[0] ?? 0,
    g: data[1] ?? 0,
    b: data[2] ?? 0,
    a: data[3] ?? 0,
  };
};

const measureCache = new Map<string, TextMetrics>();

/**
 * Measure text with a small LRU-style cache keyed by `font + text`. Helpful
 * when repeatedly laying out the same labels per frame.
 */
export const measureText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  font?: string
): TextMetrics => {
  const effectiveFont = font ?? ctx.font;
  const key = `${effectiveFont}::${text}`;
  const cached = measureCache.get(key);
  if (cached) return cached;
  const previousFont = ctx.font;
  if (font !== undefined) ctx.font = font;
  const metrics = ctx.measureText(text);
  if (font !== undefined) ctx.font = previousFont;
  measureCache.set(key, metrics);
  if (measureCache.size > 512) {
    // Trim oldest entry.
    const firstKey = measureCache.keys().next().value;
    if (firstKey !== undefined) measureCache.delete(firstKey);
  }
  return metrics;
};

/** Clear the {@link measureText} cache. */
export const clearMeasureCache = (): void => {
  measureCache.clear();
};

/**
 * Create an offscreen canvas. Uses `OffscreenCanvas` when available and falls
 * back to a detached `<canvas>` element otherwise. Both fallbacks expose a
 * `getContext('2d')` method.
 */
export const offscreen = (
  width: number,
  height: number
): OffscreenCanvas | HTMLCanvasElement => {
  if (hasOffscreenCanvas()) {
    return new OffscreenCanvas(Math.max(0, width), Math.max(0, height));
  }
  if (!hasHTMLCanvasElement() || typeof document === 'undefined') {
    throw new Error('bQuery canvas: offscreen() requires a browser-like environment.');
  }
  const el = document.createElement('canvas');
  el.width = Math.max(0, width);
  el.height = Math.max(0, height);
  return el;
};

/**
 * Wrap an `ImageData` snapshot of a canvas in a reactive signal. Call the
 * returned `refresh()` to re-sample the canvas; the signal then notifies all
 * subscribers.
 */
export const imageDataSignal = (
  canvas: BQueryCanvas
): Signal<ImageData> & { refresh: () => void } => {
  const sample = (): ImageData =>
    canvas.ctx.getImageData(0, 0, canvas.el.width, canvas.el.height);
  const s = signal<ImageData>(sample());
  (s as Signal<ImageData> & { refresh: () => void }).refresh = (): void => {
    s.value = sample();
  };
  return s as Signal<ImageData> & { refresh: () => void };
};
