/**
 * ICU MessageFormat support for the i18n module.
 *
 * Implements the subset of ICU MessageFormat that bQuery commits to as a
 * documented, stable contract:
 *
 * - **Simple arguments** — `{name}`
 * - **`plural`** — cardinal plurals via `Intl.PluralRules`, with `offset:N`,
 *   exact `=N` selectors, and the `#` token (locale-formatted `value - offset`)
 * - **`selectordinal`** — ordinal plurals via `Intl.PluralRules` (`{ type: 'ordinal' }`)
 * - **`select`** — keyed string selection (e.g. grammatical gender)
 * - **Nested arguments** — sub-messages may contain further arguments and `#`
 * - **Apostrophe escaping** — `'{'`, `'}'`, `'#'` literals and `''` for a literal apostrophe
 *
 * Inline `number`/`date`/`time` argument types (skeletons) are intentionally
 * **not** supported — use the instance `n()` / `d()` helpers instead. See the
 * i18n guide for the full coverage statement and its known limitations.
 *
 * @module bquery/i18n
 * @internal
 */

import { formatNumber } from './formatting';
import type { TranslateParams } from './types';

/** A parsed ICU node. @internal */
type IcuNode =
  | { kind: 'text'; value: string }
  | { kind: 'arg'; name: string }
  | { kind: 'pound' }
  | {
      kind: 'plural';
      name: string;
      ordinal: boolean;
      offset: number;
      cases: Map<string, IcuNode[]>;
    }
  | { kind: 'select'; name: string; cases: Map<string, IcuNode[]> };

/**
 * Detects whether a template uses ICU MessageFormat typed arguments
 * (`plural`, `selectordinal`, or `select`). Plain `{name}` interpolation and
 * pipe-delimited plurals are deliberately excluded so the legacy fast path
 * stays untouched.
 *
 * @internal
 */
export const isICUMessage = (template: string): boolean =>
  /\{\s*[A-Za-z0-9_]+\s*,\s*(plural|selectordinal|select)\b/.test(template);

const isNameChar = (ch: string): boolean => /[A-Za-z0-9_]/.test(ch);

/**
 * Parses a message pattern starting at `pos`, stopping at the first
 * unbalanced `}` (when nested inside an argument) or end of input.
 *
 * `parentArg` is non-null while inside a `plural`/`selectordinal` sub-message,
 * which enables the `#` token. ICU apostrophe escaping is honoured throughout.
 *
 * @internal
 */
const parsePattern = (
  input: string,
  start: number,
  parentArg: string | null
): { nodes: IcuNode[]; pos: number } => {
  const nodes: IcuNode[] = [];
  let text = '';
  let pos = start;

  const flush = (): void => {
    if (text) {
      nodes.push({ kind: 'text', value: text });
      text = '';
    }
  };

  while (pos < input.length) {
    const ch = input[pos];

    if (ch === '}') break;

    if (ch === "'") {
      // Apostrophe escaping (ICU rules).
      const next = input[pos + 1];
      if (next === "'") {
        text += "'";
        pos += 2;
        continue;
      }
      if (next === '{' || next === '}' || next === '#' || next === '|') {
        // Quoted literal: copy verbatim until a lone closing apostrophe. A
        // doubled '' inside the quote is an escaped literal apostrophe per ICU
        // and does not terminate the span.
        pos += 1;
        while (pos < input.length) {
          if (input[pos] === "'") {
            if (input[pos + 1] === "'") {
              text += "'";
              pos += 2;
              continue;
            }
            break;
          }
          text += input[pos];
          pos += 1;
        }
        pos += 1; // skip closing '
        continue;
      }
      // A lone apostrophe not introducing an escape is a literal apostrophe.
      text += "'";
      pos += 1;
      continue;
    }

    if (ch === '#' && parentArg !== null) {
      flush();
      nodes.push({ kind: 'pound' });
      pos += 1;
      continue;
    }

    if (ch === '{') {
      flush();
      const arg = parseArgument(input, pos);
      nodes.push(arg.node);
      pos = arg.pos;
      continue;
    }

    text += ch;
    pos += 1;
  }

  flush();
  return { nodes, pos };
};

const skipWs = (input: string, pos: number): number => {
  while (pos < input.length && /\s/.test(input[pos])) pos += 1;
  return pos;
};

const readName = (input: string, pos: number): { name: string; pos: number } => {
  let name = '';
  while (pos < input.length && isNameChar(input[pos])) {
    name += input[pos];
    pos += 1;
  }
  return { name, pos };
};

/**
 * Parses a single `{...}` argument starting at the opening brace.
 * @internal
 */
const parseArgument = (input: string, start: number): { node: IcuNode; pos: number } => {
  let pos = start + 1; // skip '{'
  pos = skipWs(input, pos);
  const nameRes = readName(input, pos);
  const name = nameRes.name;
  pos = skipWs(input, nameRes.pos);

  // Simple argument: `{name}`.
  if (input[pos] === '}') {
    return { node: { kind: 'arg', name }, pos: pos + 1 };
  }

  if (input[pos] !== ',') {
    throw new Error(`bQuery i18n: malformed ICU argument near "${input.slice(start, pos + 1)}".`);
  }
  pos = skipWs(input, pos + 1);

  const typeRes = readName(input, pos);
  const type = typeRes.name;
  pos = skipWs(input, typeRes.pos);

  if (input[pos] !== ',') {
    throw new Error(`bQuery i18n: ICU "${type}" argument requires options.`);
  }
  pos = skipWs(input, pos + 1);

  if (type === 'select') {
    const { cases, pos: end } = parseCases(input, pos, name, false);
    return { node: { kind: 'select', name, cases }, pos: end };
  }

  if (type === 'plural' || type === 'selectordinal') {
    let offset = 0;
    // Optional `offset:N` prefix (plural only, but tolerated for both).
    if (input.startsWith('offset:', pos)) {
      pos = skipWs(input, pos + 'offset:'.length);
      const numRes = readName(input, pos);
      offset = Number(numRes.name);
      pos = skipWs(input, numRes.pos);
    }
    const { cases, pos: end } = parseCases(input, pos, name, true);
    return {
      node: { kind: 'plural', name, ordinal: type === 'selectordinal', offset, cases },
      pos: end,
    };
  }

  throw new Error(`bQuery i18n: unsupported ICU argument type "${type}".`);
};

/**
 * Parses the selector → sub-message cases of a `plural`/`select` argument up
 * to the closing brace of the argument.
 * @internal
 */
const parseCases = (
  input: string,
  start: number,
  argName: string,
  plural: boolean
): { cases: Map<string, IcuNode[]>; pos: number } => {
  const cases = new Map<string, IcuNode[]>();
  let pos = start;

  while (pos < input.length && input[pos] !== '}') {
    pos = skipWs(input, pos);
    if (input[pos] === '}') break;

    // Selector: `=N` exact match or a keyword (one, few, male, …).
    let selector = '';
    if (input[pos] === '=') {
      selector = '=';
      pos += 1;
      const numRes = readName(input, pos);
      selector += numRes.name;
      pos = numRes.pos;
    } else {
      const kw = readName(input, pos);
      selector = kw.name;
      pos = kw.pos;
    }

    pos = skipWs(input, pos);
    if (input[pos] !== '{') {
      throw new Error(
        `bQuery i18n: expected "{" after selector "${selector}" in argument "${argName}".`
      );
    }

    const sub = parsePattern(input, pos + 1, plural ? argName : null);
    cases.set(selector, sub.nodes);
    pos = sub.pos + 1; // skip closing '}'
    pos = skipWs(input, pos);
  }

  return { cases, pos: pos + 1 }; // skip argument's closing '}'
};

/**
 * Renders parsed nodes against `params` for `locale`. `poundValue` carries the
 * active plural value (already offset-adjusted) so `#` formats correctly.
 * @internal
 */
const render = (
  nodes: IcuNode[],
  params: TranslateParams,
  locale: string,
  poundValue: number | null
): string => {
  let out = '';

  for (const node of nodes) {
    switch (node.kind) {
      case 'text':
        out += node.value;
        break;

      case 'pound':
        out += poundValue === null ? '#' : formatNumber(poundValue, locale);
        break;

      case 'arg':
        out += node.name in params ? String(params[node.name]) : `{${node.name}}`;
        break;

      case 'select': {
        const value = node.name in params ? String(params[node.name]) : 'other';
        const chosen = node.cases.get(value) ?? node.cases.get('other') ?? [];
        out += render(chosen, params, locale, poundValue);
        break;
      }

      case 'plural': {
        const raw = Number(params[node.name]);
        const value = Number.isFinite(raw) ? raw : 0;
        const adjusted = value - node.offset;

        let chosen = node.cases.get(`=${value}`);
        if (!chosen) {
          const category = selectPluralCategory(adjusted, locale, node.ordinal);
          chosen = node.cases.get(category) ?? node.cases.get('other') ?? [];
        }
        out += render(chosen, params, locale, adjusted);
        break;
      }
    }
  }

  return out;
};

const selectPluralCategory = (value: number, locale: string, ordinal: boolean): string => {
  try {
    return new Intl.PluralRules(locale, { type: ordinal ? 'ordinal' : 'cardinal' }).select(value);
  } catch {
    // Engines without the requested locale/PluralRules fall back to English-ish
    // cardinal behaviour so a missing ICU dataset never throws at render time.
    if (ordinal) return 'other';
    return value === 1 ? 'one' : 'other';
  }
};

const cache = new Map<string, IcuNode[]>();

/**
 * Formats an ICU MessageFormat string. Parsed ASTs are cached by template so
 * repeated translations of the same key avoid re-parsing.
 *
 * @internal
 */
export const formatICU = (template: string, params: TranslateParams, locale: string): string => {
  let nodes = cache.get(template);
  if (!nodes) {
    nodes = parsePattern(template, 0, null).nodes;
    cache.set(template, nodes);
  }
  return render(nodes, params, locale, null);
};
