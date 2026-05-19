import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { countUp, magnetic, pulse, shake, tilt } from '../src/motion/effects';
import { setReducedMotion } from '../src/motion/reduced-motion';

const createElement = () => {
  const el = document.createElement('div');
  el.getBoundingClientRect = () =>
    ({
      top: 0,
      left: 0,
      right: 100,
      bottom: 100,
      width: 100,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  (el as HTMLElement).animate = mock(() => ({
    onfinish: null as (() => void) | null,
    finished: Promise.resolve(),
    cancel: mock(() => {}),
    commitStyles: mock(() => {}),
  })) as unknown as Element['animate'];
  return el;
};

describe('motion/effects', () => {
  beforeEach(() => setReducedMotion(null));
  afterEach(() => setReducedMotion(null));

  it('magnetic translates toward the pointer within the radius', () => {
    const el = createElement();
    const cleanup = magnetic(el, { strength: 0.5, radius: 200, respectReducedMotion: false });
    window.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 60, clientY: 60 })
    );
    expect(el.style.transform).toContain('translate3d');
    cleanup();
    expect(el.style.transform).toBe('');
  });

  it('magnetic returns a noop cleanup under reduced motion', () => {
    setReducedMotion(true);
    const el = createElement();
    const cleanup = magnetic(el);
    expect(typeof cleanup).toBe('function');
    expect(el.style.transform).toBe('');
  });

  it('tilt sets a perspective transform on pointer move and resets on leave', () => {
    const el = createElement();
    const cleanup = tilt(el, { max: 10, perspective: 500, respectReducedMotion: false });
    el.dispatchEvent(new MouseEvent('pointermove', { clientX: 60, clientY: 60 }));
    expect(el.style.transform).toContain('perspective(500px)');
    expect(el.style.transform).toContain('rotateX');
    el.dispatchEvent(new MouseEvent('pointerleave'));
    cleanup();
    expect(el.style.transform).toBe('');
  });

  it('shake resolves promptly under reduced motion', async () => {
    setReducedMotion(true);
    const el = createElement();
    await shake(el);
    expect(true).toBe(true);
  });

  it('shake calls animate with keyframes', async () => {
    const el = createElement();
    await shake(el, { duration: 50, respectReducedMotion: false });
    expect((el as HTMLElement).animate).toHaveBeenCalled();
  });

  it('pulse calls animate with scale keyframes and iterations', async () => {
    const el = createElement();
    await pulse(el, { duration: 50, scale: 1.1, iterations: 2, respectReducedMotion: false });
    expect((el as HTMLElement).animate).toHaveBeenCalled();
  });

  it('countUp updates element text up to the final value', async () => {
    const el = document.createElement('span');
    await countUp(el, 0, 100, { duration: 60, respectReducedMotion: false });
    expect(el.textContent).toBe('100');
  });

  it('countUp jumps to final value under reduced motion', async () => {
    setReducedMotion(true);
    const el = document.createElement('span');
    await countUp(el, 0, 50);
    expect(el.textContent).toBe('50');
  });

  it('countUp honors prefix/suffix and decimals', async () => {
    setReducedMotion(true);
    const el = document.createElement('span');
    await countUp(el, 0, 12.5, { prefix: '$', suffix: ' USD', decimals: 1 });
    expect(el.textContent).toBe('$12.5 USD');
  });
});
