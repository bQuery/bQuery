/**
 * Dependency-free splitting helpers for `bq-*` expression strings.
 *
 * Shared by the runtime evaluator and the optional ahead-of-time compiler
 * (`@bquery/bquery/view/compiler`). Keeping them here — rather than in
 * `evaluate.ts` — means the compiler does not pull the runtime evaluator
 * (its `new Function()` caches, context proxies and the reactive module) into
 * its bundle.
 *
 * @module bquery/view
 * @internal
 */

import { isPrototypePollutionKey } from '../core/utils/object';

/**
 * Splits `input` at every top-level `separator` character, skipping separators
 * inside quoted strings, template literals (including nested `${…}`
 * substitutions), and `()`/`[]`/`{}` nesting. Returns the trimmed, non-empty
 * parts, so empty segments (`a;;b`, a trailing `;`) are dropped.
 *
 * `//` and `/* … *\/` comments are skipped and left out of the parts, so a
 * separator, quote or bracket inside a comment does not count and a trailing
 * `// note` does not become a statement of its own.
 *
 * Shared by the object-syntax parser (`,`) and `bq-on` statement lists (`;`).
 * Regular-expression literals are not recognised: a separator, quote or
 * bracket inside a regex literal is read as code (so `/;/.test(s); next()`
 * or `/[(]/.test(s)` split wrongly), and a `//` or `/*` in one starts a
 * comment unless its first `/` is escaped, as in `/^https?:\/\//`. Build such a
 * regex in a method or with `new RegExp('…')` instead.
 * @internal
 */
export const splitTopLevel = (input: string, separator: string): string[] => {
  const parts: string[] = [];
  // Open brackets, plus '`' while inside a template literal body.
  const stack: string[] = [];
  let quote = '';
  let start = 0;
  // Text of the current part before the last skipped comment.
  let kept = '';

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const top = stack[stack.length - 1];
    if (quote) {
      // Inside a quoted string: skip escaped characters, find the end.
      if (char === '\\') i++;
      else if (char === quote) quote = '';
    } else if (top === '`') {
      // Inside a template body: `${` opens a nested expression.
      if (char === '\\') i++;
      else if (char === '`') stack.pop();
      else if (char === '$' && input[i + 1] === '{') {
        stack.push('{');
        i++;
      }
    } else if (
      char === '/' &&
      (input[i + 1] === '/' || input[i + 1] === '*') &&
      input[i - 1] !== '\\'
    ) {
      // A comment: drop it from the part (a line comment up to its newline).
      const close = input[i + 1] === '/' ? input.indexOf('\n', i) : input.indexOf('*/', i + 2);
      const end = close < 0 ? input.length : input[i + 1] === '/' ? close : close + 2;
      kept += `${input.slice(start, i)} `;
      start = end;
      i = end - 1;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '`' || char === '(' || char === '[' || char === '{') {
      stack.push(char);
    } else if (char === ')' || char === ']' || char === '}') {
      stack.pop();
    } else if (char === separator && stack.length === 0) {
      parts.push(kept + input.slice(start, i));
      kept = '';
      start = i + 1;
    }
  }
  parts.push(kept + input.slice(start));

  return parts.map((part) => part.trim()).filter(Boolean);
};

/**
 * Parses object expression like "{ active: isActive, disabled: !enabled }".
 * Handles nested structures like function calls, arrays, and template literals.
 * @internal
 */
export const parseObjectExpression = (expression: string): Record<string, string> => {
  const result: Record<string, string> = {};

  // Remove outer braces and trim
  const inner = expression
    .trim()
    .replace(/^\{|\}$/g, '')
    .trim();
  if (!inner) return result;

  // Split by comma at depth 0, respecting strings and nesting
  const parts = splitTopLevel(inner, ',');

  // Parse each part to extract key and value
  for (const part of parts) {
    // Find the first colon at depth 0 (to handle ternary operators in values)
    let colonIndex = -1;
    let partDepth = 0;
    let partInString: string | null = null;

    for (let i = 0; i < part.length; i++) {
      const char = part[i];

      if (char === '"' || char === "'" || char === '`') {
        let backslashCount = 0;
        let j = i - 1;
        while (j >= 0 && part[j] === '\\') {
          backslashCount++;
          j--;
        }
        if (backslashCount % 2 === 0) {
          if (partInString === null) {
            partInString = char;
          } else if (partInString === char) {
            partInString = null;
          }
        }
        continue;
      }

      if (partInString !== null) continue;

      if (char === '(' || char === '[' || char === '{') {
        partDepth++;
      } else if (char === ')' || char === ']' || char === '}') {
        partDepth--;
      } else if (char === ':' && partDepth === 0) {
        colonIndex = i;
        break;
      }
    }

    if (colonIndex > -1) {
      const key = part
        .slice(0, colonIndex)
        .trim()
        .replace(/^['"]|['"]$/g, '');
      if (isPrototypePollutionKey(key)) continue;
      const value = part.slice(colonIndex + 1).trim();
      result[key] = value;
    } else if (/^[A-Za-z_$][\w$]*$/.test(part)) {
      // Shorthand property: `{ active }` is equivalent to `{ active: active }`,
      // matching JS object-literal shorthand. Previously a part with no
      // top-level colon was silently dropped, so `bq-class="{ active }"` added
      // no class even when `active` was truthy — a documented parsing edge case.
      if (isPrototypePollutionKey(part)) continue;
      result[part] = part;
    }
  }

  return result;
};
