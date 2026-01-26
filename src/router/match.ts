/**
 * Route matching helpers.
 * @module bquery/router
 */

import { parseQuery } from './query';
import type { Route, RouteDefinition } from './types';

// ============================================================================
// Route Matching
// ============================================================================

/**
 * Converts a route path pattern to a RegExp for matching.
 * Uses placeholder approach to preserve :param and * patterns during escaping.
 * Returns positional capture groups for maximum compatibility.
 * @internal
 */
const pathToRegex = (path: string): RegExp => {
  // Handle wildcard-only route
  if (path === '*') {
    return /^.*$/;
  }

  // Unique placeholders using null chars (won't appear in normal paths)
  const PARAM_MARKER = '\u0000P\u0000';
  const WILDCARD_MARKER = '\u0000W\u0000';

  // Step 1: Extract :param patterns before escaping
  let pattern = path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, () => {
    return PARAM_MARKER;
  });

  // Step 2: Extract * wildcards before escaping
  pattern = pattern.replace(/\*/g, WILDCARD_MARKER);

  // Step 3: Escape ALL regex metacharacters: \ ^ $ . * + ? ( ) [ ] { } |
  pattern = pattern.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');

  // Step 4: Restore param capture groups (positional, not named)
  pattern = pattern.replace(/\u0000P\u0000/g, () => `([^/]+)`);

  // Step 5: Restore wildcards as .*
  pattern = pattern.replace(/\u0000W\u0000/g, '.*');

  return new RegExp(`^${pattern}$`);
};

/**
 * Extracts param names from a route path.
 * @internal
 */
const extractParamNames = (path: string): string[] => {
  const matches = path.match(/:([a-zA-Z_][a-zA-Z0-9_]*)/g);
  return matches ? matches.map((m) => m.slice(1)) : [];
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
