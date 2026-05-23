import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createCanvas } from '../src/canvas';
import {
  getMockContext,
  installCanvasMock,
  methodNames,
  uninstallCanvasMock,
} from './canvas-test-helpers';

describe('canvas drawing primitives', () => {
  beforeEach(() => installCanvasMock());
  afterEach(() => uninstallCanvasMock());

  test('clear() issues a transform reset and clearRect', () => {
    const canvas = createCanvas({ width: 100, height: 50 });
    canvas.clear();
    const names = methodNames(canvas.el);
    expect(names).toContain('save');
    expect(names).toContain('setTransform');
    expect(names).toContain('clearRect');
    expect(names).toContain('restore');
  });

  test('clear(color) draws a full-canvas fill rect', () => {
    const canvas = createCanvas({ width: 100, height: 50 });
    canvas.clear('white');
    const names = methodNames(canvas.el);
    expect(names).toContain('fillRect');
    const state = getMockContext(canvas.el)!.__state.state;
    expect(state.fillStyle).toBe('white');
  });

  test('rect with fill/stroke options issues fill and stroke', () => {
    const canvas = createCanvas();
    canvas.rect(10, 20, 30, 40, { fill: 'red', stroke: 'blue', lineWidth: 2 });
    const names = methodNames(canvas.el);
    expect(names).toContain('beginPath');
    expect(names).toContain('rect');
    expect(names).toContain('fill');
    expect(names).toContain('stroke');
    const state = getMockContext(canvas.el)!.__state.state;
    expect(state.fillStyle).toBe('red');
    expect(state.strokeStyle).toBe('blue');
    expect(state.lineWidth).toBe(2);
  });

  test('circle issues an arc with PI*2 sweep', () => {
    const canvas = createCanvas();
    canvas.circle(50, 60, 25, { fill: 'green' });
    const calls = getMockContext(canvas.el)!.__state.calls;
    const arcCall = calls.find(c => c.method === 'arc');
    expect(arcCall).toBeDefined();
    expect(arcCall!.args[0]).toBe(50);
    expect(arcCall!.args[1]).toBe(60);
    expect(arcCall!.args[2]).toBe(25);
    expect(arcCall!.args[4]).toBeCloseTo(Math.PI * 2);
  });

  test('line strokes a path between the two points', () => {
    const canvas = createCanvas();
    canvas.line(0, 0, 100, 100, { stroke: 'black' });
    const calls = getMockContext(canvas.el)!.__state.calls;
    const moveTo = calls.find(c => c.method === 'moveTo');
    const lineTo = calls.find(c => c.method === 'lineTo');
    expect(moveTo?.args).toEqual([0, 0]);
    expect(lineTo?.args).toEqual([100, 100]);
    expect(methodNames(canvas.el)).toContain('stroke');
  });

  test('polygon closes the path automatically', () => {
    const canvas = createCanvas();
    canvas.polygon(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 10 },
      ],
      { fill: 'red' }
    );
    const names = methodNames(canvas.el);
    expect(names).toContain('moveTo');
    expect(names.filter(n => n === 'lineTo').length).toBe(2);
    expect(names).toContain('closePath');
    expect(names).toContain('fill');
  });

  test('text() never interpolates HTML', () => {
    const canvas = createCanvas();
    canvas.text('<b>hi</b>', 5, 10, { fill: 'black', font: '14px sans-serif' });
    const calls = getMockContext(canvas.el)!.__state.calls;
    const fillText = calls.find(c => c.method === 'fillText');
    expect(fillText?.args[0]).toBe('<b>hi</b>');
  });

  test('style() batch-applies the supplied options', () => {
    const canvas = createCanvas();
    canvas.style({
      fill: '#fff',
      stroke: '#000',
      lineWidth: 4,
      lineCap: 'round',
      font: '12px serif',
      globalAlpha: 0.5,
      shadowBlur: 8,
    });
    const state = getMockContext(canvas.el)!.__state.state;
    expect(state.fillStyle).toBe('#fff');
    expect(state.strokeStyle).toBe('#000');
    expect(state.lineWidth).toBe(4);
    expect(state.lineCap).toBe('round');
    expect(state.font).toBe('12px serif');
    expect(state.globalAlpha).toBe(0.5);
    expect(state.shadowBlur).toBe(8);
  });

  test('transforms forward to the context', () => {
    const canvas = createCanvas();
    canvas.save().translate(10, 20).rotate(0.5).scale(2).restore();
    const names = methodNames(canvas.el);
    expect(names).toContain('save');
    expect(names).toContain('translate');
    expect(names).toContain('rotate');
    expect(names).toContain('scale');
    expect(names).toContain('restore');
  });

  test('path() builds and draws a Path2D', () => {
    const canvas = createCanvas();
    canvas.path(
      p => {
        p.moveTo(0, 0).lineTo(10, 0).lineTo(0, 10).closePath();
      },
      { fill: 'red' }
    );
    expect(methodNames(canvas.el)).toContain('fill');
  });
});
