/**
 * Source scanning for translatable messages.
 *
 * Dependency-free, best-effort extraction: it recognises two anchors without
 * needing a full JavaScript parser —
 *
 * 1. `defineMessages({ ... })` catalog literals — keys **and** their default
 *    message strings are extracted.
 * 2. `t('key')` / `tc('key')` / `i18n.t('key')` translation calls — the key is
 *    extracted with an empty default (a string awaiting translation).
 *
 * The scanner is intentionally conservative: anything it cannot understand as a
 * string or nested object is skipped rather than guessed at.
 *
 * @module bquery/i18n
 */

/** A nested catalog of message strings. */
export type ExtractedCatalog = { [key: string]: string | ExtractedCatalog };

/** A single extracted message, keyed by its dot-delimited path. */
export type ExtractedMessage = { key: string; value: string };

const isIdentChar = (ch: string): boolean => /[A-Za-z0-9_$]/.test(ch);

/** Advances past whitespace and `//` / block comments. */
const skipTrivia = (src: string, start: number): number => {
  let i = start;
  while (i < src.length) {
    const ch = src[i];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i += 1;
      continue;
    }
    if (ch === '/' && src[i + 1] === '/') {
      i += 2;
      while (i < src.length && src[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    break;
  }
  return i;
};

const readIdent = (src: string, start: number): { value: string; end: number } => {
  let i = start;
  let value = '';
  while (i < src.length && isIdentChar(src[i])) {
    value += src[i];
    i += 1;
  }
  return { value, end: i };
};

const UNESCAPE: Record<string, string> = { n: '\n', t: '\t', r: '\r', '\\': '\\', '`': '`' };

/** Reads a quoted string literal (`'`, `"`, or `` ` ``) and unescapes it. */
const readString = (src: string, start: number): { value: string; end: number } => {
  const quote = src[start];
  let i = start + 1;
  let value = '';
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') {
      const next = src[i + 1];
      value += UNESCAPE[next] ?? next;
      i += 2;
      continue;
    }
    if (ch === quote) {
      i += 1;
      break;
    }
    value += ch;
    i += 1;
  }
  return { value, end: i };
};

/** Skips a value that is neither a string nor an object, up to the enclosing `,`/`}`. */
const skipValue = (src: string, start: number): number => {
  let i = start;
  let depth = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      i = readString(src, i).end;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    else if (ch === ')' || ch === ']' || ch === '}') {
      if (depth === 0) break;
      depth -= 1;
    } else if (ch === ',' && depth === 0) break;
    i += 1;
  }
  return i;
};

/** Parses an object literal beginning at `{`. */
const parseObjectLiteral = (
  src: string,
  start: number
): { value: ExtractedCatalog; end: number } => {
  const obj: ExtractedCatalog = {};
  let i = start + 1;

  while (i < src.length) {
    i = skipTrivia(src, i);
    if (src[i] === '}') {
      i += 1;
      break;
    }
    if (src[i] === ',') {
      i += 1;
      continue;
    }

    // Key — identifier or quoted string.
    let key: string;
    if (src[i] === '"' || src[i] === "'" || src[i] === '`') {
      const r = readString(src, i);
      key = r.value;
      i = r.end;
    } else {
      const r = readIdent(src, i);
      if (!r.value) {
        i += 1;
        continue;
      }
      key = r.value;
      i = r.end;
    }

    i = skipTrivia(src, i);
    if (src[i] !== ':') continue; // not a key:value pair (e.g. shorthand) — skip
    i = skipTrivia(src, i + 1);

    if (src[i] === '{') {
      const r = parseObjectLiteral(src, i);
      obj[key] = r.value;
      i = r.end;
    } else if (src[i] === '"' || src[i] === "'" || src[i] === '`') {
      const r = readString(src, i);
      obj[key] = r.value;
      i = r.end;
    } else {
      i = skipValue(src, i);
    }
  }

  return { value: obj, end: i };
};

/** Flattens a nested catalog into dot-delimited `key → value` entries. */
export const flatten = (catalog: ExtractedCatalog, prefix = ''): ExtractedMessage[] => {
  const out: ExtractedMessage[] = [];
  for (const [key, value] of Object.entries(catalog)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.push({ key: path, value });
    else out.push(...flatten(value, path));
  }
  return out;
};

/**
 * Reconstructs a nested catalog from sorted dot-delimited entries.
 *
 * Keys are scanned from untrusted source files, so a `__proto__`, `constructor`
 * or `prototype` segment is rejected inline — right where each computed-property
 * assignment happens — to stop a malicious key from walking into or overwriting
 * the prototype chain.
 */
export const unflatten = (messages: ExtractedMessage[]): ExtractedCatalog => {
  const root: ExtractedCatalog = {};
  for (const { key, value } of [...messages].sort((a, b) => a.key.localeCompare(b.key))) {
    const parts = key.split('.');
    let node: ExtractedCatalog | null = root;
    for (let p = 0; p < parts.length - 1 && node !== null; p += 1) {
      const part = parts[p];
      if (part === '__proto__' || part === 'constructor' || part === 'prototype') {
        node = null;
        break;
      }
      const child = node[part];
      if (typeof child === 'object' && child !== null) {
        node = child as ExtractedCatalog;
      } else {
        const created: ExtractedCatalog = {};
        node[part] = created;
        node = created;
      }
    }
    if (node === null) continue;
    const leaf = parts[parts.length - 1];
    if (leaf === '__proto__' || leaf === 'constructor' || leaf === 'prototype') continue;
    node[leaf] = value;
  }
  return root;
};

const DEFINE_RE = /\bdefineMessages\s*\(/g;
// `t('key')`, `tc('key')`, `i18n.t('key')` — first arg is a string literal.
// A `.` may precede the call (instance method), but a preceding word char
// must not (so `format(`, `connect(` etc. never match).
const CALL_RE = /(?:^|[^\w$])(t|tc)\s*\(\s*(['"`])((?:\\.|(?!\2).)*)\2/g;

/**
 * Removes `//` and block comments while preserving string and template
 * literals, so call/catalog scanning never trips on commented-out code.
 */
const stripComments = (src: string): string => {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      const start = i;
      i += 1;
      while (i < src.length) {
        if (src[i] === '\\') {
          i += 2;
          continue;
        }
        if (src[i] === ch) {
          i += 1;
          break;
        }
        i += 1;
      }
      out += src.slice(start, i);
      continue;
    }
    if (ch === '/' && src[i + 1] === '/') {
      i += 2;
      while (i < src.length && src[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
};

/**
 * Extracts every translatable message from a single source string.
 *
 * `defineMessages` catalogs contribute their keys **and** default values;
 * `t()` / `tc()` calls contribute keys with an empty default. Duplicate keys
 * keep the first non-empty value seen.
 *
 * @param source - File contents to scan
 * @returns Flat, de-duplicated extracted messages
 */
export const extractFromSource = (rawSource: string): ExtractedMessage[] => {
  const source = stripComments(rawSource);
  const found = new Map<string, string>();
  const add = (key: string, value: string): void => {
    const existing = found.get(key);
    if (existing === undefined || (existing === '' && value !== '')) found.set(key, value);
  };

  // defineMessages({ ... }) catalogs.
  DEFINE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = DEFINE_RE.exec(source)) !== null) {
    const braceStart = skipTrivia(source, match.index + match[0].length);
    if (source[braceStart] !== '{') continue;
    const { value } = parseObjectLiteral(source, braceStart);
    for (const entry of flatten(value)) add(entry.key, entry.value);
  }

  // t('key') / tc('key') calls.
  CALL_RE.lastIndex = 0;
  while ((match = CALL_RE.exec(source)) !== null) {
    add(match[3], '');
  }

  return [...found.entries()].map(([key, value]) => ({ key, value }));
};
