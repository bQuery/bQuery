/**
 * Shared helpers for parsing route path params and constraints.
 * @internal
 */

/** Validates whether a character can start a route param name. @internal */
export const isParamStart = (char: string | undefined): boolean =>
  char !== undefined &&
  ((char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || char === '_');

/** Validates whether a character can appear after the start of a route param name. @internal */
export const isParamChar = (char: string | undefined): boolean =>
  isParamStart(char) || (char !== undefined && char >= '0' && char <= '9');

/** Reads a route param constraint while preserving escaped chars and nested groups. @internal */
export const readConstraint = (
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
