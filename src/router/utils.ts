/**
 * Router utilities.
 * @module bquery/router
 */

import { computed, type ReadonlySignal } from '../reactive/index';
import { getActiveRouter, routeSignal } from './state';
import type { RouteDefinition } from './types';

// ============================================================================
// Utilities
// ============================================================================

/** Validates whether a character can start a route param name. @internal */
const isParamStart = (char: string | undefined): boolean =>
  char !== undefined &&
  ((char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || char === '_');

/** Validates whether a character can appear after the start of a route param name. @internal */
const isParamChar = (char: string | undefined): boolean =>
  isParamStart(char) || (char !== undefined && char >= '0' && char <= '9');

/** Reads a route param constraint while preserving escaped chars and nested groups. @internal */
const readConstraint = (
  path: string,
  startIndex: number
): { constraint: string; endIndex: number } | null => {
  let depth = 1;
  let constraint = '';
  let i = startIndex + 1;

  while (i < path.length) {
    const char = path[i];

    if (char === '\\' && i + 1 < path.length) {
      constraint += char + path[i + 1];
      i += 2;
      continue;
    }

    if (char === '(') {
      depth++;
    } else if (char === ')') {
      depth--;
      if (depth === 0) {
        return { constraint, endIndex: i + 1 };
      }
    }

    constraint += char;
    i++;
  }

  return null;
};

/**
 * Flattens nested routes into a single array with full paths.
 * Does NOT include the router base - base is only for browser history.
 * @internal
 */
export const flattenRoutes = (routes: RouteDefinition[], parentPath = ''): RouteDefinition[] => {
  const result: RouteDefinition[] = [];

  for (const route of routes) {
    const fullPath = route.path === '*' ? '*' : `${parentPath}${route.path}`.replace(/\/+/g, '/');

    result.push({
      ...route,
      path: fullPath,
    });

    if (route.children) {
      result.push(...flattenRoutes(route.children, fullPath));
    }
  }

  return result;
};

/**
 * Resolves a route by name and params.
 *
 * @param name - The route name
 * @param params - Route params to interpolate
 * @returns The resolved path
 *
 * @example
 * ```ts
 * import { resolve } from 'bquery/router';
 *
 * const path = resolve('user', { id: '42' });
 * // Returns '/user/42' if route is defined as { name: 'user', path: '/user/:id' }
 * ```
 */
export const resolve = (name: string, params: Record<string, string> = {}): string => {
  const activeRouter = getActiveRouter();
  if (!activeRouter) {
    throw new Error('bQuery router: No router initialized.');
  }

  const route = activeRouter.routes.find((r) => r.name === name);
  if (!route) {
    throw new Error(`bQuery router: Route "${name}" not found.`);
  }

  let path = '';
  for (let i = 0; i < route.path.length; ) {
    if (route.path[i] === ':' && isParamStart(route.path[i + 1])) {
      let nameEnd = i + 2;
      while (nameEnd < route.path.length && isParamChar(route.path[nameEnd])) {
        nameEnd++;
      }

      let nextIndex = nameEnd;
      if (route.path[nameEnd] === '(') {
        const parsedConstraint = readConstraint(route.path, nameEnd);
        if (parsedConstraint) {
          nextIndex = parsedConstraint.endIndex;
        }
      }

      const key = route.path.slice(i + 1, nameEnd);
      const value = params[key];
      if (value === undefined) {
        throw new Error(`bQuery router: Missing required param "${key}" for route "${name}".`);
      }

      path += encodeURIComponent(value);
      i = nextIndex;
      continue;
    }

    path += route.path[i];
    i++;
  }

  return path;
};

/**
 * Checks if a path matches the current route.
 *
 * @param path - Path to check
 * @param exact - Whether to match exactly (default: false)
 * @returns True if the path matches
 *
 * @example
 * ```ts
 * import { isActive } from 'bquery/router';
 *
 * if (isActive('/dashboard')) {
 *   // Highlight nav item
 * }
 * ```
 */
export const isActive = (path: string, exact = false): boolean => {
  const current = routeSignal.value.path;
  return exact ? current === path : current.startsWith(path);
};

/**
 * Creates a computed signal that checks if a path is active.
 *
 * @param path - Path to check
 * @param exact - Whether to match exactly
 * @returns A reactive signal
 *
 * @example
 * ```ts
 * import { isActiveSignal } from 'bquery/router';
 * import { effect } from 'bquery/reactive';
 *
 * const dashboardActive = isActiveSignal('/dashboard');
 * effect(() => {
 *   navItem.classList.toggle('active', dashboardActive.value);
 * });
 * ```
 */
export const isActiveSignal = (path: string, exact = false): ReadonlySignal<boolean> => {
  return computed(() => {
    const current = routeSignal.value.path;
    return exact ? current === path : current.startsWith(path);
  });
};
