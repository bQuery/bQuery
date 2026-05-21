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

import {
  chunk,
  chunkBy,
  compact,
  difference,
  drop,
  ensureArray,
  first,
  flatten,
  flattenDeep,
  groupBy,
  intersection,
  keyBy,
  last,
  move,
  partition,
  range,
  sample,
  shuffle,
  sortBy,
  take,
  unique,
  uniqueBy,
  zip,
} from './array';
import {
  compose,
  curry,
  debounce,
  memoize,
  noop,
  once,
  partial,
  pipe,
  retry,
  throttle,
} from './function';
import {
  isEmpty,
  nextFrame,
  nextTick,
  parseJson,
  pollUntil,
  sleep,
  times,
  tryCatch,
  uid,
  uuid,
} from './misc';
import {
  average,
  clamp,
  degToRad,
  formatBytes,
  inRange,
  inverseLerp,
  lerp,
  mapRange,
  median,
  radToDeg,
  randomFloat,
  randomInt,
  round,
  roundTo,
  sum,
  toNumber,
} from './number';
import {
  clone,
  deepEqual,
  defaults,
  entriesTyped,
  freeze,
  get,
  has,
  hasOwn,
  invert,
  isEqual,
  isPlainObject,
  keysTyped,
  mapKeys,
  mapValues,
  merge,
  omit,
  pick,
  set,
} from './object';
import {
  capitalize,
  escapeRegExp,
  lines,
  pad,
  padEnd,
  padStart,
  randomString,
  slugify,
  stripHtml,
  template,
  toCamelCase,
  toKebabCase,
  toPascalCase,
  toSnakeCase,
  toTitleCase,
  truncate,
  wordCount,
} from './string';
import {
  isArray,
  isAsyncFunction,
  isAsyncIterable,
  isBigInt,
  isBoolean,
  isCollection,
  isDate,
  isDefined,
  isElement,
  isError,
  isFunction,
  isIterable,
  isMap,
  isNullish,
  isNumber,
  isObject,
  isPromise,
  isRegExp,
  isSet,
  isString,
  isSymbol,
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
  readonly get: typeof get;
  readonly set: typeof set;
  readonly has: typeof has;
  readonly mapValues: typeof mapValues;
  readonly mapKeys: typeof mapKeys;
  readonly invert: typeof invert;
  readonly deepEqual: typeof deepEqual;
  readonly isEqual: typeof isEqual;
  readonly freeze: typeof freeze;
  readonly defaults: typeof defaults;
  readonly entriesTyped: typeof entriesTyped;
  readonly keysTyped: typeof keysTyped;

  // ── function ────────────────────────────────────────────────────────
  readonly debounce: typeof debounce;
  readonly throttle: typeof throttle;
  readonly once: typeof once;
  readonly noop: typeof noop;
  readonly memoize: typeof memoize;
  readonly compose: typeof compose;
  readonly pipe: typeof pipe;
  readonly curry: typeof curry;
  readonly partial: typeof partial;
  readonly retry: typeof retry;

  // ── misc ────────────────────────────────────────────────────────────
  readonly uid: typeof uid;
  readonly isEmpty: typeof isEmpty;
  readonly parseJson: typeof parseJson;
  readonly sleep: typeof sleep;
  readonly uuid: typeof uuid;
  readonly tryCatch: typeof tryCatch;
  readonly times: typeof times;
  readonly pollUntil: typeof pollUntil;
  readonly nextFrame: typeof nextFrame;
  readonly nextTick: typeof nextTick;

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
  readonly isError: typeof isError;
  readonly isMap: typeof isMap;
  readonly isSet: typeof isSet;
  readonly isRegExp: typeof isRegExp;
  readonly isSymbol: typeof isSymbol;
  readonly isBigInt: typeof isBigInt;
  readonly isAsyncFunction: typeof isAsyncFunction;
  readonly isIterable: typeof isIterable;
  readonly isAsyncIterable: typeof isAsyncIterable;
  readonly isNullish: typeof isNullish;
  readonly isDefined: typeof isDefined;

  // ── number ──────────────────────────────────────────────────────────
  readonly randomInt: typeof randomInt;
  readonly clamp: typeof clamp;
  readonly inRange: typeof inRange;
  readonly toNumber: typeof toNumber;
  readonly round: typeof round;
  readonly roundTo: typeof roundTo;
  readonly lerp: typeof lerp;
  readonly inverseLerp: typeof inverseLerp;
  readonly mapRange: typeof mapRange;
  readonly formatBytes: typeof formatBytes;
  readonly randomFloat: typeof randomFloat;
  readonly sum: typeof sum;
  readonly average: typeof average;
  readonly median: typeof median;
  readonly degToRad: typeof degToRad;
  readonly radToDeg: typeof radToDeg;

  // ── string ──────────────────────────────────────────────────────────
  readonly capitalize: typeof capitalize;
  readonly toKebabCase: typeof toKebabCase;
  readonly toCamelCase: typeof toCamelCase;
  readonly toSnakeCase: typeof toSnakeCase;
  readonly toPascalCase: typeof toPascalCase;
  readonly toTitleCase: typeof toTitleCase;
  readonly truncate: typeof truncate;
  readonly slugify: typeof slugify;
  readonly escapeRegExp: typeof escapeRegExp;
  readonly pad: typeof pad;
  readonly padStart: typeof padStart;
  readonly padEnd: typeof padEnd;
  readonly wordCount: typeof wordCount;
  readonly template: typeof template;
  readonly stripHtml: typeof stripHtml;
  readonly randomString: typeof randomString;
  readonly lines: typeof lines;

  // ── array ───────────────────────────────────────────────────────────
  readonly ensureArray: typeof ensureArray;
  readonly unique: typeof unique;
  readonly chunk: typeof chunk;
  readonly compact: typeof compact;
  readonly flatten: typeof flatten;
  readonly groupBy: typeof groupBy;
  readonly keyBy: typeof keyBy;
  readonly partition: typeof partition;
  readonly zip: typeof zip;
  readonly range: typeof range;
  readonly first: typeof first;
  readonly last: typeof last;
  readonly take: typeof take;
  readonly drop: typeof drop;
  readonly sample: typeof sample;
  readonly shuffle: typeof shuffle;
  readonly uniqueBy: typeof uniqueBy;
  readonly sortBy: typeof sortBy;
  readonly intersection: typeof intersection;
  readonly difference: typeof difference;
  readonly flattenDeep: typeof flattenDeep;
  readonly move: typeof move;
  readonly chunkBy: typeof chunkBy;
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
  // ── object ──
  clone,
  merge,
  pick,
  omit,
  hasOwn,
  isPlainObject,
  get,
  set,
  has,
  mapValues,
  mapKeys,
  invert,
  deepEqual,
  isEqual,
  freeze,
  defaults,
  entriesTyped,
  keysTyped,
  // ── function ──
  debounce,
  throttle,
  once,
  noop,
  memoize,
  compose,
  pipe,
  curry,
  partial,
  retry,
  // ── misc ──
  uid,
  isEmpty,
  parseJson,
  sleep,
  uuid,
  tryCatch,
  times,
  pollUntil,
  nextFrame,
  nextTick,
  // ── type-guards ──
  isElement,
  isCollection,
  isFunction,
  isString,
  isNumber,
  isBoolean,
  isArray,
  isDate,
  isPromise,
  isObject,
  isError,
  isMap,
  isSet,
  isRegExp,
  isSymbol,
  isBigInt,
  isAsyncFunction,
  isIterable,
  isAsyncIterable,
  isNullish,
  isDefined,
  // ── number ──
  randomInt,
  clamp,
  inRange,
  toNumber,
  round,
  roundTo,
  lerp,
  inverseLerp,
  mapRange,
  formatBytes,
  randomFloat,
  sum,
  average,
  median,
  degToRad,
  radToDeg,
  // ── string ──
  capitalize,
  toKebabCase,
  toCamelCase,
  toSnakeCase,
  toPascalCase,
  toTitleCase,
  truncate,
  slugify,
  escapeRegExp,
  pad,
  padStart,
  padEnd,
  wordCount,
  template,
  stripHtml,
  randomString,
  lines,
  // ── array ──
  ensureArray,
  unique,
  chunk,
  compact,
  flatten,
  groupBy,
  keyBy,
  partition,
  zip,
  range,
  first,
  last,
  take,
  drop,
  sample,
  shuffle,
  uniqueBy,
  sortBy,
  intersection,
  difference,
  flattenDeep,
  move,
  chunkBy,
};
