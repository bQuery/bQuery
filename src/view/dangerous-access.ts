/**
 * Shared detection of member access to `constructor`, `prototype`, or
 * `__proto__` in a `bq-*` expression string.
 *
 * The `with`-scoped runtime evaluator shadows dangerous *identifiers*
 * (`constructor`, `Function`, `eval`, …), but a member chain off any reachable
 * object still escapes: `foo.constructor.constructor('return 2')()` (or
 * `this.constructor…`) reaches the `Function` constructor without ever
 * resolving a bare identifier. A denylist on the `with` scope cannot stop this.
 *
 * This guard rejects such expressions before they are compiled — both in the
 * runtime evaluator and in the ahead-of-time compiler — closing the common
 * vector. It intentionally covers dotted / optional-chaining access
 * (`.constructor`, `?.constructor`) and string-literal bracket access
 * (`['constructor']`). Computed bracket access assembled at runtime
 * (`foo['con' + 'structor']`) is out of scope: the runtime evaluator is
 * `eval`-equivalent and its documented threat model treats template
 * expressions as author-trusted — this is defense-in-depth, not a full sandbox.
 * The CSP-safe, `Function`-free path is the ahead-of-time compiler.
 *
 * Comments are read as whitespace (`foo./**\/constructor` is `foo.constructor`),
 * with the same scanner as `bq-on` statement lists, so strings and template
 * literals are not mistaken for comments.
 *
 * @module bquery/view
 * @internal
 */

import { splitTopLevel } from './split';

const DANGEROUS_MEMBERS = 'constructor|prototype|__proto__';

/** Dotted or optional-chaining member access: `.constructor`, `?.constructor`. */
const DANGEROUS_DOT_ACCESS = new RegExp(`[.?]\\s*(?:${DANGEROUS_MEMBERS})\\b`);

/** String-literal bracket access: `['constructor']`, `["prototype"]`. */
const DANGEROUS_BRACKET_ACCESS = new RegExp(
  `\\[\\s*(['"\`])\\s*(?:${DANGEROUS_MEMBERS})\\s*\\1\\s*\\]`
);

/**
 * Returns `true` when `expression` accesses `constructor`, `prototype`, or
 * `__proto__` as a member (dotted, optional-chaining, or string-literal
 * bracket). See the module doc for the covered forms and the residual limit.
 * @internal
 */
export const hasDangerousMemberAccess = (expression: string): boolean => {
  const test = (text: string): boolean =>
    DANGEROUS_DOT_ACCESS.test(text) || DANGEROUS_BRACKET_ACCESS.test(text);
  if (test(expression)) return true;
  // `splitTopLevel()` replaces each comment with a space; NUL never occurs in
  // a real expression, so it only serves as a separator that does not split.
  return expression.includes('/') && test(splitTopLevel(expression, '\u0000').join(' '));
};
