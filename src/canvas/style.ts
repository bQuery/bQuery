/**
 * Batch style applicator and per-call style helpers for the 2D context.
 *
 * @internal
 */

import type { DrawOptions, StyleOptions } from './types';

export const applyStyleOptions = (
  ctx: CanvasRenderingContext2D,
  options: StyleOptions
): void => {
  if (options.fill !== undefined && options.fill !== null) ctx.fillStyle = options.fill;
  if (options.stroke !== undefined && options.stroke !== null) ctx.strokeStyle = options.stroke;
  if (options.lineWidth !== undefined) ctx.lineWidth = options.lineWidth;
  if (options.lineCap !== undefined) ctx.lineCap = options.lineCap;
  if (options.lineJoin !== undefined) ctx.lineJoin = options.lineJoin;
  if (options.miterLimit !== undefined) ctx.miterLimit = options.miterLimit;
  if (options.lineDash !== undefined && typeof ctx.setLineDash === 'function') {
    ctx.setLineDash(options.lineDash);
  }
  if (options.font !== undefined) ctx.font = options.font;
  if (options.textAlign !== undefined) ctx.textAlign = options.textAlign;
  if (options.textBaseline !== undefined) ctx.textBaseline = options.textBaseline;
  if (options.globalAlpha !== undefined) ctx.globalAlpha = options.globalAlpha;
  if (options.globalCompositeOperation !== undefined) {
    ctx.globalCompositeOperation = options.globalCompositeOperation;
  }
  if (options.shadowBlur !== undefined) ctx.shadowBlur = options.shadowBlur;
  if (options.shadowColor !== undefined) ctx.shadowColor = options.shadowColor;
  if (options.shadowOffsetX !== undefined) ctx.shadowOffsetX = options.shadowOffsetX;
  if (options.shadowOffsetY !== undefined) ctx.shadowOffsetY = options.shadowOffsetY;
};

/**
 * Apply per-call draw options, save/restoring the relevant context state so
 * subsequent draws are unaffected. Returns true when a fill should be issued
 * and true when a stroke should be issued.
 */
export const applyDrawOptions = (
  ctx: CanvasRenderingContext2D,
  options: DrawOptions | undefined
): { fill: boolean; stroke: boolean } => {
  if (!options) return { fill: false, stroke: false };

  if (options.fill !== undefined && options.fill !== null) ctx.fillStyle = options.fill;
  if (options.stroke !== undefined && options.stroke !== null) ctx.strokeStyle = options.stroke;
  if (options.lineWidth !== undefined) ctx.lineWidth = options.lineWidth;
  if (options.lineCap !== undefined) ctx.lineCap = options.lineCap;
  if (options.lineJoin !== undefined) ctx.lineJoin = options.lineJoin;
  if (options.alpha !== undefined) ctx.globalAlpha = options.alpha;
  if (options.lineDash !== undefined && typeof ctx.setLineDash === 'function') {
    ctx.setLineDash(options.lineDash);
  }

  return {
    fill: options.fill !== undefined && options.fill !== null,
    stroke: options.stroke !== undefined && options.stroke !== null,
  };
};
