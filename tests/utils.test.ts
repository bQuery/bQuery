import { describe, expect, it } from 'bun:test';
import { isPrototypePollutionKey, utils } from '../src/core/utils';

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
    expect(Object.hasOwn(result, '__proto__')).toBe(false);
  });

  it('merge ignores constructor pollution', () => {
    const malicious = JSON.parse('{"constructor": {"polluted": true}}');
    const result = utils.merge({}, malicious);

    // Constructor should not be an own property with polluted value
    expect(Object.hasOwn(result, 'constructor')).toBe(false);
  });

  it('merge ignores prototype key', () => {
    const malicious = JSON.parse('{"prototype": {"polluted": true}}');
    const result = utils.merge({}, malicious);

    expect(Object.hasOwn(result, 'prototype')).toBe(false);
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
