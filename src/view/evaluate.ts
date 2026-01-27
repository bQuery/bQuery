import { isComputed, isSignal, type Signal } from '../reactive/index';
import type { BindingContext } from './types';

/** Cache for compiled evaluate functions, keyed by expression string */
const evaluateCache = new Map<string, (ctx: BindingContext) => unknown>();

/** Cache for compiled evaluateRaw functions, keyed by "expression|key1,key2,..." */
const evaluateRawCache = new Map<string, (...args: unknown[]) => unknown>();

/**
 * Creates a proxy that lazily unwraps signals/computed only when accessed.
 * This avoids subscribing to signals that aren't referenced in the expression.
 * @internal
 */
const createLazyContext = (context: BindingContext): BindingContext =>
  new Proxy(context, {
    get(target, prop: string) {
      const value = target[prop];
      // Auto-unwrap signals/computed only when actually accessed
      if (isSignal(value) || isComputed(value)) {
        return (value as Signal<unknown>).value;
      }
      return value;
    },
    has(target, prop: string) {
      // Required for `with` statement to resolve identifiers correctly
      return prop in target;
    },
  });

/**
 * Evaluates an expression in the given context using `new Function()`.
 *
 * Signals and computed values in the context are lazily unwrapped only when
 * accessed by the expression, avoiding unnecessary subscriptions to unused values.
 *
 * @security **WARNING:** This function uses dynamic code execution via `new Function()`.
 * - NEVER pass expressions derived from user input or untrusted sources
 * - Expressions should only come from developer-controlled templates
 * - Malicious expressions can access and exfiltrate context data
 * - Consider this equivalent to `eval()` in terms of security implications
 *
 * @internal
 */
export const evaluate = <T = unknown>(expression: string, context: BindingContext): T => {
  try {
    // Create a proxy that lazily unwraps signals/computed on access
    const lazyContext = createLazyContext(context);

    // Use cached function or compile and cache a new one
    let fn = evaluateCache.get(expression);
    if (!fn) {
      // Use `with` to enable direct property access from proxy scope.
      // Note: `new Function()` runs in non-strict mode, so `with` is allowed.
      fn = new Function('$ctx', `with($ctx) { return (${expression}); }`) as (
        ctx: BindingContext
      ) => unknown;
      evaluateCache.set(expression, fn);
    }
    return fn(lazyContext) as T;
  } catch (error) {
    console.error(`bQuery view: Error evaluating "${expression}"`, error);
    return undefined as T;
  }
};

/**
 * Evaluates an expression and returns the raw value (for signal access).
 *
 * @security **WARNING:** Uses dynamic code execution. See {@link evaluate} for security notes.
 * @internal
 */
export const evaluateRaw = <T = unknown>(expression: string, context: BindingContext): T => {
  try {
    const keys = Object.keys(context);
    const values = keys.map((key) => context[key]);

    // Cache key includes expression and sorted keys (order matters for function params)
    const cacheKey = `${expression}|${keys.join(',')}`;
    let fn = evaluateRawCache.get(cacheKey);
    if (!fn) {
      fn = new Function(...keys, `return (${expression})`) as (...args: unknown[]) => unknown;
      evaluateRawCache.set(cacheKey, fn);
    }
    return fn(...values) as T;
  } catch (error) {
    console.error(`bQuery view: Error evaluating "${expression}"`, error);
    return undefined as T;
  }
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
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let inString: string | null = null;

  for (let i = 0; i < inner.length; i++) {
    const char = inner[i];
    const prevChar = i > 0 ? inner[i - 1] : '';

    // Handle string literals (including escape sequences)
    if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
      if (inString === null) {
        inString = char;
      } else if (inString === char) {
        inString = null;
      }
      current += char;
      continue;
    }

    // Skip if inside string
    if (inString !== null) {
      current += char;
      continue;
    }

    // Track nesting depth for parentheses, brackets, and braces
    if (char === '(' || char === '[' || char === '{') {
      depth++;
      current += char;
    } else if (char === ')' || char === ']' || char === '}') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      // Top-level comma - split point
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Add the last part
  if (current.trim()) {
    parts.push(current.trim());
  }

  // Parse each part to extract key and value
  for (const part of parts) {
    // Find the first colon at depth 0 (to handle ternary operators in values)
    let colonIndex = -1;
    let partDepth = 0;
    let partInString: string | null = null;

    for (let i = 0; i < part.length; i++) {
      const char = part[i];
      const prevChar = i > 0 ? part[i - 1] : '';

      if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
        if (partInString === null) {
          partInString = char;
        } else if (partInString === char) {
          partInString = null;
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
      const value = part.slice(colonIndex + 1).trim();
      result[key] = value;
    }
  }

  return result;
};
