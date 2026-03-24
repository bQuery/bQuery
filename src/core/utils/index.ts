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
 * Describes the public shape of the aggregated {@link utils} namespace.
 *
 * Every member maps 1-to-1 to a named export from one of the sub-modules
 * (`array`, `function`, `misc`, `number`, `object`, `string`, `type-guards`).
 *
 * `isPrototypePollutionKey` is intentionally excluded as it is an
 * internal security helper. It remains available as a named export for
 * internal framework use.
 */
export interface BQueryUtils {
  // ── object ──────────────────────────────────────────────────────────
  readonly clone: typeof clone;
  readonly merge: typeof merge;
  readonly pick: typeof pick;
  readonly omit: typeof omit;
  readonly hasOwn: typeof hasOwn;
  readonly isPlainObject: typeof isPlainObject;

  // ── function ────────────────────────────────────────────────────────
  readonly debounce: typeof debounce;
  readonly throttle: typeof throttle;
  readonly once: typeof once;
  readonly noop: typeof noop;

  // ── misc ────────────────────────────────────────────────────────────
  readonly uid: typeof uid;
  readonly isEmpty: typeof isEmpty;
  readonly parseJson: typeof parseJson;
  readonly sleep: typeof sleep;

  // ── type-guards ─────────────────────────────────────────────────────
  readonly isElement: typeof isElement;
  readonly isCollection: typeof isCollection;
  readonly isFunction: typeof isFunction;
  readonly isString: typeof isString;
  readonly isNumber: typeof isNumber;
  readonly isBoolean: typeof isBoolean;
  readonly isArray: typeof isArray;
  readonly isDate: typeof isDate;
  readonly isPromise: typeof isPromise;
  readonly isObject: typeof isObject;

  // ── number ──────────────────────────────────────────────────────────
  readonly randomInt: typeof randomInt;
  readonly clamp: typeof clamp;
  readonly inRange: typeof inRange;
  readonly toNumber: typeof toNumber;

  // ── string ──────────────────────────────────────────────────────────
  readonly capitalize: typeof capitalize;
  readonly toKebabCase: typeof toKebabCase;
  readonly toCamelCase: typeof toCamelCase;
  readonly truncate: typeof truncate;
  readonly slugify: typeof slugify;
  readonly escapeRegExp: typeof escapeRegExp;

  // ── array ───────────────────────────────────────────────────────────
  readonly ensureArray: typeof ensureArray;
  readonly unique: typeof unique;
  readonly chunk: typeof chunk;
  readonly compact: typeof compact;
  readonly flatten: typeof flatten;
}

/**
 * Utility object containing common helper functions.
 * All utilities are designed to be tree-shakeable and have zero dependencies.
 *
 * Note: `isPrototypePollutionKey` is intentionally excluded from this namespace
 * as it is an internal security helper. It remains available as a named export
 * for internal framework use.
 */
export const utils: BQueryUtils = {
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
