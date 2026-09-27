/**
 * Route matching helpers.
 * @module bquery/router
 */

import { parseQuery } from './query';
import { getNormalizedRouteConstraint, getRouteConstraintRegex } from './constraints';
import { isParamChar, isParamStart, readConstraint } from './path-pattern';
import type { Route, RouteDefinition } from './types';

const readConstraintOrThrow = (
  path: string,
  startIndex: number
): { constraint: string; endIndex: number } => {
  const parsedConstraint = readConstraint(path, startIndex);
  if (!parsedConstraint) {
    throw new Error(
      `bQuery router: Invalid route param constraint syntax in path "${path}" at index ${startIndex}.`
    );
  }
  return parsedConstraint;
};

type RouteParamDescriptor = {
  name: string;
  constraint?: string;
  nextIndex: number;
};

const validatedRoutePathCache = new Set<string>();

const readParamDescriptor = (path: string, index: number): RouteParamDescriptor | null => {
  if (path[index] !== ':' || !isParamStart(path[index + 1])) {
    return null;
  }

  let nameEnd = index + 2;
  while (nameEnd < path.length && isParamChar(path[nameEnd])) {
    nameEnd++;
  }

  let nextIndex = nameEnd;
  let constraint: string | undefined;

  if (path[nameEnd] === '(') {
    const parsedConstraint = readConstraintOrThrow(path, nameEnd);
    constraint = parsedConstraint.constraint;
    nextIndex = parsedConstraint.endIndex;
  }

  return {
    name: path.slice(index + 1, nameEnd),
    constraint,
    nextIndex,
  };
};

const validateRoutePathPattern = (path: string): void => {
  if (validatedRoutePathCache.has(path)) {
    return;
  }

  for (let i = 0; i < path.length;) {
    const char = path[i];

    if (char === ':' && isParamStart(path[i + 1])) {
      const param = readParamDescriptor(path, i);
      if (param?.constraint) {
        getNormalizedRouteConstraint(param.constraint);
      }
      i = param?.nextIndex ?? i + 1;
      continue;
    }

    i++;
  }

  validatedRoutePathCache.add(path);
};

/**
 * Characters the WHATWG URL parser percent-encodes in a path: C0 controls,
 * space, `"`, `#`, `<`, `>`, `?`, `` ` ``, `{`, `}`, DEL and everything
 * outside ASCII. `location.pathname` always reports them encoded, so a route
 * written as `/über` has to be compared as `/%C3%BCber`.
 */
const PATH_ENCODED_CHAR = /[\u0000-\u0020"#<>?`{}\u007F-\u{10FFFF}]/u;

const encodedRoutePathCache = new Map<string, string>();

/**
 * Percent-encodes the static text of a route pattern the way the URL parser
 * encodes a pathname, leaving params, their constraints and `*` untouched.
 * Matching runs against the encoded pathname, so without this any route with
 * a non-ASCII or otherwise encoded static character could never match.
 */
const encodeRoutePathStatics = (path: string): string => {
  const cached = encodedRoutePathCache.get(path);
  if (cached !== undefined) return cached;

  let encoded = '';
  for (let i = 0; i < path.length;) {
    const param = readParamDescriptor(path, i);
    if (param) {
      encoded += path.slice(i, param.nextIndex);
      i = param.nextIndex;
      continue;
    }

    const codePoint = path.codePointAt(i) as number;
    const char = String.fromCodePoint(codePoint);
    encoded += PATH_ENCODED_CHAR.test(char) ? encodeURIComponent(char) : char;
    i += char.length;
  }

  encodedRoutePathCache.set(path, encoded);
  return encoded;
};

/**
 * Upper-cases the hex digits of every percent-escape, so `%c3%bc` (kept as
 * typed by the URL parser) compares equal to the `%C3%BC` that
 * `encodeURIComponent` produces for route statics.
 */
const normalizePercentEncoding = (path: string): string =>
  path.includes('%') ? path.replace(/%[0-9a-f]{2}/gi, (escape) => escape.toUpperCase()) : path;

/**
 * Decodes a captured param. Matching runs on the encoded pathname, so a param
 * must be decoded before it is exposed — `resolve()` encodes params, and
 * `route.params` has to round-trip to the value that was passed in. A
 * malformed escape (`%E0%A4%A`) is kept as-is rather than failing the whole
 * navigation.
 */
const decodeParamValue = (value: string): string => {
  if (!value.includes('%')) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const findSegmentBoundary = (value: string, startIndex: number): number => {
  const slashIndex = value.indexOf('/', startIndex);
  return slashIndex === -1 ? value.length : slashIndex;
};

const readNextStaticChunk = (path: string, startIndex: number): string => {
  let chunkEnd = startIndex;

  while (chunkEnd < path.length) {
    if (path[chunkEnd] === '*') {
      break;
    }

    if (path[chunkEnd] === ':' && isParamStart(path[chunkEnd + 1])) {
      break;
    }

    chunkEnd++;
  }

  return path.slice(startIndex, chunkEnd);
};

const findAnchoredCandidateEnds = (
  actualPath: string,
  startIndex: number,
  limit: number,
  nextStaticChunk: string
): number[] => {
  const candidates: number[] = [];
  let searchIndex = startIndex;

  while (searchIndex <= limit) {
    const candidateEnd = actualPath.indexOf(nextStaticChunk, searchIndex);
    if (candidateEnd === -1 || candidateEnd > limit) {
      break;
    }

    candidates.push(candidateEnd);
    searchIndex = candidateEnd + 1;
  }

  return candidates.reverse();
};

const matchPathPattern = (routePath: string, actualPath: string): Record<string, string> | null => {
  // Memoization keeps wildcard/param backtracking linear for repeated subproblems
  // within a single route/path match attempt.
  const memo = new Map<string, Record<string, string> | null>();

  const matchFrom = (routeIndex: number, pathIndex: number): Record<string, string> | null => {
    const memoKey = `${routeIndex}:${pathIndex}`;
    if (memo.has(memoKey)) {
      return memo.get(memoKey) ?? null;
    }

    if (routeIndex === routePath.length) {
      const result = pathIndex === actualPath.length ? {} : null;
      memo.set(memoKey, result);
      return result;
    }

    const routeChar = routePath[routeIndex];

    if (routeChar === '*') {
      if (routeIndex === routePath.length - 1) {
        const result = {};
        memo.set(memoKey, result);
        return result;
      }

      const nextStaticChunk = readNextStaticChunk(routePath, routeIndex + 1);
      const anchoredCandidateEnds =
        nextStaticChunk.length > 0
          ? findAnchoredCandidateEnds(actualPath, pathIndex, actualPath.length, nextStaticChunk)
          : null;

      const iterateCandidateEnds = anchoredCandidateEnds
        ? (callback: (candidateEnd: number) => Record<string, string> | null) => {
            for (const candidateEnd of anchoredCandidateEnds) {
              const result = callback(candidateEnd);
              if (result) {
                return result;
              }
            }
            return null;
          }
        : (callback: (candidateEnd: number) => Record<string, string> | null) => {
            for (let candidateEnd = actualPath.length; candidateEnd >= pathIndex; candidateEnd--) {
              const result = callback(candidateEnd);
              if (result) {
                return result;
              }
            }
            return null;
          };

      const wildcardMatch = iterateCandidateEnds((candidateEnd) => {
        const suffixMatch = matchFrom(routeIndex + 1, candidateEnd);
        if (suffixMatch) {
          memo.set(memoKey, suffixMatch);
          return suffixMatch;
        }
        return null;
      });

      if (wildcardMatch) {
        return wildcardMatch;
      }

      memo.set(memoKey, null);
      return null;
    }

    const param = readParamDescriptor(routePath, routeIndex);
    if (param) {
      const constraintRegex = param.constraint
        ? getRouteConstraintRegex(param.constraint)
        : undefined;
      const candidateLimit = param.constraint
        ? actualPath.length
        : findSegmentBoundary(actualPath, pathIndex);
      const nextStaticChunk = readNextStaticChunk(routePath, param.nextIndex);
      const anchoredCandidateEnds =
        nextStaticChunk.length > 0
          ? findAnchoredCandidateEnds(actualPath, pathIndex, candidateLimit, nextStaticChunk)
          : null;

      const iterateCandidateEnds = anchoredCandidateEnds
        ? (callback: (candidateEnd: number) => Record<string, string> | null) => {
            for (const candidateEnd of anchoredCandidateEnds) {
              if (candidateEnd <= pathIndex) {
                continue;
              }
              const result = callback(candidateEnd);
              if (result) {
                return result;
              }
            }
            return null;
          }
        : (callback: (candidateEnd: number) => Record<string, string> | null) => {
            for (let candidateEnd = candidateLimit; candidateEnd > pathIndex; candidateEnd--) {
              const result = callback(candidateEnd);
              if (result) {
                return result;
              }
            }
            return null;
          };

      const paramMatch = iterateCandidateEnds((candidateEnd) => {
        // Constraints see the decoded value — the same one `resolve()`
        // validates — so a constraint cannot pass there and fail here.
        const candidateValue = decodeParamValue(actualPath.slice(pathIndex, candidateEnd));

        if (constraintRegex) {
          if (!constraintRegex.test(candidateValue)) {
            return null;
          }
        }

        const suffixMatch = matchFrom(param.nextIndex, candidateEnd);
        if (suffixMatch) {
          const result = {
            [param.name]: candidateValue,
            ...suffixMatch,
          };
          memo.set(memoKey, result);
          return result;
        }
        return null;
      });

      if (paramMatch) {
        return paramMatch;
      }

      memo.set(memoKey, null);
      return null;
    }

    if (pathIndex >= actualPath.length || routeChar !== actualPath[pathIndex]) {
      memo.set(memoKey, null);
      return null;
    }

    const result = matchFrom(routeIndex + 1, pathIndex + 1);
    memo.set(memoKey, result);
    return result;
  };

  return matchFrom(0, 0);
};

/**
 * Matches a path against route definitions and extracts params.
 * @internal
 */
export const matchRoute = (
  path: string,
  routes: RouteDefinition[]
): { matched: RouteDefinition; params: Record<string, string> } | null => {
  const normalizedPath = normalizePercentEncoding(path);
  for (const route of routes) {
    validateRoutePathPattern(route.path);
    const params = matchPathPattern(encodeRoutePathStatics(route.path), normalizedPath);
    if (params) {
      return { matched: route, params };
    }
  }

  return null;
};

/**
 * Creates a Route object from the current URL.
 * @internal
 */
export const createRoute = (
  pathname: string,
  search: string,
  hash: string,
  routes: RouteDefinition[]
): Route => {
  const result = matchRoute(pathname, routes);

  return {
    path: pathname,
    params: result?.params ?? {},
    query: parseQuery(search),
    matched: result?.matched ?? null,
    hash: hash.replace(/^#/, ''),
  };
};
