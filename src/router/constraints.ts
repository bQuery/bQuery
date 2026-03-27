/**
 * Shared helpers for validating and normalizing route param constraints.
 * @internal
 */

const normalizeConstraintCaptures = (constraint: string): string => {
  let normalized = '';
  let inCharacterClass = false;

  for (let i = 0; i < constraint.length; i++) {
    const char = constraint[i];

    if (char === '\\' && i + 1 < constraint.length) {
      if (!inCharacterClass && constraint[i + 1] >= '1' && constraint[i + 1] <= '9') {
        throw new Error(
          'bQuery router: Route constraints cannot use backreferences.'
        );
      }

      if (!inCharacterClass && constraint[i + 1] === 'k' && constraint[i + 2] === '<') {
        throw new Error(
          'bQuery router: Route constraints cannot use backreferences.'
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
  return normalizeConstraintCaptures(constraint);
};

export const routeConstraintMatches = (
  constraint: string,
  value: string
): boolean => {
  return new RegExp(`^(?:${normalizeConstraintCaptures(constraint)})$`).test(value);
};
