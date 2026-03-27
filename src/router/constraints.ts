/**
 * Shared helpers for validating and normalizing route param constraints.
 * @internal
 */

const normalizedConstraintCache = new Map<string, string>();
const compiledConstraintRegexCache = new Map<string, RegExp>();

/**
 * Detects potentially super-linear (ReDoS) patterns such as nested quantifiers.
 * Rejects constraints like `(a+)+`, `(a*)*`, or `(a|a)*` that can cause
 * catastrophic backtracking.
 * @internal
 */
const hasNestedQuantifier = (pattern: string): boolean => {
  let groupDepth = 0;
  let hasInnerQuantifier = false;
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
      groupDepth++;
      hasInnerQuantifier = false;
      continue;
    }

    if (ch === ')') {
      groupDepth--;
      // Check if the closing paren is followed by a quantifier
      const next = pattern[i + 1];
      if (hasInnerQuantifier && (next === '+' || next === '*' || next === '{')) {
        return true;
      }
      continue;
    }

    if (groupDepth > 0 && (ch === '+' || ch === '*' || ch === '{')) {
      hasInnerQuantifier = true;
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
        throw new Error('bQuery router: Route constraints cannot use backreferences.');
      }

      if (!inCharacterClass && constraint[i + 1] === 'k' && constraint[i + 2] === '<') {
        throw new Error('bQuery router: Route constraints cannot use backreferences.');
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
            throw new Error('bQuery router: Invalid route constraint named capture group.');
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
  normalizedConstraintCache.set(constraint, normalized);
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
      'bQuery router: Route constraint contains a potentially catastrophic (ReDoS) pattern. Nested quantifiers are not allowed.'
    );
  }

  const compiled = new RegExp(`^(?:${normalizedConstraint})$`);
  compiledConstraintRegexCache.set(normalizedConstraint, compiled);
  return compiled;
};

export const routeConstraintMatches = (constraint: string, value: string): boolean => {
  return getRouteConstraintRegex(constraint).test(value);
};
