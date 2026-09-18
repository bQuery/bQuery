/**
 * Store internals (#215). `src/store/utils.ts` sat at 5.08% line coverage in a
 * module rated Stable, despite being the deep-clone and deep-equality logic
 * every store write goes through.
 */

import { describe, expect, it } from 'bun:test';
import {
  deepClone,
  deepEqual,
  detectNestedMutations,
  isDev,
  isPlainObject,
} from '../src/store/utils';

describe('store/isPlainObject', () => {
  it('accepts object literals and null-prototype-free plain objects', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ a: 1 })).toBe(true);
    expect(isPlainObject(Object.assign({}, { b: 2 }))).toBe(true);
  });

  it('rejects arrays, dates, maps, sets and class instances', () => {
    class Thing {}
    for (const value of [[], new Date(), new Map(), new Set(), new Thing(), /re/]) {
      expect(isPlainObject(value)).toBe(false);
    }
  });

  it('rejects primitives and null', () => {
    for (const value of [null, undefined, 1, 'a', true, Symbol('s'), 1n]) {
      expect(isPlainObject(value)).toBe(false);
    }
  });

  it('rejects a null-prototype object, which has no Object.prototype', () => {
    expect(isPlainObject(Object.create(null))).toBe(false);
  });
});

describe('store/deepClone', () => {
  it('returns primitives and null unchanged', () => {
    for (const value of [null, undefined, 1, 'a', true, 1n]) {
      expect(deepClone(value)).toBe(value);
    }
  });

  it('clones nested objects so mutation does not leak', () => {
    const original = { a: { b: { c: 1 } } };
    const clone = deepClone(original);

    clone.a.b.c = 2;

    expect(original.a.b.c).toBe(1);
    expect(clone).not.toBe(original);
    expect(clone.a).not.toBe(original.a);
  });

  it('clones arrays, including nested ones', () => {
    const original = [1, [2, [3]]];
    const clone = deepClone(original);

    expect(clone).toEqual(original);
    expect(clone).not.toBe(original);
    expect(clone[1]).not.toBe(original[1]);
  });

  it('clones Dates by value', () => {
    const original = new Date('2026-01-01T00:00:00Z');
    const clone = deepClone(original);

    expect(clone).toBeInstanceOf(Date);
    expect(clone.getTime()).toBe(original.getTime());
    expect(clone).not.toBe(original);
  });

  it('clones Maps, including their values', () => {
    const original = new Map<string, { n: number }>([['k', { n: 1 }]]);
    const clone = deepClone(original);

    expect(clone).toBeInstanceOf(Map);
    expect(clone.get('k')).toEqual({ n: 1 });
    expect(clone.get('k')).not.toBe(original.get('k'));
  });

  it('clones Sets, including their members', () => {
    const member = { n: 1 };
    const clone = deepClone(new Set([member]));

    expect(clone).toBeInstanceOf(Set);
    expect([...clone][0]).toEqual({ n: 1 });
    expect([...clone][0]).not.toBe(member);
  });

  it('copies a `__proto__` key as an own property instead of reassigning the prototype', () => {
    // The vector is JSON.parse('{"__proto__":{"polluted":1}}'): plain
    // assignment would run the accessor and change the clone's prototype.
    const payload = JSON.parse('{"__proto__":{"polluted":1}}') as Record<string, unknown>;
    const clone = deepClone(payload);

    expect(Object.getPrototypeOf(clone)).toBe(Object.prototype);
    expect(Object.hasOwn(clone, '__proto__')).toBe(true);
    expect((clone as { polluted?: unknown }).polluted).toBeUndefined();
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
  });

  it('copies `constructor` and `prototype` as ordinary keys', () => {
    const clone = deepClone({ constructor: 'c', prototype: 'p' });
    expect(clone.constructor).toBe('c');
    expect(clone.prototype).toBe('p');
  });

  it('clones a mixed structure end to end', () => {
    const original = {
      list: [1, { deep: true }],
      when: new Date(0),
      lookup: new Map([['a', 1]]),
      unique: new Set([1, 2]),
      flag: false,
    };
    const clone = deepClone(original);

    expect(clone).toEqual(original);
    expect(clone.list).not.toBe(original.list);
    expect(clone.lookup).not.toBe(original.lookup);
  });
});

describe('store/deepEqual', () => {
  it('treats identical references as equal', () => {
    const value = { a: 1 };
    expect(deepEqual(value, value)).toBe(true);
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual(null, null)).toBe(true);
  });

  it('compares primitives by value', () => {
    expect(deepEqual(1, 2)).toBe(false);
    expect(deepEqual('a', 'a')).toBe(true);
    expect(deepEqual(true, false)).toBe(false);
  });

  it('treats null against an object as unequal', () => {
    expect(deepEqual(null, {})).toBe(false);
    expect(deepEqual({}, null)).toBe(false);
  });

  it('compares Dates by timestamp', () => {
    expect(deepEqual(new Date(0), new Date(0))).toBe(true);
    expect(deepEqual(new Date(0), new Date(1))).toBe(false);
  });

  it('compares Maps by size, keys and values', () => {
    expect(deepEqual(new Map([['a', 1]]), new Map([['a', 1]]))).toBe(true);
    expect(deepEqual(new Map([['a', 1]]), new Map([['a', 2]]))).toBe(false);
    expect(deepEqual(new Map([['a', 1]]), new Map([['b', 1]]))).toBe(false);
    expect(
      deepEqual(
        new Map([['a', 1]]),
        new Map([
          ['a', 1],
          ['b', 2],
        ])
      )
    ).toBe(false);
  });

  it('compares Maps with object values deeply', () => {
    expect(deepEqual(new Map([['k', { n: 1 }]]), new Map([['k', { n: 1 }]]))).toBe(true);
    expect(deepEqual(new Map([['k', { n: 1 }]]), new Map([['k', { n: 2 }]]))).toBe(false);
  });

  it('compares Sets by membership rather than order', () => {
    expect(deepEqual(new Set([1, 2]), new Set([2, 1]))).toBe(true);
    expect(deepEqual(new Set([1]), new Set([1, 2]))).toBe(false);
    expect(deepEqual(new Set([{ n: 1 }]), new Set([{ n: 1 }]))).toBe(true);
    expect(deepEqual(new Set([{ n: 1 }]), new Set([{ n: 2 }]))).toBe(false);
  });

  it('compares arrays elementwise', () => {
    expect(deepEqual([1, 2], [1, 2])).toBe(true);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
    expect(deepEqual([1], [1, 2])).toBe(false);
    expect(deepEqual([{ a: 1 }], [{ a: 1 }])).toBe(true);
  });

  it('treats an array and a non-array object as unequal', () => {
    expect(deepEqual([], {})).toBe(false);
    expect(deepEqual({}, [])).toBe(false);
  });

  it('compares plain objects by key set and value', () => {
    expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(deepEqual({ a: { b: [1, { c: 2 }] } }, { a: { b: [1, { c: 2 }] } })).toBe(true);
    expect(deepEqual({ a: { b: [1, { c: 2 }] } }, { a: { b: [1, { c: 3 }] } })).toBe(false);
  });
});

describe('store/detectNestedMutations', () => {
  it('reports a key whose object was mutated behind an unchanged reference', () => {
    const shared = { count: 1 };
    const before = { profile: { count: 1 }, other: 'x' };
    const after = { profile: shared, other: 'x' };
    shared.count = 2;

    const signals = new Map<keyof typeof after, unknown>([['profile', shared]]);

    expect(detectNestedMutations(before, after, signals)).toEqual(['profile']);
  });

  it('reports nothing when the content is unchanged', () => {
    const shared = { count: 1 };
    const signals = new Map<string, unknown>([['profile', shared]]);

    expect(detectNestedMutations({ profile: { count: 1 } }, { profile: shared }, signals)).toEqual(
      []
    );
  });

  it('ignores a key whose reference changed — an ordinary signal write', () => {
    const before = { profile: { count: 1 } };
    const after = { profile: { count: 2 } };
    const signals = new Map<string, unknown>([['profile', before.profile]]);

    expect(detectNestedMutations(before, after, signals)).toEqual([]);
  });

  it('ignores non-plain-object values', () => {
    const list = [1];
    const signals = new Map<string, unknown>([['list', list]]);

    expect(detectNestedMutations({ list: [1, 2] }, { list }, signals)).toEqual([]);
  });

  it('reports every mutated key', () => {
    const a = { n: 9 };
    const b = { n: 9 };
    const signals = new Map<string, unknown>([
      ['a', a],
      ['b', b],
    ]);

    expect(detectNestedMutations({ a: { n: 1 }, b: { n: 1 } }, { a, b }, signals)).toEqual([
      'a',
      'b',
    ]);
  });
});

describe('store/isDev', () => {
  it('answers with a boolean', () => {
    expect(typeof isDev()).toBe('boolean');
  });
});
