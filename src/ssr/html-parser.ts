/**
 * Minimal, runtime-agnostic HTML parser for the SSR renderer.
 *
 * This is intentionally a small, linear scanner rather than a full HTML5
 * tokenizer. It is sufficient for templates authored against the `bQuery`
 * directive vocabulary (HTML fragments, common void/raw elements, attributes)
 * and lets the SSR pipeline run on Bun, Deno and Node without depending on a
 * `DOMParser` polyfill.
 *
 * Output: a tiny virtual node tree (`SSRNode`) compatible with the pluggable
 * DOM adapter API used by `renderer.ts`.
 *
 * @module bquery/ssr
 * @internal
 */

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

const RAW_TEXT_ELEMENTS = new Set(['script', 'style', 'textarea', 'title']);

/** A DOM-free node structure produced by `parseTemplate()`. */
export type SSRNode = SSRElement | SSRText | SSRComment | SSRDocumentFragment;

export interface SSRElement {
  type: 'element';
  tag: string;
  attributes: Record<string, string>;
  /** Order-preserving attribute list (so output is deterministic). */
  attributeOrder: string[];
  children: SSRNode[];
  /** Whether this element should be serialised as a void element. */
  void: boolean;
  /** Whether the children are raw (e.g. `<script>` content). */
  raw: boolean;
}

export interface SSRText {
  type: 'text';
  value: string;
}

export interface SSRComment {
  type: 'comment';
  value: string;
}

export interface SSRDocumentFragment {
  type: 'fragment';
  children: SSRNode[];
}

const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
};

/**
 * Decodes the named/numeric HTML entities the SSR parser actually needs.
 * Anything else is preserved verbatim.
 */
export const decodeEntities = (input: string): string => {
  if (input.indexOf('&') === -1) return input;
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, code: string) => {
    if (code[0] === '#') {
      const isHex = code[1] === 'x' || code[1] === 'X';
      const num = parseInt(code.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (Number.isFinite(num)) {
        try {
          return String.fromCodePoint(num);
        } catch {
          return match;
        }
      }
      return match;
    }
    const name = code.toLowerCase();
    return HTML_ENTITIES[name] ?? match;
  });
};

interface ParseState {
  src: string;
  pos: number;
}

const isWs = (ch: string): boolean =>
  ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f';

const skipWs = (s: ParseState): void => {
  while (s.pos < s.src.length && isWs(s.src[s.pos])) s.pos++;
};

const readUntil = (s: ParseState, stop: string): string => {
  const start = s.pos;
  const idx = s.src.indexOf(stop, start);
  if (idx === -1) {
    s.pos = s.src.length;
    return s.src.slice(start);
  }
  s.pos = idx;
  return s.src.slice(start, idx);
};

const readTagName = (s: ParseState): string => {
  const start = s.pos;
  while (s.pos < s.src.length) {
    const ch = s.src[s.pos];
    if (isWs(ch) || ch === '>' || ch === '/') break;
    s.pos++;
  }
  return s.src.slice(start, s.pos).toLowerCase();
};

const readAttrName = (s: ParseState): string => {
  const start = s.pos;
  while (s.pos < s.src.length) {
    const ch = s.src[s.pos];
    if (isWs(ch) || ch === '=' || ch === '>' || ch === '/') break;
    s.pos++;
  }
  return s.src.slice(start, s.pos);
};

const readAttrValue = (s: ParseState): string => {
  const ch = s.src[s.pos];
  if (ch === '"' || ch === "'") {
    const quote = ch;
    s.pos++;
    const start = s.pos;
    while (s.pos < s.src.length && s.src[s.pos] !== quote) s.pos++;
    const value = s.src.slice(start, s.pos);
    if (s.pos < s.src.length) s.pos++; // consume closing quote
    return decodeEntities(value);
  }
  // Unquoted
  const start = s.pos;
  while (s.pos < s.src.length) {
    const c = s.src[s.pos];
    if (isWs(c) || c === '>' || (c === '/' && s.src[s.pos + 1] === '>')) break;
    s.pos++;
  }
  return decodeEntities(s.src.slice(start, s.pos));
};

const parseAttributes = (
  s: ParseState
): { attributes: Record<string, string>; order: string[]; selfClose: boolean } => {
  const attributes: Record<string, string> = Object.create(null) as Record<string, string>;
  const order: string[] = [];
  let selfClose = false;

  while (s.pos < s.src.length) {
    skipWs(s);
    const ch = s.src[s.pos];
    if (ch === '>') {
      s.pos++;
      break;
    }
    if (ch === '/') {
      s.pos++;
      skipWs(s);
      if (s.src[s.pos] === '>') {
        selfClose = true;
        s.pos++;
        break;
      }
      continue;
    }
    if (s.pos >= s.src.length) break;

    const name = readAttrName(s);
    if (!name) {
      // Defensive: skip ahead to the next whitespace, '/' or '>' to avoid
      // pathological 1-char-per-iteration advancement on malformed input.
      while (s.pos < s.src.length) {
        const c = s.src[s.pos];
        if (isWs(c) || c === '>' || c === '/') break;
        s.pos++;
      }
      continue;
    }
    skipWs(s);
    let value = '';
    if (s.src[s.pos] === '=') {
      s.pos++;
      skipWs(s);
      value = readAttrValue(s);
    }
    if (!(name in attributes)) {
      order.push(name);
    }
    attributes[name] = value;
  }

  return { attributes, order, selfClose };
};

/**
 * Parses an HTML template string into a virtual node tree without depending
 * on a DOM implementation. The parser is intentionally permissive: it does
 * not validate nesting, but it preserves attribute order and never throws on
 * malformed input.
 */
export const parseTemplate = (template: string): SSRDocumentFragment => {
  const s: ParseState = { src: template, pos: 0 };
  const root: SSRDocumentFragment = { type: 'fragment', children: [] };
  // Open-element stack so children attach to the correct parent.
  const stack: Array<SSRElement | SSRDocumentFragment> = [root];

  const top = (): SSRElement | SSRDocumentFragment => stack[stack.length - 1];

  while (s.pos < s.src.length) {
    if (s.src[s.pos] === '<') {
      // Comment
      if (s.src.startsWith('<!--', s.pos)) {
        s.pos += 4;
        const end = s.src.indexOf('-->', s.pos);
        const value = end === -1 ? s.src.slice(s.pos) : s.src.slice(s.pos, end);
        s.pos = end === -1 ? s.src.length : end + 3;
        top().children.push({ type: 'comment', value });
        continue;
      }
      // Doctype/processing instruction — skip silently
      if (s.src.startsWith('<!', s.pos) || s.src.startsWith('<?', s.pos)) {
        const end = s.src.indexOf('>', s.pos);
        s.pos = end === -1 ? s.src.length : end + 1;
        continue;
      }

      // Closing tag
      if (s.src[s.pos + 1] === '/') {
        s.pos += 2;
        const name = readTagName(s);
        const end = s.src.indexOf('>', s.pos);
        s.pos = end === -1 ? s.src.length : end + 1;
        // Pop the matching element if found, otherwise ignore.
        for (let i = stack.length - 1; i > 0; i--) {
          const node = stack[i];
          if (node.type === 'element' && node.tag === name) {
            stack.length = i;
            break;
          }
        }
        continue;
      }

      // Opening tag
      if (s.pos + 1 < s.src.length && /[a-zA-Z]/.test(s.src[s.pos + 1])) {
        s.pos++;
        const tag = readTagName(s);
        const { attributes, order, selfClose } = parseAttributes(s);
        const isVoid = VOID_ELEMENTS.has(tag);
        const element: SSRElement = {
          type: 'element',
          tag,
          attributes,
          attributeOrder: order,
          children: [],
          void: isVoid,
          raw: RAW_TEXT_ELEMENTS.has(tag),
        };
        top().children.push(element);

        if (isVoid || selfClose) {
          // Don't push onto stack.
          continue;
        }

        if (element.raw) {
          // Raw-text element: read until matching close tag.
          const closeTag = `</${tag}`;
          const start = s.pos;
          const lower = s.src.toLowerCase();
          const idx = lower.indexOf(closeTag, start);
          const rawText = idx === -1 ? s.src.slice(start) : s.src.slice(start, idx);
          if (rawText) {
            element.children.push({ type: 'text', value: rawText });
          }
          if (idx === -1) {
            s.pos = s.src.length;
          } else {
            s.pos = idx;
            // Consume the </tag>
            const close = s.src.indexOf('>', s.pos);
            s.pos = close === -1 ? s.src.length : close + 1;
          }
          continue;
        }

        stack.push(element);
        continue;
      }

      top().children.push({ type: 'text', value: '<' });
      s.pos++;
      continue;
    }

    // Plain text
    const text = readUntil(s, '<');
    if (text) {
      top().children.push({ type: 'text', value: decodeEntities(text) });
    }
  }

  return root;
};

const escapeText = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escapeAttr = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Serialises a virtual node tree to an HTML string. */
export const serializeTree = (node: SSRNode): string => {
  if (node.type === 'text') return escapeText(node.value);
  if (node.type === 'comment') return `<!--${node.value}-->`;
  if (node.type === 'fragment') {
    let out = '';
    for (const child of node.children) out += serializeTree(child);
    return out;
  }

  const el = node;
  let attrs = '';
  for (const name of el.attributeOrder) {
    const value = el.attributes[name];
    attrs += ` ${name}="${escapeAttr(value)}"`;
  }

  if (el.void) {
    return `<${el.tag}${attrs}>`;
  }

  let inner = '';
  if (el.raw) {
    // Raw-text elements: don't escape children, they're already raw text.
    for (const child of el.children) {
      if (child.type === 'text') inner += child.value;
    }
  } else {
    for (const child of el.children) inner += serializeTree(child);
  }

  return `<${el.tag}${attrs}>${inner}</${el.tag}>`;
};

/** Recursively clones a virtual node (used by `bq-for`). */
export const cloneNode = (node: SSRNode): SSRNode => {
  if (node.type === 'element') {
    return {
      type: 'element',
      tag: node.tag,
      attributes: { ...node.attributes },
      attributeOrder: [...node.attributeOrder],
      children: node.children.map(cloneNode),
      void: node.void,
      raw: node.raw,
    };
  }
  if (node.type === 'fragment') {
    return { type: 'fragment', children: node.children.map(cloneNode) };
  }
  if (node.type === 'text') return { type: 'text', value: node.value };
  return { type: 'comment', value: node.value };
};
