/**
 * Shared helpers for validating and normalizing route param constraints.
 * @internal
 */

const MAX_ROUTE_CONSTRAINT_CACHE_SIZE = 128;
const normalizedConstraintCache = new Map<string, string>();
const compiledConstraintRegexCache = new Map<string, RegExp>();

const setBoundedCacheEntry = <T>(cache: Map<string, T>, key: string, value: T): void => {
  if (cache.has(key)) {
    cache.delete(key);
  }

  cache.set(key, value);

  if (cache.size <= MAX_ROUTE_CONSTRAINT_CACHE_SIZE) {
    return;
  }

  const oldestKey = cache.keys().next().value;
  if (oldestKey !== undefined) {
    cache.delete(oldestKey);
  }
};

/**
 * Detects potentially super-linear (ReDoS) patterns caused by quantified
 * groups that already contain inner quantifiers, such as `(a+)+` or `(a*)*`.
 * @internal
 */
const hasNestedQuantifier = (pattern: string): boolean => {
  const groupQuantifierStack: boolean[] = [];
  let inCharClass = false;

  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];

    if (ch === '\\' && i + 1 < pattern.length) {
      i++;
      continue;
    }

    if (ch === '[' && !inCharClass) {
      inCharClass = true;
      continue;
    }
    if (ch === ']' && inCharClass) {
      inCharClass = false;
      continue;
    }
    if (inCharClass) continue;

    if (ch === '(') {
      groupQuantifierStack.push(false);
      continue;
    }

    if (ch === ')') {
      const groupHasInnerQuantifier = groupQuantifierStack.pop() ?? false;
      // Check if the closing paren is followed by a quantifier
      const next = pattern[i + 1];
      if (groupHasInnerQuantifier && (next === '+' || next === '*' || next === '?' || next === '{')) {
        return true;
      }
      if (groupHasInnerQuantifier && groupQuantifierStack.length > 0) {
        groupQuantifierStack[groupQuantifierStack.length - 1] = true;
      }
      continue;
    }

    if (groupQuantifierStack.length > 0) {
      if (ch === '?' && i > 0 && pattern[i - 1] === '(') {
        continue;
      }

      if (ch === '+' || ch === '*' || ch === '?' || ch === '{') {
        groupQuantifierStack[groupQuantifierStack.length - 1] = true;
      }
    }
  }

  return false;
};

const normalizeConstraintCaptures = (constraint: string): string => {
  let normalized = '';
  let inCharacterClass = false;

  for (let i = 0; i < constraint.length; i++) {
    const char = constraint[i];

    if (char === '\\' && i + 1 < constraint.length) {
      if (!inCharacterClass && constraint[i + 1] >= '1' && constraint[i + 1] <= '9') {
        throw new Error(
          `bQuery router: Route constraints cannot use backreferences: "${constraint}".`
        );
      }

      if (!inCharacterClass && constraint[i + 1] === 'k' && constraint[i + 2] === '<') {
        throw new Error(
          `bQuery router: Route constraints cannot use backreferences: "${constraint}".`
        );
      }

      normalized += char + constraint[i + 1];
      i++;
      continue;
    }

    if (char === '[' && !inCharacterClass) {
      inCharacterClass = true;
      normalized += char;
      continue;
    }

    if (char === ']' && inCharacterClass) {
      inCharacterClass = false;
      normalized += char;
      continue;
    }

    if (!inCharacterClass && char === '(') {
      if (i + 1 < constraint.length && constraint[i + 1] === '?') {
        if (constraint[i + 2] === '<') {
          if (constraint[i + 3] === '=' || constraint[i + 3] === '!') {
            normalized += '(';
            continue;
          }

          const namedCaptureEnd = constraint.indexOf('>', i + 3);
          if (namedCaptureEnd === -1) {
            throw new Error(
              `bQuery router: Invalid route constraint named capture group: "${constraint}".`
            );
          }
          normalized += '(?:';
          i = namedCaptureEnd;
          continue;
        }

        normalized += '(';
        continue;
      }

      normalized += '(?:';
      continue;
    }

    normalized += char;
  }

  return normalized;
};

export const getNormalizedRouteConstraint = (constraint: string): string => {
  const cached = normalizedConstraintCache.get(constraint);
  if (cached !== undefined) {
    return cached;
  }

  const normalized = normalizeConstraintCaptures(constraint);
  setBoundedCacheEntry(normalizedConstraintCache, constraint, normalized);
  return normalized;
};

export const getRouteConstraintRegex = (constraint: string): RegExp => {
  const normalizedConstraint = getNormalizedRouteConstraint(constraint);
  const cached = compiledConstraintRegexCache.get(normalizedConstraint);
  if (cached) {
    return cached;
  }

  if (hasNestedQuantifier(normalizedConstraint)) {
    throw new Error(
      `bQuery router: Route constraint contains a potentially catastrophic (ReDoS) pattern. Nested quantifiers are not allowed: "${constraint}".`
    );
  }

  try {
    const compiled = new RegExp(`^(?:${normalizedConstraint})$`);
    setBoundedCacheEntry(compiledConstraintRegexCache, normalizedConstraint, compiled);
    return compiled;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(
        `bQuery router: Invalid route constraint regex "${constraint}": ${error.message}`
      );
    }
    throw error;
  }
};

export const routeConstraintMatches = (constraint: string, value: string): boolean => {
  return getRouteConstraintRegex(constraint).test(value);
};

export const clearRouteConstraintCache = (): void => {
  normalizedConstraintCache.clear();
  compiledConstraintRegexCache.clear();
};
