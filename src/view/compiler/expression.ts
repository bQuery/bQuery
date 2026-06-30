/**
 * Ahead-of-time expression compiler.
 *
 * Rewrites a `bq-*` directive expression into a `with`-free arrow function that
 * reads free identifiers from a context parameter — e.g. `count + 1` becomes
 * `($c) => ($c.count + 1)`. Because the output contains no `with` and no
 * `new Function()`, the emitted module is safe under a strict CSP that omits
 * `'unsafe-eval'`, and it skips the runtime parse on the hot path.
 *
 * The transform is intentionally conservative: any construct it cannot prove
 * safe to rewrite (assignments other than `++`/`--`, arrow/function bodies,
 * `new`, spread, regex/template literals, comments, …) makes it bail, and the
 * caller falls back to the runtime evaluator for that expression. This keeps
 * the compiled and runtime paths behaviourally identical.
 *
 * @module bquery/view/compiler
 */

import type { CompiledExpression } from './types';

/** Default context parameter name — unlikely to collide with author vars. */
export const DEFAULT_PARAM = '__bq_ctx';

/**
 * Globals left un-prefixed so they resolve from the JS global scope (mirroring
 * the runtime `with(ctx)` behaviour, where a name absent from the context falls
 * through to the global). A context value shadowing one of these is the rare
 * case the author can resolve with the `globals` option.
 */
export const DEFAULT_GLOBALS: ReadonlySet<string> = new Set([
  'Math',
  'JSON',
  'Object',
  'Array',
  'String',
  'Number',
  'Boolean',
  'Date',
  'RegExp',
  'Map',
  'Set',
  'Symbol',
  'Promise',
  'parseInt',
  'parseFloat',
  'isNaN',
  'isFinite',
  'encodeURIComponent',
  'decodeURIComponent',
  'encodeURI',
  'decodeURI',
  'console',
  'Intl',
]);

/** Keywords that are values/operators and must not be prefixed. */
const PASS_THROUGH_WORDS: ReadonlySet<string> = new Set([
  'true',
  'false',
  'null',
  'undefined',
  'this',
  'NaN',
  'Infinity',
  'typeof',
  'instanceof',
  'in',
  'of',
  'void',
]);

/** Keywords whose presence means the expression is not a safe value expression. */
const BAIL_WORDS: ReadonlySet<string> = new Set([
  'function',
  'class',
  'new',
  'delete',
  'yield',
  'await',
  'super',
  'do',
  'var',
  'let',
  'const',
  'return',
  'if',
  'else',
  'for',
  'while',
  'switch',
  'throw',
  'try',
  'catch',
  'with',
  'import',
  'export',
  'extends',
]);

/** Operator runs ending in `=` that are comparisons, not assignments. */
const COMPARISON_OPS: ReadonlySet<string> = new Set(['==', '===', '!=', '!==', '<=', '>=']);

const isWs = (c: string): boolean =>
  c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f';
const isIdentStart = (c: string): boolean => /[A-Za-z_$]/.test(c);
const isIdentPart = (c: string): boolean => /[A-Za-z0-9_$]/.test(c);
const isDigit = (c: string): boolean => c >= '0' && c <= '9';
/** Characters that, as the previous significant token, mean a `/` is division. */
const isValueEnder = (c: string): boolean => /[)\]A-Za-z0-9_$"']/.test(c);
/** Operator characters scanned as a maximal run (note: `/` is handled apart). */
const isOpChar = (c: string): boolean => '-+*%<>=!&|^~'.includes(c);

class Bail extends Error {}

/**
 * Rewrites an expression into a `with`-free body string (no arrow wrapper).
 * Throws {@link Bail} with a reason when the expression cannot be compiled.
 */
const rewrite = (src: string, param: string, globals: ReadonlySet<string>): string => {
  const n = src.length;
  let out = '';
  let i = 0;
  // Last significant emitted char (whitespace excluded). Drives member-access
  // detection (`.`/`?.`) and object-key position detection (`{`/`,`).
  let prev = '';
  // Bracket stack tracks whether we are inside an object literal `{`.
  const stack: string[] = [];

  while (i < n) {
    const c = src[i];

    if (isWs(c)) {
      out += c;
      i++;
      continue;
    }

    // Comments are unexpected in directive expressions.
    if (c === '/' && (src[i + 1] === '/' || src[i + 1] === '*')) {
      throw new Bail('comments are not supported');
    }

    // Single/double-quoted strings: copy verbatim (respecting escapes).
    if (c === '"' || c === "'") {
      const start = i;
      i++;
      while (i < n && src[i] !== c) {
        if (src[i] === '\\') i++;
        i++;
      }
      i++; // closing quote (or EOF)
      out += src.slice(start, i);
      prev = '"';
      continue;
    }

    // Template literals fall back to runtime (keeps the transform simple/safe).
    if (c === '`') {
      throw new Bail('template literals fall back to runtime');
    }

    // Spread/rest is not a safe value reference to rewrite.
    if (c === '.' && src[i + 1] === '.' && src[i + 2] === '.') {
      throw new Bail('spread/rest is not supported');
    }

    // Optional chaining `?.`
    if (c === '?' && src[i + 1] === '.') {
      out += '?.';
      i += 2;
      prev = '.';
      continue;
    }
    // Nullish coalescing `??`
    if (c === '?' && src[i + 1] === '?') {
      out += '??';
      i += 2;
      prev = '?';
      continue;
    }

    // `/` — division, or a regex we decline to rewrite.
    if (c === '/') {
      if (src[i + 1] === '=') throw new Bail('assignment is not supported');
      if (!isValueEnder(prev)) throw new Bail('regular expression literals are not supported');
      out += '/';
      i++;
      prev = '/';
      continue;
    }

    // Member-access dot.
    if (c === '.') {
      out += '.';
      i++;
      prev = '.';
      continue;
    }

    // Numbers (incl. hex/float/exponent — copied verbatim).
    if (isDigit(c) || (c === '.' && isDigit(src[i + 1]))) {
      const start = i;
      let seenDot = false;
      while (i < n) {
        const ch = src[i];
        if (ch === '.') {
          // A dot belongs to the number only as a single decimal point with a
          // following digit. A second dot, or a dot that starts a member access
          // (e.g. `1.5.toFixed`), ends the literal so the property is not
          // mis-prefixed as a free identifier.
          if (seenDot || !isDigit(src[i + 1])) break;
          seenDot = true;
          i++;
          continue;
        }
        if (/[0-9a-fA-FxXoObBeE_]/.test(ch)) {
          i++;
          continue;
        }
        break;
      }
      out += src.slice(start, i);
      prev = '0';
      continue;
    }

    // Brackets.
    if (c === '(' || c === '[' || c === '{') {
      stack.push(c);
      out += c;
      i++;
      prev = c;
      continue;
    }
    if (c === ')' || c === ']' || c === '}') {
      const open = stack.pop();
      const expected = c === ')' ? '(' : c === ']' ? '[' : '{';
      // Bail on a closing bracket that has no matching opener (or the wrong
      // one) rather than emitting unbalanced — and therefore unparsable — code
      // that would break the whole generated module.
      if (open !== expected) throw new Bail('unbalanced brackets');
      out += c;
      i++;
      prev = c;
      continue;
    }

    // Statement separators / unexpected punctuation.
    if (c === ';' || c === '@' || c === '#') {
      throw new Bail(`unexpected "${c}"`);
    }

    // Identifiers.
    if (isIdentStart(c)) {
      const start = i;
      while (i < n && isIdentPart(src[i])) i++;
      const name = src.slice(start, i);

      // Property name after a member dot — never prefixed.
      if (prev === '.') {
        out += name;
        prev = 'a';
        continue;
      }
      if (BAIL_WORDS.has(name)) {
        throw new Bail(`unsupported keyword "${name}"`);
      }
      if (PASS_THROUGH_WORDS.has(name) || globals.has(name)) {
        out += name;
        prev = 'a';
        continue;
      }

      const inObjectLiteral = stack[stack.length - 1] === '{';
      const atKeyPosition = inObjectLiteral && (prev === '{' || prev === ',');
      if (atKeyPosition) {
        let j = i;
        while (j < n && isWs(src[j])) j++;
        const next = src[j];
        if (next === ':') {
          // Explicit key — leave the key name unprefixed.
          out += name;
          prev = 'a';
          continue;
        }
        if (next === ',' || next === '}') {
          // Shorthand `{ name }` ≡ `{ name: ctx.name }`.
          out += `${name}: ${param}.${name}`;
          prev = 'a';
          continue;
        }
        // Method shorthand `{ name() {} }` etc. — not supported.
        throw new Bail('unsupported object literal form');
      }

      // Free reference — read from the context.
      out += `${param}.${name}`;
      prev = 'a';
      continue;
    }

    // Operator runs.
    if (isOpChar(c)) {
      const start = i;
      while (i < n && isOpChar(src[i])) i++;
      const run = src.slice(start, i);
      if (run.includes('=>')) throw new Bail('arrow functions are not supported');
      if (run.endsWith('=') && !COMPARISON_OPS.has(run)) {
        throw new Bail('assignment is not supported');
      }
      out += run;
      prev = run[run.length - 1];
      continue;
    }

    if (c === ',') {
      out += ',';
      i++;
      prev = ',';
      continue;
    }
    if (c === '?' || c === ':') {
      out += c;
      i++;
      prev = c;
      continue;
    }

    // Anything else is unrecognised — bail rather than risk a wrong rewrite.
    throw new Bail(`unrecognised character "${c}"`);
  }

  // Unclosed brackets would emit unbalanced, unparsable code — bail instead.
  if (stack.length > 0) throw new Bail('unbalanced brackets');

  return out;
};

/**
 * Compiles a single directive expression to a `with`-free arrow function.
 *
 * @example
 * ```ts
 * compileExpression('count + 1');
 * // → { ok: true, expression: 'count + 1', code: '($c) => ($c.count + 1)' }
 * ```
 */
export const compileExpression = (
  expression: string,
  options: { param?: string; globals?: Iterable<string> } = {}
): CompiledExpression => {
  const param = options.param ?? DEFAULT_PARAM;
  const globals = options.globals
    ? new Set([...DEFAULT_GLOBALS, ...options.globals])
    : DEFAULT_GLOBALS;

  const trimmed = expression.trim();
  if (trimmed === '') {
    return { ok: false, expression, reason: 'empty expression' };
  }

  try {
    const body = rewrite(expression, param, globals);
    return { ok: true, expression, code: `(${param}) => (${body})` };
  } catch (error) {
    const reason = error instanceof Bail ? error.message : 'could not compile expression';
    return { ok: false, expression, reason };
  }
};
