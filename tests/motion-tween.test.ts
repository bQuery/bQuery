import { describe, expect, it } from 'bun:test';
import { animateValue, tween, type TweenControls } from '../src/motion/tween';
import { linear } from '../src/motion/easing';
import { setReducedMotion } from '../src/motion/reduced-motion';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('motion/animateValue', () => {
  it('interpolates a scalar between from and to over time', async () => {
    const observed: number[] = [];
    const final = await animateValue<number>({
      from: 0,
      to: 100,
      duration: 80,
      easing: linear,
      onUpdate: (v) => observed.push(v),
      respectReducedMotion: false,
    });
    expect(final).toBe(100);
    expect(observed.length).toBeGreaterThan(0);
    expect(observed[observed.length - 1]).toBe(100);
  });

  it('interpolates an array element-wise', async () => {
    const final = await animateValue<number[]>({
      from: [0, 0],
      to: [10, -20],
      duration: 60,
      respectReducedMotion: false,
    });
    expect(final[0]).toBeCloseTo(10, 5);
    expect(final[1]).toBeCloseTo(-20, 5);
  });

  it('interpolates a record by key', async () => {
    const final = await animateValue<Record<string, number>>({
      from: { x: 0, y: 5 },
      to: { x: 100, y: 25 },
      duration: 50,
      respectReducedMotion: false,
    });
    expect(final.x).toBeCloseTo(100, 5);
    expect(final.y).toBeCloseTo(25, 5);
  });

  it('preserves keys that exist only in the target record', async () => {
    const final = await animateValue<Record<string, number>>({
      from: { x: 0 },
      to: { x: 100, y: 25 },
      duration: 50,
      respectReducedMotion: false,
    });
    expect(final.x).toBeCloseTo(100, 5);
    expect(final.y).toBeCloseTo(25, 5);
  });

  it('throws a generic error for unsupported value shapes', () => {
    setReducedMotion(true);
    try {
      expect(() =>
        animateValue({
          from: [0] as unknown as number,
          to: { x: 1 } as unknown as number,
        } as never)
      ).toThrow('"from" and "to" must be numbers, number[], or Record<string, number>');
    } finally {
      setReducedMotion(null);
    }
  });

  it('honors reduced motion by jumping to the final value immediately', async () => {
    setReducedMotion(true);
    try {
      const final = await animateValue<number>({
        from: 0,
        to: 50,
        duration: 1000,
      });
      expect(final).toBe(50);
    } finally {
      setReducedMotion(null);
    }
  });
});

describe('motion/tween controls', () => {
  it('pause/resume/seek/finished work as documented', async () => {
    const t: TweenControls<number> = tween({
      from: 0,
      to: 100,
      duration: 200,
      easing: linear,
      respectReducedMotion: false,
    });

    await wait(30);
    t.pause();
    const paused = t.progress();
    await wait(40);
    expect(Math.abs(t.progress() - paused)).toBeLessThan(0.01);

    t.seek(0.5);
    expect(t.progress()).toBeCloseTo(0.5, 5);
    expect(t.current()).toBeCloseTo(50, 0);

    t.resume();
    const final = await t.finished;
    expect(final).toBe(100);
  });

  it('stop() resolves finished early and stops emitting updates', async () => {
    let updates = 0;
    const t = tween<number>({
      from: 0,
      to: 100,
      duration: 200,
      onUpdate: () => {
        updates += 1;
      },
      respectReducedMotion: false,
    });
    await wait(30);
    const updatesAtStop = updates;
    t.stop();
    const value = await t.finished;
    expect(value).toBeLessThan(100);
    await wait(40);
    // No further updates after stop
    expect(updates).toBe(updatesAtStop);
  });

  it('aborts when an AbortSignal fires', async () => {
    const ctrl = new AbortController();
    const t = tween<number>({
      from: 0,
      to: 100,
      duration: 200,
      signal: ctrl.signal,
      respectReducedMotion: false,
    });
    await wait(20);
    ctrl.abort();
    const value = await t.finished;
    expect(value).toBeLessThan(100);
  });

  it('respects delay before starting', async () => {
    let firstUpdate: number | null = null;
    const start = Date.now();
    const t = tween<number>({
      from: 0,
      to: 1,
      duration: 50,
      delay: 60,
      onUpdate: (v) => {
        if (firstUpdate === null) firstUpdate = Date.now() - start;
        void v;
      },
      respectReducedMotion: false,
    });
    await t.finished;
    expect(firstUpdate).not.toBeNull();
    expect(firstUpdate!).toBeGreaterThanOrEqual(40);
  });

  it('honors reverse() before a reduced-motion delayed start', async () => {
    setReducedMotion(true);
    try {
      const t = tween<number>({
        from: 0,
        to: 100,
        delay: 20,
      });
      t.reverse();
      const value = await t.finished;
      expect(value).toBe(0);
      expect(t.current()).toBe(0);
      expect(t.progress()).toBe(0);
    } finally {
      setReducedMotion(null);
    }
  });
});
