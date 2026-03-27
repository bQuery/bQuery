/**
 * Route matching helpers.
 * @module bquery/router
 */

import { parseQuery } from './query';
import { getNormalizedRouteConstraint } from './constraints';
import { isParamChar, isParamStart, readConstraint } from './path-pattern';
import type { Route, RouteDefinition } from './types';

// ============================================================================
// Route Matching
// ============================================================================

const REGEX_META_CHARS = new Set(['\\', '^', '$', '.', '*', '+', '?', '(', ')', '[', ']', '{', '}', '|']);

const escapeRegexLiteral = (value: string): string => {
  let escaped = '';
  for (const char of value) {
    escaped += REGEX_META_CHARS.has(char) ? `\\${char}` : char;
  }
  return escaped;
};

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

/**
 * Converts a route path pattern to a RegExp for matching.
 * Supports `:param` patterns, `:param(regex)` constraints, and `*` wildcards.
 * Uses placeholder approach to preserve patterns during escaping.
 * Returns positional capture groups for maximum compatibility.
 * @internal
 */
const pathToRegex = (path: string): RegExp => {
  // Handle wildcard-only route
  if (path === '*') {
    return /^.*$/;
  }

  let pattern = '';

  for (let i = 0; i < path.length; ) {
    const char = path[i];

    if (char === '*') {
      pattern += '.*';
      i++;
      continue;
    }

    if (char === ':' && isParamStart(path[i + 1])) {
      let nameEnd = i + 2;
      while (nameEnd < path.length && isParamChar(path[nameEnd])) {
        nameEnd++;
      }

      let nextIndex = nameEnd;
      let constraint = '[^/]+';

      if (path[nameEnd] === '(') {
        const parsedConstraint = readConstraintOrThrow(path, nameEnd);
        constraint = parsedConstraint.constraint;
        nextIndex = parsedConstraint.endIndex;
      }

      pattern += `(${getNormalizedRouteConstraint(constraint)})`;
      i = nextIndex;
      continue;
    }

    pattern += escapeRegexLiteral(char);
    i++;
  }

  return new RegExp(`^${pattern}$`);
};

/**
 * Extracts param names from a route path.
 * Handles both `:param` and `:param(regex)` syntax.
 * @internal
 */
const extractParamNames = (path: string): string[] => {
  const names: string[] = [];

  for (let i = 0; i < path.length; ) {
    if (path[i] !== ':' || !isParamStart(path[i + 1])) {
      i++;
      continue;
    }

    let nameEnd = i + 2;
    while (nameEnd < path.length && isParamChar(path[nameEnd])) {
      nameEnd++;
    }

    names.push(path.slice(i + 1, nameEnd));

    if (path[nameEnd] === '(') {
      const parsedConstraint = readConstraintOrThrow(path, nameEnd);
      i = parsedConstraint.endIndex;
      continue;
    }

    i = nameEnd;
  }

  return names;
};

/**
 * Matches a path against route definitions and extracts params.
 * Uses positional captures for maximum compatibility.
 * @internal
 */
export const matchRoute = (
  path: string,
  routes: RouteDefinition[]
): { matched: RouteDefinition; params: Record<string, string> } | null => {
  for (const route of routes) {
    const regex = pathToRegex(route.path);
    const match = path.match(regex);

    if (match) {
      const paramNames = extractParamNames(route.path);
      const params: Record<string, string> = {};

      // Map positional captures to param names
      paramNames.forEach((name, index) => {
        params[name] = match[index + 1] || '';
      });

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
