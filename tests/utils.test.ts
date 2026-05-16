import { describe, expect, it } from 'bun:test';
import type { BQueryUtils } from '../src/core/utils';
import { isPrototypePollutionKey, utils } from '../src/core/utils';

describe('utils/BQueryUtils type', () => {
  it('utils satisfies BQueryUtils interface (compile-time guard)', () => {
    // Compile-time check: `utils` must be assignable to `BQueryUtils`.
    const typed: BQueryUtils = utils;
    void typed;

    // Runtime sanity check so this test is not vacuous under `bun test`.
    expect(utils).toBeDefined();
  });
});

describe('utils/merge', () => {
  it('merges objects deeply', () => {
    const merged = utils.merge(
      { a: 1, nested: { x: 1 } } as Record<string, unknown>,
      { nested: { y: 2 } } as Record<string, unknown>
    );
    expect(merged).toEqual({ a: 1, nested: { x: 1, y: 2 } });
  });

  it('overwrites primitive values', () => {
    const merged = utils.merge(
      { a: 1 } as Record<string, unknown>,
      { a: 2 } as Record<string, unknown>
    );
    expect(merged).toEqual({ a: 2 });
  });
});

describe('utils/uid', () => {
  it('creates stable ids', () => {
    const id = utils.uid('test');
    expect(id.startsWith('test_')).toBe(true);
  });

  it('creates unique ids', () => {
    const id1 = utils.uid();
    const id2 = utils.uid();
    expect(id1).not.toBe(id2);
  });
});

describe('utils/isEmpty', () => {
  it('returns true for null', () => {
    expect(utils.isEmpty(null)).toBe(true);
  });

  it('returns true for undefined', () => {
    expect(utils.isEmpty(undefined)).toBe(true);
  });

  it('returns true for empty string', () => {
    expect(utils.isEmpty('')).toBe(true);
    expect(utils.isEmpty('   ')).toBe(true);
  });

  it('returns true for empty array', () => {
    expect(utils.isEmpty([])).toBe(true);
  });

  it('returns true for empty object', () => {
    expect(utils.isEmpty({})).toBe(true);
  });

  it('returns false for non-empty values', () => {
    expect(utils.isEmpty('hello')).toBe(false);
    expect(utils.isEmpty([1, 2])).toBe(false);
    expect(utils.isEmpty({ a: 1 })).toBe(false);
  });
});

describe('utils/type checks', () => {
  it('isString correctly identifies strings', () => {
    expect(utils.isString('hello')).toBe(true);
    expect(utils.isString(123)).toBe(false);
  });

  it('isNumber correctly identifies numbers', () => {
    expect(utils.isNumber(123)).toBe(true);
    expect(utils.isNumber('123')).toBe(false);
    expect(utils.isNumber(NaN)).toBe(false);
  });

  it('isBoolean correctly identifies booleans', () => {
    expect(utils.isBoolean(true)).toBe(true);
    expect(utils.isBoolean(false)).toBe(true);
    expect(utils.isBoolean(1)).toBe(false);
  });

  it('isArray correctly identifies arrays', () => {
    expect(utils.isArray([1, 2, 3])).toBe(true);
    expect(utils.isArray('string')).toBe(false);
  });

  it('isFunction correctly identifies functions', () => {
    expect(utils.isFunction(() => {})).toBe(true);
    expect(utils.isFunction({})).toBe(false);
  });

  it('isPlainObject correctly identifies plain objects', () => {
    expect(utils.isPlainObject({})).toBe(true);
    expect(utils.isPlainObject({ a: 1 })).toBe(true);
    expect(utils.isPlainObject([])).toBe(false);
    expect(utils.isPlainObject(null)).toBe(false);
  });
});

describe('utils/parseJson', () => {
  it('parses valid JSON', () => {
    const result = utils.parseJson('{"name":"test"}', {});
    expect(result).toEqual({ name: 'test' });
  });

  it('returns fallback for invalid JSON', () => {
    const result = utils.parseJson('invalid', { default: true });
    expect(result).toEqual({ default: true });
  });
});

describe('utils/pick and omit', () => {
  it('pick selects specified keys', () => {
    const obj = { a: 1, b: 2, c: 3 };
    const result = utils.pick(obj, ['a', 'c']);
    expect(result).toEqual({ a: 1, c: 3 });
  });

  it('omit removes specified keys', () => {
    const obj = { a: 1, b: 2, c: 3 };
    const result = utils.omit(obj, ['b']);
    expect(result).toEqual({ a: 1, c: 3 });
  });
});

describe('utils/math helpers', () => {
  it('clamp restricts value to range', () => {
    expect(utils.clamp(150, 0, 100)).toBe(100);
    expect(utils.clamp(-10, 0, 100)).toBe(0);
    expect(utils.clamp(50, 0, 100)).toBe(50);
  });

  it('randomInt returns value in range', () => {
    for (let attempt = 0; attempt < 20; attempt++) {
      const result = utils.randomInt(1, 6);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(6);
    }
  });
});

describe('utils/string helpers', () => {
  it('capitalize uppercases first letter', () => {
    expect(utils.capitalize('hello')).toBe('Hello');
    expect(utils.capitalize('')).toBe('');
  });

  it('toKebabCase converts camelCase', () => {
    expect(utils.toKebabCase('myVariableName')).toBe('my-variable-name');
    expect(utils.toKebabCase('backgroundColor')).toBe('background-color');
  });

  it('toCamelCase converts kebab-case', () => {
    expect(utils.toCamelCase('my-variable-name')).toBe('myVariableName');
    expect(utils.toCamelCase('some_snake_case')).toBe('someSnakeCase');
  });
});

describe('utils/once', () => {
  it('executes function only once', () => {
    let callCount = 0;
    const fn = utils.once(() => {
      callCount++;
      return 'result';
    });

    const result1 = fn();
    const result2 = fn();
    const result3 = fn();

    expect(callCount).toBe(1);
    expect(result1).toBe('result');
    expect(result2).toBe('result');
    expect(result3).toBe('result');
  });

  it('returns cached result on subsequent calls', () => {
    const fn = utils.once(() => ({ value: Math.random() }));

    const result1 = fn();
    const result2 = fn();

    expect(result2).toBe(result1);
  });

  it('does not cache failures when function throws', () => {
    let callCount = 0;
    const fn = utils.once(() => {
      callCount++;
      if (callCount === 1) {
        throw new Error('First call fails');
      }
      return 'success';
    });

    // First call should throw
    expect(() => fn()).toThrow('First call fails');
    expect(callCount).toBe(1);

    // Second call should retry and succeed
    const result = fn();
    expect(callCount).toBe(2);
    expect(result).toBe('success');

    // Third call should return cached success result
    const result2 = fn();
    expect(callCount).toBe(2); // No additional call
    expect(result2).toBe('success');
  });

  it('retries on each call until function succeeds', () => {
    let callCount = 0;
    const fn = utils.once(() => {
      callCount++;
      if (callCount < 3) {
        throw new Error('Not ready yet');
      }
      return 'finally ready';
    });

    expect(() => fn()).toThrow('Not ready yet');
    expect(callCount).toBe(1);

    expect(() => fn()).toThrow('Not ready yet');
    expect(callCount).toBe(2);

    const result = fn();
    expect(callCount).toBe(3);
    expect(result).toBe('finally ready');

    // Should not call again after success
    const result2 = fn();
    expect(callCount).toBe(3);
    expect(result2).toBe('finally ready');
  });
});

describe('utils/sleep', () => {
  it('returns a promise', () => {
    const result = utils.sleep(0);
    expect(result).toBeInstanceOf(Promise);
  });

  it('resolves after delay', async () => {
    const start = Date.now();
    await utils.sleep(50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40);
  });
});

describe('utils/clone', () => {
  it('creates a deep copy', () => {
    const original = { nested: { value: 1 } };
    const cloned = utils.clone(original);

    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned.nested).not.toBe(original.nested);
  });
});

describe('utils/security', () => {
  it('isPrototypePollutionKey identifies dangerous keys', () => {
    // Note: isPrototypePollutionKey is now a named export only, not in utils namespace
    expect(isPrototypePollutionKey('__proto__')).toBe(true);
    expect(isPrototypePollutionKey('constructor')).toBe(true);
    expect(isPrototypePollutionKey('prototype')).toBe(true);
    expect(isPrototypePollutionKey('normalKey')).toBe(false);
  });

  it('merge ignores prototype pollution keys', () => {
    const malicious = JSON.parse('{"__proto__": {"polluted": true}}');
    const result = utils.merge({}, malicious);

    // The result itself should not contain the polluted property
    expect((result as Record<string, unknown>).polluted).toBeUndefined();

    // Should not pollute Object prototype
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    // The key should not be an own property of the result
    expect(Object.prototype.hasOwnProperty.call(result, '__proto__')).toBe(false);
  });

  it('merge ignores constructor pollution', () => {
    const malicious = JSON.parse('{"constructor": {"polluted": true}}');
    const result = utils.merge({}, malicious);

    // Constructor should not be an own property with polluted value
    expect(Object.prototype.hasOwnProperty.call(result, 'constructor')).toBe(false);
  });

  it('merge ignores prototype key', () => {
    const malicious = JSON.parse('{"prototype": {"polluted": true}}');
    const result = utils.merge({}, malicious);

    expect(Object.prototype.hasOwnProperty.call(result, 'prototype')).toBe(false);
  });
});

describe('utils/debounce cancel', () => {
  it('debounce.cancel prevents pending invocation', async () => {
    let callCount = 0;
    const debounced = utils.debounce(() => {
      callCount++;
    }, 50);

    debounced();
    debounced.cancel();

    await new Promise((r) => setTimeout(r, 100));
    expect(callCount).toBe(0);
  });

  it('debounce.cancel is safe to call multiple times', () => {
    const debounced = utils.debounce(() => {}, 50);
    debounced.cancel();
    debounced.cancel(); // Should not throw
  });
});

describe('utils/throttle cancel', () => {
  it('throttle.cancel resets timer allowing immediate execution', () => {
    let callCount = 0;
    const throttled = utils.throttle(() => {
      callCount++;
    }, 10000);

    throttled(); // First call executes
    expect(callCount).toBe(1);

    throttled(); // Throttled, should not execute
    expect(callCount).toBe(1);

    throttled.cancel(); // Reset throttle

    throttled(); // Should execute immediately after cancel
    expect(callCount).toBe(2);
  });
});

describe('utils/array helpers', () => {
  it('ensureArray wraps single values, passes arrays through, and returns [] for nullish', () => {
    expect(utils.ensureArray('a')).toEqual(['a']);
    expect(utils.ensureArray(['a', 'b'])).toEqual(['a', 'b']);
    expect(utils.ensureArray(null)).toEqual([]);
    expect(utils.ensureArray(undefined)).toEqual([]);
    expect(utils.ensureArray(0)).toEqual([0]);
    expect(utils.ensureArray(false)).toEqual([false]);
  });

  it('ensureArray returns the same reference for arrays (no copy)', () => {
    const source = [1, 2, 3];
    expect(utils.ensureArray(source)).toBe(source);
  });

  it('unique deduplicates primitives while preserving first-seen order', () => {
    expect(utils.unique([1, 2, 2, 3, 1])).toEqual([1, 2, 3]);
    expect(utils.unique(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c']);
    expect(utils.unique([])).toEqual([]);
  });

  it('unique uses reference identity for object entries', () => {
    const obj = { x: 1 };
    expect(utils.unique([obj, obj, { x: 1 }])).toHaveLength(2);
  });

  it('chunk splits arrays into evenly sized groups, with a smaller tail when needed', () => {
    expect(utils.chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(utils.chunk([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ]);
    expect(utils.chunk([], 3)).toEqual([]);
  });

  it('chunk returns [] for non-positive sizes', () => {
    expect(utils.chunk([1, 2, 3], 0)).toEqual([]);
    expect(utils.chunk([1, 2, 3], -1)).toEqual([]);
  });

  it('compact removes falsy values but keeps truthy zero-equivalents like "0"', () => {
    expect(utils.compact([0, 1, '', 'ok', null, undefined, false, 'x'])).toEqual([1, 'ok', 'x']);
    expect(utils.compact(['0', 0, '0'])).toEqual(['0', '0']);
  });

  it('flatten unwraps one level only — nested arrays at deeper levels stay nested', () => {
    expect(utils.flatten([1, [2, 3], 4])).toEqual([1, 2, 3, 4]);
    expect(utils.flatten([[1], [2, [3, 4]], 5])).toEqual([1, 2, [3, 4], 5]);
    expect(utils.flatten([])).toEqual([]);
  });
});

describe('utils/number helpers', () => {
  it('inRange respects inclusive bounds by default', () => {
    expect(utils.inRange(5, 1, 10)).toBe(true);
    expect(utils.inRange(1, 1, 10)).toBe(true);
    expect(utils.inRange(10, 1, 10)).toBe(true);
    expect(utils.inRange(0, 1, 10)).toBe(false);
    expect(utils.inRange(11, 1, 10)).toBe(false);
  });

  it('inRange with inclusive=false excludes the bounds', () => {
    expect(utils.inRange(1, 1, 10, false)).toBe(false);
    expect(utils.inRange(10, 1, 10, false)).toBe(false);
    expect(utils.inRange(5, 1, 10, false)).toBe(true);
  });

  it('toNumber converts numeric strings and passes numbers through', () => {
    expect(utils.toNumber('42')).toBe(42);
    expect(utils.toNumber(' 3.14 ')).toBeCloseTo(3.14);
    expect(utils.toNumber(7)).toBe(7);
    expect(utils.toNumber('-2.5')).toBe(-2.5);
  });

  it('toNumber falls back when conversion yields NaN', () => {
    expect(utils.toNumber('nope')).toBe(0);
    expect(utils.toNumber('nope', 10)).toBe(10);
    expect(utils.toNumber(undefined, -1)).toBe(-1);
    expect(utils.toNumber(NaN, 99)).toBe(99);
  });
});

describe('utils/string helpers', () => {
  it('truncate keeps strings shorter than maxLength untouched', () => {
    expect(utils.truncate('hello', 10)).toBe('hello');
    expect(utils.truncate('hello', 5)).toBe('hello');
  });

  it('truncate adds the default ellipsis suffix when shortening', () => {
    expect(utils.truncate('Hello world', 8)).toBe('Hello w…');
  });

  it('truncate accepts a custom suffix and accounts for its length', () => {
    expect(utils.truncate('Hello world', 8, '...')).toBe('Hello...');
  });

  it('truncate returns "" for non-positive maxLength', () => {
    expect(utils.truncate('hello', 0)).toBe('');
    expect(utils.truncate('hello', -3)).toBe('');
  });

  it('slugify lowercases, strips diacritics and punctuation, and joins with hyphens', () => {
    expect(utils.slugify('Hello, World!')).toBe('hello-world');
    expect(utils.slugify('Crème Brûlée')).toBe('creme-brulee');
    expect(utils.slugify('  spaced   out  ')).toBe('spaced-out');
    expect(utils.slugify('snake_case and-kebab')).toBe('snake-case-and-kebab');
  });

  it('slugify returns "" for input that has no slug-safe characters', () => {
    expect(utils.slugify('!!!')).toBe('');
  });

  it('escapeRegExp escapes every regex metacharacter', () => {
    expect(utils.escapeRegExp('[a-z]+')).toBe('\\[a-z\\]\\+');
    expect(utils.escapeRegExp('a.b*c?')).toBe('a\\.b\\*c\\?');
    expect(utils.escapeRegExp('plain')).toBe('plain');
  });

  it('escapeRegExp output is safe to pass to new RegExp()', () => {
    const needle = 'foo.bar(baz)';
    const re = new RegExp(utils.escapeRegExp(needle));
    expect(re.test('xx foo.bar(baz) yy')).toBe(true);
    expect(re.test('xx fooXbarYbazZ yy')).toBe(false);
  });
});
