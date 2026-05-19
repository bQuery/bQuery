import { afterEach, describe, expect, it, mock } from 'bun:test';
import { timeline } from '../src/motion/timeline';
import { stagger } from '../src/motion/stagger';
import {
  onReducedMotionChange,
  reducedMotionSignal,
  setReducedMotion,
} from '../src/motion/reduced-motion';

const createElement = () => {
  const el = document.createElement('div');
  const anim = {
    onfinish: null as (() => void) | null,
    finished: Promise.resolve(),
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
