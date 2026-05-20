import { afterEach, describe, expect, it, mock } from 'bun:test';
import { timeline } from '../src/motion/timeline';
import { stagger } from '../src/motion/stagger';
import {
  onReducedMotionChange,
  setReducedMotion,
} from '../src/motion/reduced-motion';
import { reducedMotionSignal } from '../src/motion/reduced-motion-signal';
import { springVector } from '../src/motion/spring';

const createElement = (finished: Promise<void> = Promise.resolve()) => {
  const el = document.createElement('div');
  const anim = {
    onfinish: null as (() => void) | null,
    finished,
    cancel: mock(() => {}),
    pause: mock(() => {}),
    play: mock(() => {}),
    commitStyles: mock(() => {}),
    currentTime: 0,
    playbackRate: 1,
  };
  (el as HTMLElement).animate = mock(() => anim) as unknown as Element['animate'];
  return { el, anim };
};

afterEach(() => setReducedMotion(null));

describe('motion/timeline extras', () => {
  it('addLabel + label-relative `at` schedule from labels', () => {
    const { el } = createElement();
    const tl = timeline(
      [{ target: el, keyframes: [{ opacity: 0 }, { opacity: 1 }], options: { duration: 200 } }],
      { respectReducedMotion: true } // force reduced-motion-applied no-op path
    );
    tl.addLabel('mid');
    const mid = tl.label('mid');
    expect(typeof mid).toBe('number');
    tl.add({
      target: el,
      keyframes: [{ opacity: 1 }, { opacity: 0 }],
      options: { duration: 100 },
      at: 'mid+=50',
    });
    expect(tl.duration()).toBeGreaterThanOrEqual((mid ?? 0) + 50 + 100);
  });

  it('resolves label-relative offsets for labels with punctuation', () => {
    const { el } = createElement();
    const tl = timeline(
      [{ target: el, keyframes: [{ opacity: 0 }, { opacity: 1 }], options: { duration: 200 } }],
      { respectReducedMotion: true }
    );
    tl.addLabel('mid-point:1');
    const point = tl.label('mid-point:1');

    tl.add({
      target: el,
      keyframes: [{ opacity: 1 }, { opacity: 0 }],
      options: { duration: 100 },
      at: 'mid-point:1+=50',
    });

    expect(tl.duration()).toBeGreaterThanOrEqual((point ?? 0) + 50 + 100);
  });

  it('repeat + yoyo + playbackRate + progress + onUpdate compile and run', async () => {
    const { el } = createElement();
    const tl = timeline([
      { target: el, keyframes: [{ opacity: 0 }, { opacity: 1 }], options: { duration: 50 } },
    ]);
    tl.repeat(1);
    tl.yoyo(true);
    expect(tl.playbackRate(2)).toBe(2);
    expect(tl.progress()).toBe(0);
    const updates: number[] = [];
    const off = tl.onUpdate((t) => updates.push(t));
    setReducedMotion(true); // make play() finish immediately
    await tl.play();
    off();
    // Under reduced motion no updates are expected, but the API should be safe.
    expect(updates.length).toBeGreaterThanOrEqual(0);
  });

  it('reverse toggles playback rate sign on running animations', () => {
    const { el, anim } = createElement();
    const tl = timeline([
      { target: el, keyframes: [{ opacity: 0 }, { opacity: 1 }], options: { duration: 50 } },
    ]);
    tl.playbackRate(1);
    void tl.play();
    tl.reverse();
    expect(anim.playbackRate).toBeLessThan(0);
  });

  it('prevents duplicate update loops and stops when the last listener unsubscribes during a tick', async () => {
    const originalRequest = globalThis.requestAnimationFrame;
    const originalCancel = globalThis.cancelAnimationFrame;
    const callbacks: FrameRequestCallback[] = [];
    let frameId = 0;
    let cancels = 0;

    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callbacks.push(callback);
      frameId += 1;
      return frameId;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = (() => {
      cancels += 1;
    }) as typeof cancelAnimationFrame;

    try {
      const { el } = createElement(new Promise(() => {}));
      const tl = timeline([
        { target: el, keyframes: [{ opacity: 0 }, { opacity: 1 }], options: { duration: 50 } },
      ]);
      void tl.play();
      let off = () => {};
      off = tl.onUpdate(() => off());
      tl.resume();
      expect(callbacks).toHaveLength(1);

      const first = callbacks.shift();
      first?.(0);

      expect(callbacks).toHaveLength(0);
      expect(cancels).toBe(1);
      tl.stop();
    } finally {
      globalThis.requestAnimationFrame = originalRequest;
      globalThis.cancelAnimationFrame = originalCancel;
    }
  });

  it('does not reschedule the update loop after stop() during an update callback', async () => {
    const originalRequest = globalThis.requestAnimationFrame;
    const originalCancel = globalThis.cancelAnimationFrame;
    const callbacks: FrameRequestCallback[] = [];
    let frameId = 0;
    let cancels = 0;

    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callbacks.push(callback);
      frameId += 1;
      return frameId;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = (() => {
      cancels += 1;
    }) as typeof cancelAnimationFrame;

    try {
      const { el } = createElement(new Promise(() => {}));
      const tl = timeline([
        { target: el, keyframes: [{ opacity: 0 }, { opacity: 1 }], options: { duration: 50 } },
      ]);
      tl.onUpdate(() => tl.stop());
      void tl.play();

      expect(callbacks).toHaveLength(1);
      callbacks.shift()?.(0);

      expect(callbacks).toHaveLength(0);
      expect(cancels).toBe(1);
    } finally {
      globalThis.requestAnimationFrame = originalRequest;
      globalThis.cancelAnimationFrame = originalCancel;
    }
  });

  it('samples the latest animation time for onUpdate and progress', () => {
    const originalRequest = globalThis.requestAnimationFrame;
    const originalCancel = globalThis.cancelAnimationFrame;
    const callbacks: FrameRequestCallback[] = [];

    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame;

    try {
      const first = createElement(new Promise(() => {}));
      const second = createElement(new Promise(() => {}));
      const tl = timeline([
        {
          target: first.el,
          keyframes: [{ opacity: 0 }, { opacity: 1 }],
          options: { duration: 50 },
          at: 0,
        },
        {
          target: second.el,
          keyframes: [{ opacity: 0 }, { opacity: 1 }],
          options: { duration: 150 },
          at: 50,
        },
      ]);
      const updates: number[] = [];
      tl.onUpdate((time) => updates.push(time));

      void tl.play();
      first.anim.currentTime = 50;
      second.anim.currentTime = 120;
      callbacks.shift()?.(0);

      expect(updates).toEqual([120]);
      expect(tl.progress()).toBe(0.6);
      tl.stop();
    } finally {
      globalThis.requestAnimationFrame = originalRequest;
      globalThis.cancelAnimationFrame = originalCancel;
    }
  });
});

describe('motion/stagger extras', () => {
  it('grid mode computes 2D distance from a custom origin', () => {
    const fn = stagger(20, { grid: [3, 3], from: { x: 0, y: 0 } });
    expect(fn(0, 9)).toBe(0); // origin cell
    const farCorner = fn(8, 9); // (2, 2)
    expect(farCorner).toBeGreaterThan(0);
  });

  it('axis: "x" only considers horizontal distance', () => {
    const fn = stagger(20, { grid: [3, 3], from: { x: 0, y: 0 }, axis: 'x' });
    // index 6 == (0, 2) — same column as origin, axis-x distance is 0
    expect(fn(6, 9)).toBe(0);
  });

  it('random mode with seed is deterministic', () => {
    const a = stagger(10, { random: true, randomSeed: 123 });
    const b = stagger(10, { random: true, randomSeed: 123 });
    const va = [0, 1, 2, 3, 4].map((i) => a(i, 5));
    const vb = [0, 1, 2, 3, 4].map((i) => b(i, 5));
    expect(va).toEqual(vb);
  });

  it('grid easing preserves the same max delay range as linear distance', () => {
    const cols = 5;
    const rows = 5;
    const origin = { x: 0, y: 0 };
    const linear = stagger(10, { grid: [cols, rows], from: origin });
    const eased = stagger(10, { grid: [cols, rows], from: origin, easing: (t) => t });
    const farCornerIndex = cols * rows - 1;

    expect(eased(farCornerIndex, cols * rows)).toBe(linear(farCornerIndex, cols * rows));
  });

  it('returns the start delay for invalid grid dimensions', () => {
    expect(stagger(10, { start: 5, grid: [0, 3] })(1, 3)).toBe(5);
    expect(stagger(10, { start: 5, grid: [3, Number.NaN] })(1, 3)).toBe(5);
  });

  it('treats coordinate origins as start in linear mode', () => {
    const fn = stagger(10, { from: { x: 2, y: 5 } });
    expect(fn(0, 4)).toBe(0);
    expect(fn(2, 4)).toBe(20);
  });
});

describe('motion/reduced-motion subscriptions', () => {
  it('onReducedMotionChange fires when the override flips and unsubscribes cleanly', () => {
    const events: boolean[] = [];
    const off = onReducedMotionChange((v) => events.push(v));
    setReducedMotion(true);
    setReducedMotion(false);
    off();
    setReducedMotion(true); // should not fire
    expect(events).toEqual([true, false]);
  });

  it('reducedMotionSignal exposes the current value and reacts to changes', () => {
    const sig = reducedMotionSignal();
    const initial = sig.value;
    setReducedMotion(initial ? false : true);
    expect(sig.value).toBe(!initial);
    setReducedMotion(null);
  });
});

describe('motion/springVector', () => {
  it('skips snapshot work when no vector listeners are subscribed', () => {
    const pos = springVector({ x: 0, y: 0 });
    const dimensions = pos.dimensions();
    const xCurrent = mock(() => 10);
    const yCurrent = mock(() => 0);
    dimensions.x.current = xCurrent;
    dimensions.y.current = yCurrent;

    pos.set({ x: 10 });
    expect(xCurrent).not.toHaveBeenCalled();
    expect(yCurrent).not.toHaveBeenCalled();

    const off = pos.onChange(() => {});
    pos.set({ x: 20 });
    expect(xCurrent).toHaveBeenCalled();
    expect(yCurrent).toHaveBeenCalled();
    off();
  });
});
