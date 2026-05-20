import { describe, expect, it } from 'bun:test';
import {
  deepEqual,
  defaults,
  entriesTyped,
  freeze,
  get,
  has,
  invert,
  isEqual,
  keysTyped,
  mapKeys,
  mapValues,
  set,
} from '../src/core/utils/object';

describe('utils/object extras', () => {
  it('get reads nested values with dot and bracket notation', () => {
    expect(get<number>({ a: { b: { c: 42 } } }, 'a.b.c')).toBe(42);
    expect(get<string>({ list: [{ name: 'x' }] }, 'list[0].name')).toBe('x');
    expect(get<number>({ 'a.b': 7 }, '["a.b"]')).toBe(7);
    expect(get({}, 'a.b', 'fallback')).toBe('fallback');
    expect(get({ a: null }, 'a', 'fallback')).toBeNull();
  });

  it('get refuses prototype-pollution keys', () => {
    const obj = JSON.parse('{"a":1}');
    expect(get(obj, '__proto__.polluted', 'safe')).toBe('safe');
  });

  it('set creates intermediate containers and ignores pollution keys', () => {
    const obj: Record<string, unknown> = {};
    set(obj, 'a.b.c', 1);
    expect((obj.a as { b: { c: number } }).b.c).toBe(1);
    set(obj, 'list[0].name', 'x');
    expect((obj.list as Array<{ name: string }>)[0].name).toBe('x');
    set(obj, 'config["theme.color"]', '#0af');
    expect((obj.config as Record<string, string>)['theme.color']).toBe('#0af');
    set(obj, ['items', 0, 'value'], 'y');
    expect((obj.items as Array<{ value: string }>)[0].value).toBe('y');
    set(obj, '__proto__.polluted', true);
    expect((Object.prototype as unknown as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it('set handles non-configurable targets without throwing', () => {
    const list = ['a', 'b', 'c'];
    expect(() => set(list, 'length', 1)).not.toThrow();
    expect(list).toEqual(['a']);

    const locked: Record<string, unknown> = {};
    Object.defineProperty(locked, 'value', {
      value: 1,
      enumerable: true,
      writable: false,
      configurable: false,
    });
    expect(() => set(locked, 'value', 2)).not.toThrow();
    expect(locked.value).toBe(1);
  });

  it('has detects nested presence and prototype-pollution safety', () => {
    expect(has({ a: { b: 0 } }, 'a.b')).toBe(true);
    expect(has({ config: { 'theme.color': '#0af' } }, 'config["theme.color"]')).toBe(true);
    expect(has({ a: {} }, 'a.b')).toBe(false);
    expect(has({}, '__proto__')).toBe(false);
  });

  it('mapValues / mapKeys / invert', () => {
    expect(mapValues({ a: 1, b: 2 }, (v) => v * 10)).toEqual({ a: 10, b: 20 });
    expect(mapKeys({ a: 1, b: 2 }, (k) => k.toUpperCase())).toEqual({ A: 1, B: 2 });
    expect(invert({ a: 1, b: 2 })).toEqual({ '1': 'a', '2': 'b' });
  });

  it('deepEqual handles primitives, arrays, Dates, RegExps, Maps, Sets, objects', () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual(NaN, NaN)).toBe(true);
    expect(deepEqual([1, [2, 3]], [1, [2, 3]])).toBe(true);
    expect(deepEqual({ a: 1, b: [2] }, { a: 1, b: [2] })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(deepEqual(new Date('2024-01-01'), new Date('2024-01-01'))).toBe(true);
    expect(deepEqual(/foo/g, /foo/g)).toBe(true);
    expect(deepEqual(new Map([['a', 1]]), new Map([['a', 1]]))).toBe(true);
    expect(deepEqual(new Set([1, 2]), new Set([2, 1]))).toBe(true);
    expect(deepEqual({ a: undefined }, { b: undefined })).toBe(false);
    expect(isEqual).toBe(deepEqual);
  });

  it('deepEqual handles cyclic objects without overflowing', () => {
    const left: { value: number; self?: unknown; nested?: { parent?: unknown } } = { value: 1 };
    left.self = left;
    left.nested = { parent: left };

    const right: { value: number; self?: unknown; nested?: { parent?: unknown } } = { value: 1 };
    right.self = right;
    right.nested = { parent: right };

    const mismatch: { value: number; self?: unknown } = { value: 2 };
    mismatch.self = mismatch;

    expect(deepEqual(left, right)).toBe(true);
    expect(deepEqual(left, mismatch)).toBe(false);
  });

  it('freeze deeply freezes nested objects', () => {
    const obj = { a: { b: { c: 1 } } };
    freeze(obj);
    expect(Object.isFrozen(obj)).toBe(true);
    expect(Object.isFrozen(obj.a)).toBe(true);
    expect(Object.isFrozen(obj.a.b)).toBe(true);
  });

  it('freeze handles cyclic objects without overflowing', () => {
    const obj: { self?: unknown; nested: { parent?: unknown } } = { nested: {} };
    obj.self = obj;
    obj.nested.parent = obj;

    expect(() => freeze(obj)).not.toThrow();
    expect(Object.isFrozen(obj)).toBe(true);
    expect(Object.isFrozen(obj.nested)).toBe(true);
  });

  it('defaults fills undefined keys, ignores prototype-pollution keys', () => {
    const target: Record<string, unknown> = { a: 1, b: undefined };
    defaults(target, { a: 99, b: 2, c: 3 });
    expect(target).toEqual({ a: 1, b: 2, c: 3 });
    defaults(target, { __proto__: { polluted: true } } as unknown as Record<string, unknown>);
    expect((Object.prototype as unknown as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it('defaults skips non-configurable undefined properties it cannot write', () => {
    const target: Record<string, unknown> = {};
    Object.defineProperty(target, 'locked', {
      value: undefined,
      enumerable: true,
      writable: false,
      configurable: false,
    });

    expect(() => defaults(target, { locked: 1, open: 2 })).not.toThrow();
    expect(target.locked).toBeUndefined();
    expect(target.open).toBe(2);
  });

  it('entriesTyped and keysTyped preserve key types', () => {
    const obj = { a: 1, b: 'two' as const };
    const entries = entriesTyped(obj);
    const keys = keysTyped(obj);
    expect(entries.length).toBe(2);
    expect(keys.sort()).toEqual(['a', 'b']);
  });
});
