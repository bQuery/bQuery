/**
 * DOM-free HTML sanitizer backend.
 *
 * `sanitizeHtml()` used to require `document` and `DOMParser`, so it threw on
 * every server runtime — in a framework that advertises runtime-agnostic SSR
 * and sanitizes DOM writes by default, the sanitizer was the one piece that
 * needed a browser (#229).
 *
 * This backend parses and re-serializes HTML with a small scanner instead, so
 * it runs anywhere. It shares every policy decision with the DOM backend via
 * `sanitize-policy.ts`; only the parsing and serialization differ.
 *
 * Two notes on the approach, both deliberate:
 *
 * - **It is a scanner, not an HTML5 tokenizer.** Where a browser would apply
 *   error recovery, this backend prefers to drop or escape. That can differ
 *   from the DOM backend on malformed input, and the difference always lands
 *   on the safe side: output is escaped rather than guessed at.
 * - **Output is re-parsed and compared**, exactly as the DOM backend does, so
 *   markup that changes shape on a second pass (mXSS) falls back to escaped
 *   text rather than being emitted.
 *
 * `src/ssr/html-parser.ts` solves a similar problem, but `security` is a leaf
 * module that `ssr` itself imports, so reusing it would invert the dependency
 * direction. The policy is shared; the scanner is not.
 *
 * @module bquery/security
 * @internal
 */

import {
  escapeHtmlText,
  isAllowedTag,
  isAttributeAllowed,
  isValidAttributeName,
  relForAnchor,
  resolvePolicy,
  suppressesTextContent,
  type SanitizePolicy,
} from './sanitize-policy';
import type { SanitizeOptions } from './types';
import { loadEntities } from './entities';

/** Elements that never have a closing tag. */
const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

/**
 * Elements whose content is text, not markup. Their content must be consumed
 * verbatim to the matching close tag — otherwise `<script>"</script>"</script>`
 * and friends re-enter markup parsing in the wrong place.
 */
const RAW_TEXT_ELEMENTS = new Set(['script', 'style', 'textarea', 'title', 'xmp']);

/**
 * Elements whose start tag may close itself with a trailing slash.
 *
 * Only these. HTML ignores the `/` in `<script/>` — the element still opens,
 * and everything up to `</script>` is its raw text — so honouring it for any
 * element let `<script/>alert(1)</script>` escape raw-text consumption and
 * surface `alert(1)` as ordinary text. `svg` and `math` are the exception:
 * they switch the tree builder into foreign content, where a self-closing
 * start tag is acknowledged.
 */
const SELF_CLOSING_ELEMENTS = new Set([...VOID_ELEMENTS, 'svg', 'math']);

const TAG_NAME = /^[a-zA-Z][a-zA-Z0-9:-]*/;

/**
 * Document-structure elements a real HTML parser absorbs rather than nests.
 *
 * The DOM backend parses into a document and lifts `body`'s children into the
 * fragment, so `<html>` and `<body>` never appear as elements to remove — but
 * their contents survive. Suppressing them here like any other disallowed tag
 * would discard an entire server-rendered page. `<head>` is deliberately not
 * in this set: its contents do not reach the body, so it is dropped whole.
 */
const TRANSPARENT_ELEMENTS = new Set(['html', 'body']);

/**
 * Elements whose close tag HTML lets you omit, and what opening them implies
 * should close first. `<ul><li>a<li>b</ul>` means two siblings, not nesting.
 */
const IMPLIED_END_TAGS: Record<string, ReadonlySet<string>> = {
  li: new Set(['li']),
  dt: new Set(['dt', 'dd']),
  dd: new Set(['dt', 'dd']),
  p: new Set(['p']),
  option: new Set(['option']),
  optgroup: new Set(['optgroup', 'option']),
  td: new Set(['td', 'th']),
  th: new Set(['td', 'th']),
  tr: new Set(['tr', 'td', 'th']),
  tbody: new Set(['thead', 'tbody', 'tfoot', 'tr', 'td', 'th']),
  tfoot: new Set(['thead', 'tbody', 'tfoot', 'tr', 'td', 'th']),
  thead: new Set(['thead', 'tbody', 'tfoot', 'tr', 'td', 'th']),
};

/** The longest legacy name (`frac12`, `Ccedil`, …), which bounds the prefix search. */
const LEGACY_MAX_LENGTH = 6;

/**
 * What a browser substitutes for `&#128;`–`&#159;`: those are C1 controls in
 * Unicode, but the spec reads them as windows-1252, as legacy pages meant.
 */
const C1_REPLACEMENTS: Readonly<Record<number, number>> = {
  0x80: 0x20ac,
  0x82: 0x201a,
  0x83: 0x0192,
  0x84: 0x201e,
  0x85: 0x2026,
  0x86: 0x2020,
  0x87: 0x2021,
  0x88: 0x02c6,
  0x89: 0x2030,
  0x8a: 0x0160,
  0x8b: 0x2039,
  0x8c: 0x0152,
  0x8e: 0x017d,
  0x91: 0x2018,
  0x92: 0x2019,
  0x93: 0x201c,
  0x94: 0x201d,
  0x95: 0x2022,
  0x96: 0x2013,
  0x97: 0x2014,
  0x98: 0x02dc,
  0x99: 0x2122,
  0x9a: 0x0161,
  0x9b: 0x203a,
  0x9c: 0x0153,
  0x9e: 0x017e,
  0x9f: 0x0178,
};

const decodeNumeric = (digits: string, radix: number): string => {
  const num = Number.parseInt(digits, radix);
  if (num === 0 || num > 0x10ffff || (num >= 0xd800 && num <= 0xdfff)) return '\ufffd';
  return String.fromCodePoint(C1_REPLACEMENTS[num] ?? num);
};

const ATTRIBUTE_BLOCKER = /[=a-zA-Z0-9]/;

/**
 * Decode character references the way an HTML parser does.
 *
 * Decoding matters for safety, not convenience: the policy checks run on
 * decoded values, so `href="javas&#99;ript:alert(1)"` is compared against the
 * dangerous-protocol list as `javascript:alert(1)` rather than slipping past
 * as an unrecognized string. Everything is re-escaped on the way out.
 *
 * It follows the tokenizer's rules rather than approximating them, because
 * the DOM backend gets those rules from the browser and the two must agree:
 *
 * - names are case-sensitive (`&Eacute;` is not `&eacute;`);
 * - only the legacy names decode without a `;`, and they match as a prefix,
 *   longest first (`&notit;` is `¬it;`);
 * - `inAttribute` applies the rule that keeps query strings intact: a legacy
 *   name without `;` followed by `=` or an alphanumeric stays literal, so
 *   `href="?a=1&copy=2"` is not rewritten to `?a=1©=2`.
 *
 * Names outside `ENTITY_RUNS` stay literal — see `entities.ts` for why the
 * table is a subset and why that can only fall short of a browser, never
 * contradict it.
 * @internal
 */
export const decodeEntities = (input: string, inAttribute = false): string => {
  if (!input.includes('&')) return input;
  const { named, legacy } = loadEntities();
  return input.replace(
    /&(?:#(?:[xX]([0-9a-fA-F]+)|([0-9]+));?|([a-zA-Z0-9]+)(;?))/g,
    (match, hex: string, dec: string, name: string, semi: string, offset: number) => {
      if (hex !== undefined) return decodeNumeric(hex, 16);
      if (dec !== undefined) return decodeNumeric(dec, 10);
      if (semi && named.has(name)) return named.get(name) as string;
      for (let length = Math.min(name.length, LEGACY_MAX_LENGTH); length >= 2; length--) {
        const prefix = name.slice(0, length);
        if (!legacy.has(prefix)) continue;
        // `name` is a maximal alphanumeric run, so when the prefix is all of it
        // the next character is whatever follows the match (`;` was ruled out
        // above: every legacy name also exists with one).
        const next = length < name.length ? name[length] : input[offset + match.length];
        if (inAttribute && next !== undefined && ATTRIBUTE_BLOCKER.test(next)) return match;
        return (named.get(prefix) as string) + name.slice(length) + semi;
      }
      return match;
    }
  );
};

/** Escape a value for use inside a double-quoted attribute. */
const escapeAttribute = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Escape text content. `&` first, so escapes are not double-escaped. */
const escapeText = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

interface Attribute {
  name: string;
  value: string;
}

interface OpenTag {
  kind: 'open';
  tag: string;
  attributes: Attribute[];
  selfClosing: boolean;
}

interface CloseTag {
  kind: 'close';
  tag: string;
}

interface TextToken {
  kind: 'text';
  value: string;
}

type Token = OpenTag | CloseTag | TextToken;

const isWhitespace = (char: string): boolean =>
  char === ' ' || char === '\t' || char === '\n' || char === '\r' || char === '\f';

/**
 * Read the attributes of an open tag, starting just after the tag name.
 * Returns the attributes and the index just past the closing `>`.
 */
const readAttributes = (
  source: string,
  start: number
): { attributes: Attribute[]; end: number; selfClosing: boolean } => {
  const attributes: Attribute[] = [];
  let pos = start;
  let selfClosing = false;

  while (pos < source.length) {
    while (pos < source.length && isWhitespace(source[pos])) pos++;
    if (pos >= source.length) break;

    if (source[pos] === '>') {
      pos++;
      break;
    }
    if (source[pos] === '/' && source[pos + 1] === '>') {
      selfClosing = true;
      pos += 2;
      break;
    }
    // A stray `/` inside the tag — skip it rather than reading it as a name.
    if (source[pos] === '/') {
      pos++;
      continue;
    }

    const nameStart = pos;
    while (
      pos < source.length &&
      !isWhitespace(source[pos]) &&
      source[pos] !== '=' &&
      source[pos] !== '>' &&
      source[pos] !== '/'
    ) {
      pos++;
    }
    const name = source.slice(nameStart, pos);
    if (name.length === 0) {
      pos++;
      continue;
    }

    while (pos < source.length && isWhitespace(source[pos])) pos++;

    let value = '';
    if (source[pos] === '=') {
      pos++;
      while (pos < source.length && isWhitespace(source[pos])) pos++;
      const quote = source[pos];
      if (quote === '"' || quote === "'") {
        pos++;
        const valueStart = pos;
        const closing = source.indexOf(quote, pos);
        if (closing === -1) {
          value = source.slice(valueStart);
          pos = source.length;
        } else {
          value = source.slice(valueStart, closing);
          pos = closing + 1;
        }
      } else {
        const valueStart = pos;
        while (pos < source.length && !isWhitespace(source[pos]) && source[pos] !== '>') pos++;
        value = source.slice(valueStart, pos);
      }
    }

    attributes.push({ name, value: decodeEntities(value, true) });
  }

  return { attributes, end: pos, selfClosing };
};

/**
 * Tokenize HTML into open tags, close tags and text.
 *
 * Anything that is not recognizable markup — a bare `<`, an unterminated tag,
 * a comment, a doctype, a processing instruction — becomes text or is
 * discarded. Nothing is passed through as raw markup.
 * @internal
 */
export const tokenize = (html: string): Token[] => {
  const tokens: Token[] = [];
  let pos = 0;
  let textStart = 0;
  // Lowercased once, not per raw-text element: recomputing it inside the loop
  // made tokenization O(raw-text elements x input length), so a megabyte of
  // `<textarea>` blocked the event loop for seconds on the `ctx.html()` path.
  const lowerHtml = html.toLowerCase();

  const flushText = (end: number): void => {
    if (end > textStart) {
      tokens.push({ kind: 'text', value: decodeEntities(html.slice(textStart, end)) });
    }
  };

  while (pos < html.length) {
    const lt = html.indexOf('<', pos);
    if (lt === -1) break;

    // Comments, CDATA, doctypes and processing instructions carry no content
    // worth keeping, and a conditional comment can hide markup — drop them.
    if (html.startsWith('<!--', lt)) {
      flushText(lt);
      const end = html.indexOf('-->', lt + 4);
      pos = end === -1 ? html.length : end + 3;
      textStart = pos;
      continue;
    }
    if (html[lt + 1] === '!' || html[lt + 1] === '?') {
      flushText(lt);
      const end = html.indexOf('>', lt + 2);
      pos = end === -1 ? html.length : end + 1;
      textStart = pos;
      continue;
    }

    if (html[lt + 1] === '/') {
      const match = TAG_NAME.exec(html.slice(lt + 2));
      if (!match) {
        pos = lt + 1;
        continue;
      }
      flushText(lt);
      const end = html.indexOf('>', lt + 2);
      tokens.push({ kind: 'close', tag: match[0].toLowerCase() });
      pos = end === -1 ? html.length : end + 1;
      textStart = pos;
      continue;
    }

    const match = TAG_NAME.exec(html.slice(lt + 1));
    if (!match) {
      // A `<` that does not start a tag is literal text.
      pos = lt + 1;
      continue;
    }

    flushText(lt);
    const tag = match[0].toLowerCase();
    const {
      attributes,
      end,
      selfClosing: slashed,
    } = readAttributes(html, lt + 1 + match[0].length);
    // A trailing slash only closes a tag that is allowed to close itself; on
    // anything else HTML drops it, and so do we.
    const selfClosing = slashed && SELF_CLOSING_ELEMENTS.has(tag);
    tokens.push({ kind: 'open', tag, attributes, selfClosing });
    pos = end;
    textStart = pos;

    // Raw-text elements: consume to the matching close tag so their content is
    // never re-entered as markup.
    if (RAW_TEXT_ELEMENTS.has(tag) && !selfClosing) {
      const closeIndex = lowerHtml.indexOf(`</${tag}`, pos);
      const contentEnd = closeIndex === -1 ? html.length : closeIndex;
      const rawContent = html.slice(pos, contentEnd);
      // `textarea`, `title` and `xmp` are RCDATA, not true raw text: entities
      // do decode in them. The token is re-escaped on output, so leaving it
      // undecoded here made every sanitize pass escape one level deeper and
      // the mXSS stability check could never agree — a single `<textarea>`
      // containing `&` collapsed the whole document to escaped plain text.
      // `script` and `style` are true raw text, but both are dangerous tags
      // and get dropped wholesale before this matters.
      if (rawContent.length > 0) tokens.push({ kind: 'text', value: decodeEntities(rawContent) });
      tokens.push({ kind: 'close', tag });
      if (closeIndex === -1) {
        pos = html.length;
      } else {
        const gt = html.indexOf('>', closeIndex);
        pos = gt === -1 ? html.length : gt + 1;
      }
      textStart = pos;
    }
  }

  flushText(html.length);
  return tokens;
};

/** Render one open tag's surviving attributes. */
const renderAttributes = (
  tag: string,
  attributes: Attribute[],
  policy: SanitizePolicy,
  seenIds: Set<string>
): string => {
  let out = '';
  const kept = new Map<string, string>();
  // Every name the tokenizer produced, allowed or not. The HTML parser drops
  // duplicates at tokenization time, before any policy runs, so deduplicating
  // only among *surviving* attributes would give an attacker a second attempt
  // at every attribute the policy just rejected.
  const seenNames = new Set<string>();

  for (const attr of attributes) {
    const name = attr.name.toLowerCase();
    // `readAttributes` ends a name at whitespace, `=`, `>` and `/`, so `"`,
    // `'` and `<` are legal name characters — and a `data-`/`aria-` prefix is
    // enough for the policy to keep one. Serializing such a name unescaped
    // emits markup whose meaning depends on how forgiving the consumer's
    // parser is; happy-dom, this repo's own DOM, splits it back into a live
    // event handler. Never emit a name we cannot quote safely.
    if (!isValidAttributeName(name)) continue;
    if (seenNames.has(name)) continue; // first wins, as the DOM does
    seenNames.add(name);
    if (!isAttributeAllowed(name, attr.value, policy, seenIds)) continue;
    kept.set(name, attr.value);
  }

  if (tag === 'a') {
    const rel = relForAnchor(
      kept.get('href') ?? null,
      kept.get('target') ?? null,
      kept.get('rel') ?? null
    );
    if (rel !== null) kept.set('rel', rel);
  }

  for (const [name, value] of kept) {
    out += ` ${name}="${escapeAttribute(value)}"`;
  }

  return out;
};

/**
 * Sanitize HTML without a DOM, in a single pass over the token stream.
 * @internal
 */
const sanitizePass = (html: string, policy: SanitizePolicy): string => {
  const tokens = tokenize(html);
  const seenIds = new Set<string>();

  if (policy.stripAllTags) {
    let text = '';
    // Drop the content of dangerous elements entirely rather than surfacing
    // script source as "text". `suppressesTextContent` owns the rule so the
    // DOM backend drops exactly the same subtrees.
    let suppressDepth = 0;
    let suppressTag: string | null = null;
    for (const token of tokens) {
      if (token.kind === 'open' && suppressesTextContent(token.tag) && !token.selfClosing) {
        if (suppressDepth === 0) suppressTag = token.tag;
        if (token.tag === suppressTag) suppressDepth++;
        continue;
      }
      if (token.kind === 'close' && token.tag === suppressTag) {
        suppressDepth = Math.max(0, suppressDepth - 1);
        if (suppressDepth === 0) suppressTag = null;
        continue;
      }
      if (suppressDepth > 0) continue;
      if (token.kind === 'text') text += token.value;
    }
    return text;
  }

  let out = '';
  // The elements currently open in the output, so close tags can be matched
  // and anything still open at the end can be closed. Without this the output
  // is unbalanced — a stray `</div>` survives, and `<p>unclosed` never closes.
  const openStack: string[] = [];
  let suppressDepth = 0;
  let suppressTag: string | null = null;

  for (const token of tokens) {
    if (suppressDepth > 0) {
      if (token.kind === 'open' && token.tag === suppressTag && !token.selfClosing) {
        suppressDepth++;
      } else if (token.kind === 'close' && token.tag === suppressTag) {
        suppressDepth--;
        if (suppressDepth === 0) suppressTag = null;
      }
      continue;
    }

    if (token.kind === 'text') {
      out += escapeText(token.value);
      continue;
    }

    if (token.kind === 'open') {
      // Any element that may not appear takes its subtree with it, whether it
      // is dangerous (`<script>alert(1)` must not leave `alert(1)` as text) or
      // merely disallowed. The DOM backend calls `Element.remove()`, which
      // detaches the children too, so unwrapping here would make the string
      // backend the *less* conservative of the two on well-formed input — and
      // would leak `<head>`/`<title>` content into the body server-side.
      if (!isAllowedTag(token.tag, policy)) {
        // `<html>`/`<body>` are structure, not content: unwrap them so a whole
        // server-rendered page is not discarded.
        if (TRANSPARENT_ELEMENTS.has(token.tag)) continue;
        if (!token.selfClosing && !VOID_ELEMENTS.has(token.tag)) {
          suppressTag = token.tag;
          suppressDepth = 1;
        }
        continue;
      }

      // Close any element this one implicitly ends, so `<li>a<li>b` produces
      // siblings rather than `<li>a<li>b</li></li>`.
      const implied = IMPLIED_END_TAGS[token.tag];
      if (implied) {
        while (openStack.length > 0 && implied.has(openStack[openStack.length - 1])) {
          out += `</${openStack.pop() as string}>`;
        }
      }

      out += `<${token.tag}${renderAttributes(token.tag, token.attributes, policy, seenIds)}>`;
      if (VOID_ELEMENTS.has(token.tag)) continue;
      if (token.selfClosing) {
        out += `</${token.tag}>`;
        continue;
      }
      openStack.push(token.tag);
      continue;
    }

    // close
    if (VOID_ELEMENTS.has(token.tag)) continue;
    if (!isAllowedTag(token.tag, policy)) continue;

    // Close tag with no matching open tag — a stray `</div>`. Drop it rather
    // than emitting markup that reaches outside this fragment.
    const openIndex = openStack.lastIndexOf(token.tag);
    if (openIndex === -1) continue;

    // Close any elements left open inside this one, innermost first, so the
    // output nests correctly for `<b><i></b>`.
    for (let depth = openStack.length - 1; depth >= openIndex; depth--) {
      out += `</${openStack[depth]}>`;
    }
    openStack.length = openIndex;
  }

  // Close whatever the input left open.
  for (let depth = openStack.length - 1; depth >= 0; depth--) {
    out += `</${openStack[depth]}>`;
  }

  return out;
};

/**
 * Sanitize HTML with no DOM available.
 *
 * Mirrors the DOM backend's contract, including its mutation-XSS guard: the
 * output is sanitized a second time and, if the two passes disagree, the
 * escaped text content is returned instead of markup whose meaning changes
 * when it is re-parsed.
 * @internal
 */
export const sanitizeHtmlString = (html: string, options: SanitizeOptions = {}): string => {
  const input = (typeof html === 'string' ? html : String(html ?? '')).trim();
  if (input.length === 0) return '';

  const policy = resolvePolicy(options);
  const firstPass = sanitizePass(input, policy);
  // Escaped, unlike `stripTagsString`: this return value is branded
  // `SanitizedHtml` and callers assign it to HTML sinks, and extracted text
  // can carry live markup once its entities are decoded. The mXSS fallback
  // below escapes for exactly the same reason.
  if (policy.stripAllTags) return escapeHtmlText(firstPass);

  const secondPass = sanitizePass(firstPass, policy);
  if (firstPass !== secondPass) {
    return escapeHtmlText(sanitizePass(input, { ...policy, stripAllTags: true }));
  }

  return secondPass;
};

/** Plain-text extraction with no DOM. @internal */
export const stripTagsString = (html: string): string =>
  sanitizePass(
    (typeof html === 'string' ? html : String(html ?? '')).trim(),
    resolvePolicy({ stripAllTags: true })
  );
