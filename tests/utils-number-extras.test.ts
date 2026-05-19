import { describe, expect, it } from 'bun:test';
import {
  average,
  degToRad,
  formatBytes,
  inverseLerp,
  lerp,
  mapRange,
  median,
  radToDeg,
  randomFloat,
  round,
  roundTo,
  sum,
} from '../src/core/utils/number';

describe('utils/number extras', () => {
  it('round / roundTo', () => {
    expect(round(1.2345, 2)).toBe(1.23);
    expect(round(1234.5)).toBe(1235);
    expect(roundTo(13, 5)).toBe(15);
    expect(roundTo(0.27, 0.05)).toBeCloseTo(0.25, 6);
    expect(roundTo(7, 0)).toBe(7);
  });

  it('lerp / inverseLerp / mapRange', () => {
    expect(lerp(0, 10, 0.25)).toBe(2.5);
    expect(inverseLerp(0, 10, 2.5)).toBe(0.25);
    expect(inverseLerp(5, 5, 5)).toBe(0); // degenerate
    expect(mapRange(5, 0, 10, 100, 200)).toBe(150);
  });

  it('formatBytes — decimal and binary, with locale', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1500, { decimals: 2, locale: 'en-US' })).toBe('1.50 KB');
    expect(formatBytes(1024, { binary: true, decimals: 2, locale: 'en-US' })).toBe('1.00 KiB');
    expect(formatBytes(NaN)).toBe('NaN');
  });

  it('randomFloat sits within [min, max)', () => {
    for (let i = 0; i < 20; i += 1) {
      const v = randomFloat(0, 1);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('sum / average / median', () => {
    expect(sum([])).toBe(0);
    expect(sum([1, 2, 3])).toBe(6);
    expect(average([])).toBe(0);
    expect(average([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBe(0);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('degToRad / radToDeg roundtrip', () => {
    expect(degToRad(180)).toBeCloseTo(Math.PI, 10);
    expect(radToDeg(Math.PI)).toBeCloseTo(180, 10);
  });
});
