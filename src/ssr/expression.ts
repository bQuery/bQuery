/**
 * CSP-safe expression evaluator for SSR templates.
 *
 * Evaluates a tightly scoped subset of JavaScript expressions against a
 * binding context without using `eval` or `new Function()`. Runs in any
 * runtime (Bun, Deno, Node, browsers) and is safe under strict CSP without
 * `'unsafe-eval'`.
 *
 * Supported grammar (operator-precedence Pratt parser):
 *
 * - Literals: numbers, single/double-quoted strings, `true`, `false`, `null`,
 *   `undefined`.
 * - Identifiers and member access (`a.b`, `a['b']`, `a[0]`).
 * - Optional chaining (`a?.b`, `a?.[b]`).
 * - Unary `!`, `+`, `-`, `typeof`.
 * - Binary `+`, `-`, `*`, `/`, `%`, `==`, `===`, `!=`, `!==`, `<`, `<=`,
 *   `>`, `>=`, `&&`, `||`, `??`.
 * - Ternary `cond ? a : b`.
 * - Parentheses for grouping.
 * - Function calls `fn(arg1, arg2, ...)` (only on identifiers / member chains
 *   resolved against the context — no arbitrary expression invocation).
 *
 * Anything outside this grammar throws a parse error which the caller
 * converts into the standard SSR fallback (`undefined`).
 *
 * @module bquery/ssr
 * @internal
 */

import { isComputed, isSignal, type Signal } from '../reactive/index';
import { isPrototypePollutionKey } from '../core/utils/object';
import type { BindingContext } from '../view/types';

const unwrap = (value: unknown): unknown => {
  if (isSignal(value) || isComputed(value)) {
    return (value as Signal<unknown>).value;
  }
  return value;
};

/* ---------------------------------------------------------------------------
 * Tokenizer
 * ------------------------------------------------------------------------- */

type TokenKind = 'number' | 'string' | 'ident' | 'punct' | 'eof';

interface Token {
  kind: TokenKind;
  value: string;
  start: number;
}

const PUNCT_MULTI = ['===', '!==', '==', '!=', '<=', '>=', '&&', '||', '??', '?.'];

const PUNCT_SINGLE = '+-*/%<>!?:,.()[]';

const isIdentStart = (ch: string): boolean =>
  (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch === '$';

const isIdentCont = (ch: string): boolean => isIdentStart(ch) || (ch >= '0' && ch <= '9');

const isDigit = (ch: string): boolean => ch >= '0' && ch <= '9';

const tokenize = (input: string): Token[] => {
  const tokens: Token[] = [];
  const len = input.length;
  let i = 0;

  while (i < len) {
    const ch = input[i];

    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }

    // Strings
    if (ch === '"' || ch === "'") {
      const quote = ch;
      const start = i;
      i++;
      let value = '';
      while (i < len && input[i] !== quote) {
        if (input[i] === '\\' && i + 1 < len) {
          const next = input[i + 1];
          if (next === 'n') value += '\n';
          else if (next === 't') value += '\t';
          else if (next === 'r') value += '\r';
          else if (next === '\\') value += '\\';
          else if (next === quote) value += quote;
          else value += next;
          i += 2;
          continue;
        }
        value += input[i];
        i++;
      }
      if (i >= len) {
        throw new Error('Unterminated string literal in SSR expression');
      }
      i++; // closing quote
      tokens.push({ kind: 'string', value, start });
      continue;
    }

    // Numbers
    if (isDigit(ch) || (ch === '.' && i + 1 < len && isDigit(input[i + 1]))) {
      const start = i;
      while (i < len && (isDigit(input[i]) || input[i] === '.')) {
        i++;
      }
      tokens.push({ kind: 'number', value: input.slice(start, i), start });
      continue;
    }

    // Identifiers / keywords
    if (isIdentStart(ch)) {
      const start = i;
      while (i < len && isIdentCont(input[i])) {
        i++;
      }
      tokens.push({ kind: 'ident', value: input.slice(start, i), start });
      continue;
    }

    // Multi-char punctuation
    let matched = false;
    for (const p of PUNCT_MULTI) {
      if (input.startsWith(p, i)) {
        tokens.push({ kind: 'punct', value: p, start: i });
        i += p.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    if (PUNCT_SINGLE.includes(ch)) {
      tokens.push({ kind: 'punct', value: ch, start: i });
      i++;
      continue;
    }

    throw new Error(`Unexpected character "${ch}" in SSR expression`);
  }

  tokens.push({ kind: 'eof', value: '', start: len });
  return tokens;
};

/* ---------------------------------------------------------------------------
 * Parser → directly evaluated AST
 * ------------------------------------------------------------------------- */

interface ParserState {
  tokens: Token[];
  pos: number;
  context: BindingContext;
}

const peek = (s: ParserState): Token => s.tokens[s.pos];
const advance = (s: ParserState): Token => s.tokens[s.pos++];

const expectPunct = (s: ParserState, value: string): void => {
  const t = peek(s);
  if (t.kind !== 'punct' || t.value !== value) {
    throw new Error(`Expected "${value}" in SSR expression, got "${t.value}"`);
  }
  s.pos++;
};

const matchPunct = (s: ParserState, value: string): boolean => {
  const t = peek(s);
  if (t.kind === 'punct' && t.value === value) {
    s.pos++;
    return true;
  }
  return false;
};

const skipBalancedGroup = (s: ParserState, open: '(' | '[', close: ')' | ']'): void => {
  expectPunct(s, open);
  const stack: Array<'(' | '['> = [open];
  while (stack.length > 0) {
    const t = advance(s);
    if (!t || t.kind === 'eof') {
      throw new Error(`Unterminated "${open}${close}" group in SSR expression`);
    }
    if (t.kind !== 'punct') continue;
    if (t.value === '(' || t.value === '[') {
      stack.push(t.value);
      continue;
    }
    if (t.value === ')' || t.value === ']') {
      const current = stack[stack.length - 1];
      const expected = current === '(' ? ')' : ']';
      if (t.value !== expected) {
        throw new Error(`Mismatched "${current}${expected}" group in SSR expression`);
      }
      stack.pop();
    }
  }
};

const skipShortCircuitedChainTarget = (s: ParserState): void => {
  const next = peek(s);
  if (next.kind === 'punct' && next.value === '[') {
    skipBalancedGroup(s, '[', ']');
    return;
  }
  if (next.kind === 'punct' && next.value === '(') {
    skipBalancedGroup(s, '(', ')');
    return;
  }
  if (next.kind === 'ident') {
    s.pos++;
    return;
  }
  throw new Error('Invalid optional chain in SSR expression');
};

const skipShortCircuitedChainRemainder = (s: ParserState): void => {
  while (true) {
    const t = peek(s);
    if (t.kind !== 'punct') break;
    if (t.value === '.') {
      s.pos++;
      const id = advance(s);
      if (id.kind !== 'ident') {
        throw new Error('Expected identifier after "."');
      }
      continue;
    }
    if (t.value === '[') {
      skipBalancedGroup(s, '[', ']');
      continue;
    }
    if (t.value === '(') {
      skipBalancedGroup(s, '(', ')');
      continue;
    }
    if (t.value === '?.') {
      s.pos++;
      skipShortCircuitedChainTarget(s);
      continue;
    }
    break;
  }
};

/**
 * Advances through expression tokens without evaluating them.
 *
 * Mirrors the `parsePrimary()` / `parsePostfix()` / `parseUnary()` /
 * `parseExpression()` hierarchy so `parseExpression()` can preserve JavaScript
 * short-circuit semantics for `&&`, `||`, `??`, and ternaries while still
 * leaving the parser in the correct token position.
 *
 * @internal
 */
const skipPrimary = (s: ParserState): void => {
  const t = advance(s);
  if (!t || t.kind === 'eof') {
    throw new Error('Unexpected end of SSR expression');
  }
  if (t.kind === 'number' || t.kind === 'string' || t.kind === 'ident') {
    return;
  }
  if (t.kind === 'punct' && t.value === '(') {
    skipExpression(s, 0);
    expectPunct(s, ')');
    return;
  }
  throw new Error(`Unexpected token "${t.value}" in SSR expression`);
};

/** Skips a function-call argument list without evaluating any argument expressions. */
const skipCall = (s: ParserState): void => {
  expectPunct(s, '(');
  if (!matchPunct(s, ')')) {
    while (true) {
      skipExpression(s, 0);
      if (matchPunct(s, ',')) continue;
      expectPunct(s, ')');
      break;
    }
  }
};

/** Skips postfix chains such as member access, indexing, optional chaining, and calls. */
const skipPostfix = (s: ParserState): void => {
  skipPrimary(s);

  while (true) {
    const t = peek(s);
    if (t.kind !== 'punct') break;

    if (t.value === '.') {
      s.pos++;
      const id = advance(s);
      if (id.kind !== 'ident') {
        throw new Error('Expected identifier after "."');
      }
      continue;
    }

    if (t.value === '?.') {
      s.pos++;
      skipShortCircuitedChainTarget(s);
      continue;
    }

    if (t.value === '[') {
      s.pos++;
      skipExpression(s, 0);
      expectPunct(s, ']');
      continue;
    }

    if (t.value === '(') {
      skipCall(s);
      continue;
    }

    break;
  }
};

/** Skips unary operators before delegating to the postfix-skipping parser path. */
const skipUnary = (s: ParserState): void => {
  const t = peek(s);
  if (t.kind === 'punct' && (t.value === '!' || t.value === '-' || t.value === '+')) {
    s.pos++;
    skipUnary(s);
    return;
  }
  if (t.kind === 'ident' && t.value === 'typeof') {
    s.pos++;
    skipUnary(s);
    return;
  }
  skipPostfix(s);
};

/** Skips a full expression subtree while preserving operator precedence and token position. */
const skipExpression = (s: ParserState, minPrec = 0): void => {
  skipUnary(s);

  while (true) {
    const t = peek(s);
    if (t.kind !== 'punct') break;

    if (t.value === '?' && minPrec <= 0) {
      s.pos++;
      skipExpression(s, 0);
      expectPunct(s, ':');
      skipExpression(s, 0);
      continue;
    }

    const prec = BIN_PRECEDENCE[t.value];
    if (prec === undefined || prec < minPrec) break;
    s.pos++;
    skipExpression(s, prec + 1);
  }
};

const lookupIdent = (s: ParserState, name: string): unknown => {
  if (name === 'true') return true;
  if (name === 'false') return false;
  if (name === 'null') return null;
  if (name === 'undefined') return undefined;
  if (isPrototypePollutionKey(name)) return undefined;
  return unwrap((s.context as Record<string, unknown>)[name]);
};

const safeMember = (obj: unknown, key: PropertyKey): unknown => {
  if (obj == null) return undefined;
  if (typeof key === 'string' && isPrototypePollutionKey(key)) return undefined;
  return (obj as Record<PropertyKey, unknown>)[key];
};

// Pratt-parser precedence table for binary operators.
const BIN_PRECEDENCE: Record<string, number> = {
  '||': 1,
  '??': 1,
  '&&': 2,
  '==': 3,
  '!=': 3,
  '===': 3,
  '!==': 3,
  '<': 4,
  '<=': 4,
  '>': 4,
  '>=': 4,
  '+': 5,
  '-': 5,
  '*': 6,
  '/': 6,
  '%': 6,
};

const parseExpression = (s: ParserState, minPrec = 0): unknown => {
  let left = parseUnary(s);

  while (true) {
    const t = peek(s);
    if (t.kind !== 'punct') break;

    // Ternary
    if (t.value === '?' && minPrec <= 0) {
      s.pos++;
      if (left) {
        const consequent = parseExpression(s, 0);
        expectPunct(s, ':');
        skipExpression(s, 0);
        left = consequent;
      } else {
        skipExpression(s, 0);
        expectPunct(s, ':');
        left = parseExpression(s, 0);
      }
      continue;
    }

    const prec = BIN_PRECEDENCE[t.value];
    if (prec === undefined || prec < minPrec) break;
    s.pos++;
    if (t.value === '&&') {
      if (!left) {
        skipExpression(s, prec + 1);
      } else {
        left = parseExpression(s, prec + 1);
      }
      continue;
    }
    if (t.value === '||') {
      if (left) {
        skipExpression(s, prec + 1);
      } else {
        left = parseExpression(s, prec + 1);
      }
      continue;
    }
    if (t.value === '??') {
      if (left !== null && left !== undefined) {
        skipExpression(s, prec + 1);
      } else {
        left = parseExpression(s, prec + 1);
      }
      continue;
    }
    const right = parseExpression(s, prec + 1);
    left = applyBinary(t.value, left, right);
  }

  return left;
};

const applyBinary = (op: string, l: unknown, r: unknown): unknown => {
  switch (op) {
    case '||':
      return l || r;
    case '&&':
      return l && r;
    case '??':
      return l ?? r;
    case '==':
      // Intentional loose equality: the SSR expression grammar mirrors the
      // JavaScript operators users write in templates. `===` and `!==` are
      // available for strict comparisons.

      return l == r;
    case '!=':
      // Intentional loose inequality (see `==` note above).

      return l != r;
    case '===':
      return l === r;
    case '!==':
      return l !== r;
    case '<':
      return (l as number) < (r as number);
    case '<=':
      return (l as number) <= (r as number);
    case '>':
      return (l as number) > (r as number);
    case '>=':
      return (l as number) >= (r as number);
    case '+':
      // String concat for either operand is a string
      if (typeof l === 'string' || typeof r === 'string') {
        return String(l ?? '') + String(r ?? '');
      }
      return (l as number) + (r as number);
    case '-':
      return (l as number) - (r as number);
    case '*':
      return (l as number) * (r as number);
    case '/':
      return (l as number) / (r as number);
    case '%':
      return (l as number) % (r as number);
    default:
      throw new Error(`Unsupported binary operator "${op}"`);
  }
};

const parseUnary = (s: ParserState): unknown => {
  const t = peek(s);
  if (t.kind === 'punct') {
    if (t.value === '!') {
      s.pos++;
      return !parseUnary(s);
    }
    if (t.value === '-') {
      s.pos++;
      return -(parseUnary(s) as number);
    }
    if (t.value === '+') {
      s.pos++;
      return +(parseUnary(s) as number);
    }
  }
  if (t.kind === 'ident' && t.value === 'typeof') {
    s.pos++;
    return typeof parseUnary(s);
  }
  return parsePostfix(s);
};

const parsePostfix = (s: ParserState): unknown => {
  let value = parsePrimary(s);
  let thisArg: unknown = undefined;

  while (true) {
    const t = peek(s);
    if (t.kind !== 'punct') break;

    if (t.value === '.') {
      s.pos++;
      const id = advance(s);
      if (id.kind !== 'ident') {
        throw new Error('Expected identifier after "."');
      }
      thisArg = value;
      value = safeMember(value, id.value);
      continue;
    }

    if (t.value === '?.') {
      s.pos++;
      if (value == null) {
        skipShortCircuitedChainTarget(s);
        skipShortCircuitedChainRemainder(s);
        value = undefined;
        thisArg = undefined;
        continue;
      }
      const next = peek(s);
      if (next.kind === 'punct' && next.value === '[') {
        s.pos++;
        const receiver = value;
        const key = parseExpression(s, 0);
        expectPunct(s, ']');
        thisArg = receiver;
        value = safeMember(value, key as PropertyKey);
      } else if (next.kind === 'punct' && next.value === '(') {
        value = parseCall(s, value, thisArg);
        thisArg = undefined;
      } else if (next.kind === 'ident') {
        s.pos++;
        thisArg = value;
        value = safeMember(value, next.value);
      } else {
        throw new Error('Invalid optional chain in SSR expression');
      }
      continue;
    }

    if (t.value === '[') {
      s.pos++;
      const receiver = value;
      const key = parseExpression(s, 0);
      expectPunct(s, ']');
      thisArg = receiver;
      value = safeMember(value, key as PropertyKey);
      continue;
    }

    if (t.value === '(') {
      // Function call
      value = parseCall(s, value, thisArg);
      thisArg = undefined;
      continue;
    }

    break;
  }

  return value;
};

const parseCall = (s: ParserState, callee: unknown, thisArg: unknown): unknown => {
  expectPunct(s, '(');
  const args: unknown[] = [];
  if (!matchPunct(s, ')')) {
    while (true) {
      args.push(parseExpression(s, 0));
      if (matchPunct(s, ',')) continue;
      expectPunct(s, ')');
      break;
    }
  }
  if (typeof callee !== 'function') {
    return undefined;
  }
  return (callee as (...a: unknown[]) => unknown).apply(thisArg, args);
};

const parsePrimary = (s: ParserState): unknown => {
  const t = advance(s);
  if (t.kind === 'number') {
    return Number(t.value);
  }
  if (t.kind === 'string') {
    return t.value;
  }
  if (t.kind === 'ident') {
    return lookupIdent(s, t.value);
  }
  if (t.kind === 'punct' && t.value === '(') {
    const value = parseExpression(s, 0);
    expectPunct(s, ')');
    return value;
  }
  throw new Error(`Unexpected token "${t.value}" in SSR expression`);
};

/**
 * Evaluates a tightly scoped expression against a binding context.
 *
 * Returns `undefined` when the expression cannot be parsed or evaluated.
 * This matches the behaviour of the previous `new Function()`-based fallback
 * but never invokes dynamic code generation.
 *
 * @param expression - Expression source.
 * @param context - Binding context whose top-level signal/computed values are
 *   automatically unwrapped.
 *
 * @internal
 */
export const evaluateExpression = <T = unknown>(expression: string, context: BindingContext): T => {
  const trimmed = expression.trim();
  if (trimmed === '') return undefined as T;

  try {
    const tokens = tokenize(trimmed);
    const state: ParserState = { tokens, pos: 0, context };
    const value = parseExpression(state, 0);
    if (peek(state).kind !== 'eof') {
      // Unexpected trailing tokens — fall back to undefined.
      return undefined as T;
    }
    return value as T;
  } catch {
    return undefined as T;
  }
};
