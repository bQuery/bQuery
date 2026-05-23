/**
 * Canvas-specific selectors. Parallel surface to `$()` / `$$()` from
 * `@bquery/bquery/core`, but specialized for `<canvas>` and returning the
 * canvas wrapper types.
 *
 * @module bquery/canvas
 */

import { BQueryCanvas } from './bquery-canvas';
import { BQueryCanvasCollection } from './bquery-canvas-collection';
import { getDocument, hasHTMLCanvasElement } from './internal/env';
import type { CreateCanvasOptions } from './types';

const isCanvas = (value: unknown): value is HTMLCanvasElement => {
  return hasHTMLCanvasElement() && value instanceof HTMLCanvasElement;
};

/**
 * Select a single `<canvas>` element. Throws when the target is missing or
 * the matched element is not a canvas (parallels `$()` from
 * `@bquery/bquery/core`).
 *
 * @example
 * ```ts
 * import { $canvas } from '@bquery/bquery/canvas';
 *
 * const canvas = $canvas('#stage');
 * canvas.size(400, 300).clear('white').rect(10, 10, 80, 80, { fill: 'red' });
 * ```
 */
export const $canvas = (target: string | HTMLCanvasElement): BQueryCanvas => {
  if (isCanvas(target)) {
    return new BQueryCanvas(target);
  }
  if (typeof target !== 'string') {
    throw new TypeError('bQuery canvas: $canvas requires a CSS selector string or HTMLCanvasElement.');
  }
  const doc = getDocument();
  const element = doc.querySelector(target);
  if (!element) {
    throw new Error(`bQuery canvas: element not found for selector "${target}".`);
  }
  if (!isCanvas(element)) {
    throw new TypeError(
      `bQuery canvas: element matched by "${target}" is not a <canvas> (found <${element.tagName.toLowerCase()}>).`
    );
  }
  return new BQueryCanvas(element);
};

/**
 * Select zero or more `<canvas>` elements. Never throws — returns an empty
 * collection when no canvases match.
 *
 * @example
 * ```ts
 * import { $$canvas } from '@bquery/bquery/canvas';
 *
 * $$canvas('canvas.chart').each(c => c.clear('white'));
 * ```
 */
export const $$canvas = (
  target: string | HTMLCanvasElement[] | NodeListOf<HTMLCanvasElement>
): BQueryCanvasCollection => {
  if (Array.isArray(target)) {
    return new BQueryCanvasCollection(target.filter(isCanvas).map(el => new BQueryCanvas(el)));
  }
  if (typeof target !== 'string') {
    const list = Array.from(target as NodeListOf<HTMLCanvasElement>).filter(isCanvas);
    return new BQueryCanvasCollection(list.map(el => new BQueryCanvas(el)));
  }
  const doc = getDocument();
  const matches = Array.from(doc.querySelectorAll(target)).filter(isCanvas);
  return new BQueryCanvasCollection(matches.map(el => new BQueryCanvas(el)));
};

/**
 * Create a detached `<canvas>` and return its wrapper. The element is not
 * mounted into the DOM until you call `.appendTo(parent)`.
 *
 * @example
 * ```ts
 * import { createCanvas } from '@bquery/bquery/canvas';
 *
 * const canvas = createCanvas({ width: 400, height: 300, ariaLabel: 'chart' });
 * canvas.appendTo('#chart-host');
 * ```
 */
export const createCanvas = (options: CreateCanvasOptions = {}): BQueryCanvas => {
  if (!hasHTMLCanvasElement()) {
    throw new Error(
      'bQuery canvas: HTMLCanvasElement is unavailable in this environment. ' +
        'createCanvas() can only be called inside a browser-like runtime.'
    );
  }
  const doc = getDocument(options.ownerDocument);
  const el = doc.createElement('canvas') as HTMLCanvasElement;
  if (options.className) el.className = options.className;
  if (options.ariaLabel) el.setAttribute('aria-label', options.ariaLabel);
  const wrapper = new BQueryCanvas(el, options.dpr);
  wrapper.size(options.width ?? 300, options.height ?? 150);
  if (options.dpr !== undefined) wrapper.setDpr(options.dpr);
  return wrapper;
};
