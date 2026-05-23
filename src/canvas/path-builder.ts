/**
 * Fluent path builder used by `BQueryCanvas#path()` and scene `PathNode`.
 *
 * Builds a standalone `Path2D` so the same instance can be re-applied via
 * `ctx.fill(path)` / `ctx.stroke(path)` / `ctx.isPointInPath(path, x, y)`.
 *
 * @module bquery/canvas
 */

import type { PathBuilder } from './types';

const hasPath2D = (): boolean => typeof Path2D !== 'undefined';

/**
 * Create a new {@link PathBuilder}. The builder collects path commands into a
 * `Path2D` instance (or a lightweight fallback when `Path2D` is unavailable in
 * the runtime), then exposes it via {@link PathBuilder.toPath2D}.
 *
 * @example
 * ```ts
 * import { createPathBuilder } from '@bquery/bquery/canvas';
 *
 * const builder = createPathBuilder();
 * builder.moveTo(10, 10).lineTo(50, 10).lineTo(30, 50).closePath();
 * const path = builder.toPath2D();
 * ctx.fill(path);
 * ```
 */
export const createPathBuilder = (): PathBuilder => {
  const path: Path2D = hasPath2D() ? new Path2D() : (createPath2DFallback() as Path2D);

  const builder: PathBuilder = {
    moveTo(x, y) {
      path.moveTo(x, y);
      return builder;
    },
    lineTo(x, y) {
      path.lineTo(x, y);
      return builder;
    },
    rect(x, y, w, h) {
      path.rect(x, y, w, h);
      return builder;
    },
    arc(x, y, r, startAngle, endAngle, ccw) {
      path.arc(x, y, r, startAngle, endAngle, ccw);
      return builder;
    },
    ellipse(x, y, rx, ry, rotation, startAngle, endAngle, ccw) {
      path.ellipse(x, y, rx, ry, rotation, startAngle, endAngle, ccw);
      return builder;
    },
    quadraticCurveTo(cpx, cpy, x, y) {
      path.quadraticCurveTo(cpx, cpy, x, y);
      return builder;
    },
    bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {
      path.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
      return builder;
    },
    closePath() {
      path.closePath();
      return builder;
    },
    toPath2D() {
      return path;
    },
  };

  return builder;
};

/**
 * Minimal no-op fallback used when `Path2D` is unavailable. Drawing operations
 * silently no-op so that SSR-time imports do not throw and so user code does
 * not need feature checks.
 *
 * @internal
 */
const createPath2DFallback = (): unknown => ({
  moveTo() {},
  lineTo() {},
  rect() {},
  arc() {},
  ellipse() {},
  quadraticCurveTo() {},
  bezierCurveTo() {},
  closePath() {},
  addPath() {},
  arcTo() {},
});
