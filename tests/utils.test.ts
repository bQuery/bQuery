import { describe, expect, it } from 'bun:test';
import { utils } from '../src/core/utils';

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
    for (let i = 0; i < 100; i++) {
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
