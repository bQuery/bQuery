import { describe, expect, test } from 'bun:test';
import { createPathBuilder } from '../src/canvas';

describe('canvas path builder', () => {
  test('chains commands fluently and returns a path object', () => {
    const p = createPathBuilder();
    const out = p.moveTo(0, 0).lineTo(10, 0).lineTo(10, 10).closePath();
    expect(out).toBe(p);
    const path = p.toPath2D();
    expect(path).toBeDefined();
  });

  test('supports curves, arcs, and ellipses', () => {
    const p = createPathBuilder();
    p.moveTo(0, 0)
      .quadraticCurveTo(5, 5, 10, 0)
      .bezierCurveTo(15, 0, 20, 5, 25, 0)
      .arc(30, 0, 5, 0, Math.PI * 2)
      .ellipse(40, 0, 5, 3, 0, 0, Math.PI * 2);
    const path = p.toPath2D();
    expect(path).toBeDefined();
  });
});
