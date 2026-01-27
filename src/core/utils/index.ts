/**
 * Utility helpers used across the framework.
 * These are intentionally small and framework-agnostic to keep the core tiny.
 *
 * @module bquery/core/utils
 */

export * from './array';
export * from './function';
export * from './misc';
export * from './number';
export * from './object';
export * from './string';
export * from './type-guards';

import { chunk, compact, ensureArray, flatten, unique } from './array';
import { debounce, noop, once, throttle } from './function';
import { isEmpty, parseJson, sleep, uid } from './misc';
import { clamp, inRange, randomInt, toNumber } from './number';
import { clone, hasOwn, isPlainObject, merge, omit, pick } from './object';
import { capitalize, escapeRegExp, slugify, toCamelCase, toKebabCase, truncate } from './string';
import {
  isArray,
  isBoolean,
  isCollection,
  isDate,
  isElement,
  isFunction,
  isNumber,
  isObject,
  isPromise,
  isString,
} from './type-guards';

/**
 * Utility object containing common helper functions.
 * All utilities are designed to be tree-shakeable and have zero dependencies.
 *
 * Note: `isPrototypePollutionKey` is intentionally excluded from this namespace
 * as it is an internal security helper. It remains available as a named export
 * for internal framework use.
 */
export const utils = {
  clone,
  merge,
  pick,
  omit,
  hasOwn,
  debounce,
  throttle,
  once,
  noop,
  uid,
  isElement,
  isCollection,
  isEmpty,
  isPlainObject,
  isFunction,
  isString,
  isNumber,
  isBoolean,
  isArray,
  isDate,
  isPromise,
  isObject,
  parseJson,
  sleep,
  randomInt,
  clamp,
  inRange,
  toNumber,
  capitalize,
  toKebabCase,
  toCamelCase,
  truncate,
  slugify,
  escapeRegExp,
  ensureArray,
  unique,
  chunk,
  compact,
  flatten,
};
