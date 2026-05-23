import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createCanvas } from '../src/canvas';
import { installCanvasMock, uninstallCanvasMock } from './canvas-test-helpers';

describe('canvas disposal', () => {
  beforeEach(() => installCanvasMock());
  afterEach(() => uninstallCanvasMock());

  test('dispose() removes registered listeners', () => {
    const canvas = createCanvas();
    let calls = 0;
    canvas.on('pointermove', () => {
      calls += 1;
    });
    canvas.el.dispatchEvent(new Event('pointermove'));
    expect(calls).toBe(1);
    canvas.dispose();
    canvas.el.dispatchEvent(new Event('pointermove'));
    expect(calls).toBe(1);
    expect(canvas.disposed).toBe(true);
  });

  test('dispose() stops active render handles', () => {
    const canvas = createCanvas();
    let runs = 0;
    const handle = canvas.render(() => {
      runs += 1;
    });
    expect(runs).toBe(1);
    canvas.dispose();
    expect(handle.disposed).toBe(true);
  });

  test('dispose() is idempotent', () => {
    const canvas = createCanvas();
    canvas.dispose();
    canvas.dispose();
    expect(canvas.disposed).toBe(true);
  });

  test('off(type) removes all listeners for that event type', () => {
    const canvas = createCanvas();
    let calls = 0;
    canvas.on('pointerdown', () => {
      calls += 1;
    });
    canvas.off('pointerdown');
    canvas.el.dispatchEvent(new Event('pointerdown'));
    expect(calls).toBe(0);
  });
});

describe('canvas events', () => {
  beforeEach(() => installCanvasMock());
  afterEach(() => uninstallCanvasMock());

  test('once() fires exactly one time', () => {
    const canvas = createCanvas();
    let calls = 0;
    canvas.once('click', () => {
      calls += 1;
    });
    canvas.el.dispatchEvent(new Event('click'));
    canvas.el.dispatchEvent(new Event('click'));
    expect(calls).toBe(1);
  });
});
