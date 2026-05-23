/**
 * Collection wrapper for multiple `<canvas>` elements. Mirrors the surface of
 * `BQueryCollection` for parity with the core selector API.
 *
 * @module bquery/canvas
 */

import { BQueryCanvas } from './bquery-canvas';
import type { CanvasPaint, CanvasRenderOptions, RenderFn, RenderHandle } from './types';

/** Wrapper for a list of `BQueryCanvas` instances. */
export class BQueryCanvasCollection {
  private readonly canvases: BQueryCanvas[];

  constructor(canvases: BQueryCanvas[]) {
    this.canvases = [...canvases];
  }

  /** Number of canvases in the collection. */
  size(): number {
    return this.canvases.length;
  }

  /** First canvas or `undefined` if empty. */
  first(): BQueryCanvas | undefined {
    return this.canvases[0];
  }

  /** Last canvas or `undefined` if empty. */
  last(): BQueryCanvas | undefined {
    return this.canvases[this.canvases.length - 1];
  }

  /** Iterate over each canvas. */
  each(fn: (canvas: BQueryCanvas, index: number) => void): this {
    for (let i = 0; i < this.canvases.length; i++) fn(this.canvases[i]!, i);
    return this;
  }

  /** Map over the collection. */
  map<T>(fn: (canvas: BQueryCanvas, index: number) => T): T[] {
    return this.canvases.map(fn);
  }

  /** Native iterator protocol. */
  [Symbol.iterator](): IterableIterator<BQueryCanvas> {
    return this.canvases[Symbol.iterator]();
  }

  // ── broadcast helpers ───────────────────────────────────────────────────

  /** Clear every canvas in the collection. */
  clear(color?: CanvasPaint): this {
    for (const canvas of this.canvases) canvas.clear(color);
    return this;
  }

  /** Register the same render function on every canvas. */
  render(fn: RenderFn, options?: CanvasRenderOptions): RenderHandle[] {
    return this.canvases.map(canvas => canvas.render(fn, options));
  }

  /** Dispose every canvas wrapper in the collection. */
  dispose(): void {
    for (const canvas of this.canvases) canvas.dispose();
  }
}
