import { describe, expect, it } from 'bun:test';
import {
  chain,
  cubicBezier,
  easeInBack,
  easeInBounce,
  easeInCirc,
  easeInElastic,
  easeInExpo,
  easeInOutBack,
  easeInOutBounce,
  easeInOutCirc,
  easeInOutCubic,
  easeInOutElastic,
  easeInOutExpo,
  easeInOutQuad,
  easeInOutQuart,
  easeInOutQuint,
  easeInOutSine,
  easeInQuart,
  easeInQuint,
  easeInSine,
  easeOutBack,
  easeOutBounce,
  easeOutCirc,
  easeOutElastic,
  easeOutQuart,
  easeOutQuint,
  easeOutSine,
  easingPresets,
  linear,
  mix,
  steps,
} from '../src/motion/easing';

describe('motion/easing extras — Penner family', () => {
  const named = {
    easeInQuart,
    easeOutQuart,
    easeInOutQuart,
    easeInQuint,
    easeOutQuint,
    easeInOutQuint,
    easeInSine,
    easeOutSine,
    easeInOutSine,
    easeInExpo,
    easeInOutExpo,
    easeInCirc,
    easeOutCirc,
    easeInOutCirc,
    easeInBack,
    easeOutBack,
    easeInOutBack,
    easeInElastic,
    easeOutElastic,
    easeInOutElastic,
    easeInBounce,
    easeOutBounce,
    easeInOutBounce,
  };

  for (const [name, fn] of Object.entries(named)) {
    it(`${name} pins endpoints to 0 and 1 (±1e-6)`, () => {
      expect(Math.abs(fn(0))).toBeLessThan(1e-6);
      expect(Math.abs(fn(1) - 1)).toBeLessThan(1e-6);
    });

    it(`${name} stays in [0, 1]`, () => {
      for (let i = 0; i <= 10; i += 1) {
        const t = i / 10;
        const v = fn(t);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    });
  }

  it('easingPresets exposes all new Penner variants', () => {
    expect(easingPresets.easeInBack).toBe(easeInBack);
    expect(easingPresets.easeInOutBounce).toBe(easeInOutBounce);
    expect(easingPresets.easeOutElastic).toBe(easeOutElastic);
  });
});

describe('motion/cubicBezier', () => {
  it('approximates linear with the (0,0,1,1) curve', () => {
    const fn = cubicBezier(0, 0, 1, 1);
    expect(fn(0)).toBe(0);
    expect(fn(1)).toBe(1);
    expect(Math.abs(fn(0.5) - 0.5)).toBeLessThan(1e-3);
  });

  it('matches the CSS ease curve at midpoint approximately', () => {
    const fn = cubicBezier(0.25, 0.1, 0.25, 1);
    expect(fn(0)).toBe(0);
    expect(fn(1)).toBe(1);
    // CSS `ease` produces ~0.8 at t=0.5; allow a generous tolerance.
    expect(fn(0.5)).toBeGreaterThan(0.7);
    expect(fn(0.5)).toBeLessThan(0.85);
  });

  it('clamps outside [0, 1]', () => {
    const fn = cubicBezier(0.42, 0, 0.58, 1);
    expect(fn(-0.5)).toBe(0);
    expect(fn(1.5)).toBe(1);
  });
});

describe('motion/steps', () => {
  it('jump-end (default) produces n stairs', () => {
    const fn = steps(4);
    expect(fn(0)).toBe(0);
    expect(fn(0.24)).toBe(0);
    expect(fn(0.25)).toBe(0.25);
    expect(fn(0.99)).toBe(0.75);
    expect(fn(1)).toBe(1);
  });

  it('jump-start jumps immediately at t=0', () => {
    const fn = steps(4, 'jump-start');
    expect(fn(0)).toBeCloseTo(0.25, 6);
    expect(fn(1)).toBe(1);
  });

  it('jump-none and jump-both behave consistently at boundaries', () => {
    const none = steps(4, 'jump-none');
    expect(none(0)).toBe(0);
    expect(none(1)).toBe(1);

    const both = steps(4, 'jump-both');
    expect(both(0)).toBeCloseTo(0.2, 6);
    expect(both(1)).toBe(1);
  });
});

describe('motion/mix + chain', () => {
  it('mix returns the first easing at weight 0 and the second at weight 1', () => {
    const m0 = mix(linear, easeInOutQuad, 0);
    const m1 = mix(linear, easeInOutQuad, 1);
    expect(m0(0.5)).toBeCloseTo(linear(0.5), 6);
    expect(m1(0.5)).toBeCloseTo(easeInOutQuad(0.5), 6);
  });

  it('chain concatenates equal slices', () => {
    const c = chain(linear, linear);
    // Each half traverses [0, 0.5] of the total output.
    expect(c(0)).toBe(0);
    expect(c(0.5)).toBeCloseTo(0.5, 6);
    expect(c(1)).toBe(1);
  });

  it('chain falls back to linear with empty input and returns the single easing with one input', () => {
    const fallback = chain();
    expect(fallback(0.4)).toBeCloseTo(0.4, 6);
    const single = chain(easeInOutCubic);
    expect(single(0.4)).toBeCloseTo(easeInOutCubic(0.4), 6);
  });
});
