/**
 * Route matching helpers.
 * @module bquery/router
 */

import { parseQuery } from './query';
import { getNormalizedRouteConstraint } from './constraints';
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

const readParamDescriptor = (
  path: string,
  index: number
): RouteParamDescriptor | null => {
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
  for (let i = 0; i < path.length; ) {
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
};

const findSegmentBoundary = (value: string, startIndex: number): number => {
  const slashIndex = value.indexOf('/', startIndex);
  return slashIndex === -1 ? value.length : slashIndex;
};

const matchPathPattern = (
  routePath: string,
  actualPath: string
): Record<string, string> | null => {
  const memo = new Map<string, Record<string, string> | null>();

  const matchFrom = (
    routeIndex: number,
    pathIndex: number
  ): Record<string, string> | null => {
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
      for (let candidateEnd = actualPath.length; candidateEnd >= pathIndex; candidateEnd--) {
        const suffixMatch = matchFrom(routeIndex + 1, candidateEnd);
        if (suffixMatch) {
          memo.set(memoKey, suffixMatch);
          return suffixMatch;
        }
      }

      memo.set(memoKey, null);
      return null;
    }

    const param = readParamDescriptor(routePath, routeIndex);
    if (param) {
      const normalizedConstraint = param.constraint
        ? getNormalizedRouteConstraint(param.constraint)
        : undefined;
      const candidateLimit = param.constraint
        ? actualPath.length
        : findSegmentBoundary(actualPath, pathIndex);

      for (let candidateEnd = candidateLimit; candidateEnd > pathIndex; candidateEnd--) {
        const candidateValue = actualPath.slice(pathIndex, candidateEnd);

        if (normalizedConstraint) {
          const constraintRegex = new RegExp(`^(?:${normalizedConstraint})$`);
          if (!constraintRegex.test(candidateValue)) {
            continue;
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
  for (const route of routes) {
    validateRoutePathPattern(route.path);
    const params = matchPathPattern(route.path, path);
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
