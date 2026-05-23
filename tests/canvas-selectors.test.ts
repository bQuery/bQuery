import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  $canvas,
  $$canvas,
  BQueryCanvas,
  BQueryCanvasCollection,
  createCanvas,
} from '../src/canvas';
import { installCanvasMock, uninstallCanvasMock } from './canvas-test-helpers';

describe('canvas selectors', () => {
  beforeEach(() => installCanvasMock());
  afterEach(() => {
    uninstallCanvasMock();
    document.body.innerHTML = '';
  });

  test('$canvas wraps an existing canvas element', () => {
    const el = document.createElement('canvas');
    el.id = 'stage';
    document.body.appendChild(el);
    const canvas = $canvas('#stage');
    expect(canvas).toBeInstanceOf(BQueryCanvas);
    expect(canvas.el).toBe(el);
  });

  test('$canvas accepts a direct HTMLCanvasElement', () => {
    const el = document.createElement('canvas');
    const canvas = $canvas(el);
    expect(canvas.el).toBe(el);
  });

  test('$canvas throws when the selector misses', () => {
    expect(() => $canvas('#missing')).toThrow(/element not found/);
  });

  test('$canvas throws when the matched element is not a canvas', () => {
    const div = document.createElement('div');
    div.id = 'not-a-canvas';
    document.body.appendChild(div);
    expect(() => $canvas('#not-a-canvas')).toThrow(/is not a <canvas>/);
  });

  test('$$canvas returns an empty collection when nothing matches', () => {
    const collection = $$canvas('canvas.does-not-exist');
    expect(collection).toBeInstanceOf(BQueryCanvasCollection);
    expect(collection.size()).toBe(0);
    expect(collection.first()).toBeUndefined();
  });

  test('$$canvas wraps every matching canvas', () => {
    document.body.appendChild(document.createElement('canvas'));
    document.body.appendChild(document.createElement('canvas'));
    const collection = $$canvas('canvas');
    expect(collection.size()).toBe(2);
    const counts: number[] = [];
    collection.each((_canvas, idx) => counts.push(idx));
    expect(counts).toEqual([0, 1]);
  });

  test('createCanvas returns a detached canvas with default size', () => {
    const canvas = createCanvas();
    expect(canvas.el.parentNode).toBeNull();
    expect(canvas.size()).toEqual({ width: 300, height: 150 });
  });

  test('createCanvas honors options and supports appendTo', () => {
    const canvas = createCanvas({ width: 200, height: 100, ariaLabel: 'chart' });
    document.body.appendChild(document.createElement('div'));
    canvas.appendTo(document.body);
    expect(canvas.el.parentNode).toBe(document.body);
    expect(canvas.el.getAttribute('aria-label')).toBe('chart');
    expect(canvas.size()).toEqual({ width: 200, height: 100 });
  });
});
