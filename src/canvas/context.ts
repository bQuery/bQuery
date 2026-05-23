/**
 * DPR / sizing utilities for the canvas module.
 *
 * Encapsulates the math required to keep CSS pixel dimensions and the
 * backing-store dimensions in sync without callers writing manual
 * `devicePixelRatio` arithmetic.
 *
 * @internal
 */

import { getDevicePixelRatio } from './internal/env';

export interface CanvasSizeState {
  width: number;
  height: number;
  dpr: number;
}

/**
 * Apply the supplied CSS pixel size and device pixel ratio to a canvas
 * element. Updates both the backing store (`width`/`height` attributes) and
 * the CSS-level `style.width`/`style.height`, then scales the 2D context so
 * authoring code can keep working in CSS pixels.
 */
export const applyCanvasSize = (
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D | null,
  width: number,
  height: number,
  dpr: number
): CanvasSizeState => {
  const safeDpr = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  const safeWidth = Math.max(0, Math.floor(width));
  const safeHeight = Math.max(0, Math.floor(height));

  const backingWidth = Math.max(0, Math.floor(safeWidth * safeDpr));
  const backingHeight = Math.max(0, Math.floor(safeHeight * safeDpr));

  if (canvas.width !== backingWidth) canvas.width = backingWidth;
  if (canvas.height !== backingHeight) canvas.height = backingHeight;

  // Match CSS pixel size for layout consistency. Skip when there is no style
  // (e.g. OffscreenCanvas does not expose `style`).
  const styled = canvas as HTMLCanvasElement & { style?: CSSStyleDeclaration };
  if (styled.style) {
    styled.style.width = `${safeWidth}px`;
    styled.style.height = `${safeHeight}px`;
  }

  // Scale the context so authors keep drawing in CSS pixels.
  if (ctx && typeof ctx.setTransform === 'function') {
    ctx.setTransform(safeDpr, 0, 0, safeDpr, 0, 0);
  }

  return { width: safeWidth, height: safeHeight, dpr: safeDpr };
};

/** Resolve the effective DPR to use given an optional override. */
export const resolveDpr = (override?: number): number => {
  if (typeof override === 'number' && override > 0 && Number.isFinite(override)) {
    return override;
  }
  return getDevicePixelRatio();
};
