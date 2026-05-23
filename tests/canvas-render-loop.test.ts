import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { signal } from '../src/reactive';
import { createCanvas } from '../src/canvas';
import { __setPrefersReducedMotionImpl } from '../src/canvas/bquery-canvas';
import { installCanvasMock, methodNames, uninstallCanvasMock } from './canvas-test-helpers';

describe('canvas render loop', () => {
  beforeEach(() => installCanvasMock());
  afterEach(() => {
    uninstallCanvasMock();
    __setPrefersReducedMotionImpl(undefined);
  });

  test('render() runs immediately when registered', () => {
    const canvas = createCanvas();
    let runs = 0;
    canvas.render(() => {
      runs += 1;
    });
    expect(runs).toBe(1);
  });

  test('render() re-runs when a tracked signal changes', () => {
    const canvas = createCanvas();
    const count = signal(0);
    let runs = 0;
    canvas.render(() => {
      void count.value;
      runs += 1;
    });
    expect(runs).toBe(1);
    count.value = 1;
    expect(runs).toBe(2);
    count.value = 2;
    expect(runs).toBe(3);
  });

  test('render() with reactive:false does not subscribe', () => {
    const canvas = createCanvas();
    const count = signal(0);
    let runs = 0;
    canvas.render(
      () => {
        void count.value;
        runs += 1;
      },
      { reactive: false }
    );
    expect(runs).toBe(1);
    count.value = 1;
    expect(runs).toBe(1);
  });

  test('pause/resume controls re-runs', () => {
    const canvas = createCanvas();
    const count = signal(0);
    let runs = 0;
    const handle = canvas.render(() => {
      void count.value;
      runs += 1;
    });
    expect(runs).toBe(1);
    handle.pause();
    count.value = 1;
    expect(runs).toBe(1);
    handle.resume();
    expect(runs).toBe(2);
  });

  test('dispose() stops further re-runs', () => {
    const canvas = createCanvas();
    const count = signal(0);
    let runs = 0;
    const handle = canvas.render(() => {
      void count.value;
      runs += 1;
    });
    expect(runs).toBe(1);
    handle.dispose();
    expect(handle.disposed).toBe(true);
    count.value = 1;
    expect(runs).toBe(1);
  });

  test('clearEachFrame defaults to true', () => {
    const canvas = createCanvas();
    canvas.render(ctx => {
      void ctx;
    });
    // clear() pushes save/setTransform/clearRect/restore at the start.
    expect(methodNames(canvas.el)).toContain('clearRect');
  });

  test('clearEachFrame:false skips the clear step', () => {
    const canvas = createCanvas();
    const before = methodNames(canvas.el).filter(n => n === 'clearRect').length;
    canvas.render(
      ctx => {
        void ctx;
      },
      { clearEachFrame: false }
    );
    const after = methodNames(canvas.el).filter(n => n === 'clearRect').length;
    expect(after).toBe(before);
  });
});

describe('canvas frame loop', () => {
  beforeEach(() => installCanvasMock());
  afterEach(() => {
    uninstallCanvasMock();
    __setPrefersReducedMotionImpl(undefined);
  });

  test('frame() schedules a RAF loop and dispose() stops it', async () => {
    const canvas = createCanvas();
    let frames = 0;
    const handle = canvas.frame(() => {
      frames += 1;
    });
    await new Promise(resolve => setTimeout(resolve, 80));
    expect(frames).toBeGreaterThan(0);
    const captured = frames;
    handle.dispose();
    await new Promise(resolve => setTimeout(resolve, 80));
    expect(frames - captured).toBeLessThanOrEqual(1);
    expect(handle.disposed).toBe(true);
  });

  test('frame() respects prefersReducedMotion', async () => {
    __setPrefersReducedMotionImpl(() => true);
    const canvas = createCanvas();
    let frames = 0;
    const handle = canvas.frame(() => {
      frames += 1;
    });
    await new Promise(resolve => setTimeout(resolve, 80));
    expect(frames).toBe(0);
    handle.dispose();
  });

  test('frame() with respectReducedMotion:false ignores the preference', async () => {
    __setPrefersReducedMotionImpl(() => true);
    const canvas = createCanvas();
    let frames = 0;
    const handle = canvas.frame(
      () => {
        frames += 1;
      },
      { respectReducedMotion: false }
    );
    await new Promise(resolve => setTimeout(resolve, 80));
    expect(frames).toBeGreaterThan(0);
    handle.dispose();
  });

  test('paused frame loop does not invoke the callback', async () => {
    const canvas = createCanvas();
    let frames = 0;
    const handle = canvas.frame(() => {
      frames += 1;
    });
    handle.pause();
    expect(handle.paused).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 60));
    expect(frames).toBe(0);
    handle.dispose();
  });
});
