import { describe, expect, it } from 'bun:test';
import {
  isAsyncFunction,
  isAsyncIterable,
  isBigInt,
  isDefined,
  isError,
  isIterable,
  isMap,
  isNullish,
  isRegExp,
  isSet,
  isSymbol,
} from '../src/core/utils/type-guards';

describe('utils/type-guards extras', () => {
  it('isError', () => {
    expect(isError(new Error('x'))).toBe(true);
    expect(isError(new TypeError('y'))).toBe(true);
    expect(isError('error')).toBe(false);
  });

  it('isMap / isSet / isRegExp', () => {
    expect(isMap(new Map())).toBe(true);
    expect(isMap({})).toBe(false);
    expect(isSet(new Set())).toBe(true);
    expect(isSet([])).toBe(false);
    expect(isRegExp(/x/)).toBe(true);
    expect(isRegExp('x')).toBe(false);
  });

  it('isSymbol / isBigInt', () => {
    expect(isSymbol(Symbol('a'))).toBe(true);
    expect(isSymbol('a')).toBe(false);
    expect(isBigInt(1n)).toBe(true);
    expect(isBigInt(1)).toBe(false);
  });

  it('isAsyncFunction', () => {
    expect(isAsyncFunction(async () => 1)).toBe(true);
    expect(isAsyncFunction(() => 1)).toBe(false);
    expect(isAsyncFunction(null)).toBe(false);
  });

  it('isIterable / isAsyncIterable', () => {
    expect(isIterable([1, 2])).toBe(true);
    expect(isIterable('hello')).toBe(true);
    expect(isIterable(123)).toBe(false);
    expect(isIterable(null)).toBe(false);
    async function* gen() {
      yield 1;
    }
    expect(isAsyncIterable(gen())).toBe(true);
    expect(isAsyncIterable([])).toBe(false);
  });

  it('isNullish / isDefined', () => {
    expect(isNullish(null)).toBe(true);
    expect(isNullish(undefined)).toBe(true);
    expect(isNullish(0)).toBe(false);
    expect(isDefined(0)).toBe(true);
    expect(isDefined('')).toBe(true);
    expect(isDefined(null)).toBe(false);
    expect(isDefined(undefined)).toBe(false);
  });
});
