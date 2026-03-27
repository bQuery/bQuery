/**
 * Query string helpers.
 * @module bquery/router
 */

import { isPrototypePollutionKey } from '../core/utils/object';

/**
 * Parses query string into an object.
 * Single values are stored as strings, duplicate keys become arrays.
 * @internal
 *
 * @example
 * parseQuery('?foo=1') // { foo: '1' }
 * parseQuery('?tag=a&tag=b') // { tag: ['a', 'b'] }
 * parseQuery('?x=1&y=2&x=3') // { x: ['1', '3'], y: '2' }
 */
export const parseQuery = (search: string): Record<string, string | string[]> => {
  const query: Record<string, string | string[]> = {};
  const params = new URLSearchParams(search);

  params.forEach((value, key) => {
    if (isPrototypePollutionKey(key)) return;
    const existing = query[key];
    if (existing === undefined) {
      // First occurrence: store as string
      query[key] = value;
    } else if (Array.isArray(existing)) {
      // Already an array: append
      existing.push(value);
    } else {
      // Second occurrence: convert to array
      query[key] = [existing, value];
    }
  });

  return query;
};
