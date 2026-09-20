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

import { DANGEROUS_TAGS } from './constants';
import {
  escapeHtmlText,
  isAllowedTag,
  isAttributeAllowed,
  relForAnchor,
  resolvePolicy,
  type SanitizePolicy,
} from './sanitize-policy';
import type { SanitizeOptions } from './types';

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

const TAG_NAME = /^[a-zA-Z][a-zA-Z0-9:-]*/;

/**
 * An attribute name safe to serialize into a tag. Deliberately stricter than
 * what the HTML spec tolerates: anything outside this shape is dropped rather
 * than emitted, so the output cannot depend on a consumer's error recovery.
 */
const VALID_ATTRIBUTE_NAME = /^[a-zA-Z_:][a-zA-Z0-9_:.-]*$/;

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

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/**
 * Decode HTML entities in text content.
 *
 * Decoding matters for safety, not convenience: the policy checks run on
 * decoded values, so `href="javas&#99;ript:alert(1)"` is compared against the
 * dangerous-protocol list as `javascript:alert(1)` rather than slipping past
 * as an unrecognized string. Everything is re-escaped on the way out.
 * @internal
 */
export const decodeEntities = (input: string): string => {
  if (!input.includes('&')) return input;
  return input.replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);?/g, (match, code: string) => {
    if (code[0] === '#') {
      const isHex = code[1] === 'x' || code[1] === 'X';
      const num = Number.parseInt(code.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (!Number.isFinite(num) || num < 0 || num > 0x10ffff) return match;
      try {
        return String.fromCodePoint(num);
      } catch {
        return match;
      }
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
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

    attributes.push({ name, value: decodeEntities(value) });
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
    const { attributes, end, selfClosing } = readAttributes(html, lt + 1 + match[0].length);
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
    if (!VALID_ATTRIBUTE_NAME.test(name)) continue;
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
    // script source as "text".
    let suppressDepth = 0;
    let suppressTag: string | null = null;
    for (const token of tokens) {
      if (token.kind === 'open' && DANGEROUS_TAGS.has(token.tag) && !token.selfClosing) {
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
  if (policy.stripAllTags) return firstPass;

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
