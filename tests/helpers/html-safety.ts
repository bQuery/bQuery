/**
 * Independent safety oracle for sanitizer output (#230).
 *
 * Answers "would a browser that parses this string run script?" without
 * trusting either sanitizer backend's own parser — or the test DOM's:
 * happy-dom parses `<textarea>` and `<title>` content as elements, which is
 * exactly the class of difference mutation XSS lives in.
 *
 * The model is a small tokenizer that follows the WHATWG rules most often
 * abused for mutation XSS: abrupt comment endings (`<!-->`, `<!--->`, `--!>`),
 * raw-text and RCDATA elements (`<textarea>`, `<title>`, `<style>`,
 * `<noscript>`, …) whose content ends at the first matching close tag, and
 * `<plaintext>`. It deliberately over-approximates: it ignores foreign-content
 * (SVG/MathML) rules, so markup it flags may be inert in a real browser, but
 * markup a browser would run is flagged.
 */

import { decodeEntities } from '../../src/security/sanitize-string';

/** Elements that run script, load documents or change how the page resolves URLs. */
const EXECUTABLE_TAGS = new Set([
  'applet',
  'base',
  'embed',
  'frame',
  'frameset',
  'iframe',
  'link',
  'meta',
  'object',
  'portal',
  'script',
  'style',
]);

/** Attributes whose value is fetched or navigated to. */
const URL_ATTRIBUTES = new Set([
  'action',
  'background',
  'cite',
  'codebase',
  'data',
  'dynsrc',
  'formaction',
  'href',
  'lowsrc',
  'ping',
  'poster',
  'src',
  'srcdoc',
  'srcset',
  'xlink:href',
]);

/** Elements whose content is text up to the matching close tag. */
const TEXT_ONLY_ELEMENTS = new Set([
  'iframe',
  'noembed',
  'noframes',
  'noscript',
  'script',
  'style',
  'textarea',
  'title',
  'xmp',
]);

const SCRIPT_URL = /^(?:javascript|vbscript|data):/;
const SAFE_DATA_URL = /^data:image\/(?:png|gif|jpe?g|webp|avif);/;

interface StartTag {
  tag: string;
  attributes: Array<{ name: string; value: string }>;
}

const isSpace = (char: string | undefined): boolean =>
  char === ' ' || char === '\t' || char === '\n' || char === '\r' || char === '\f';

const readStartTag = (html: string, start: number): { tag: StartTag; end: number } | null => {
  const nameMatch = /^[a-zA-Z][^\s/>]*/.exec(html.slice(start + 1));
  if (!nameMatch) return null;
  const tag: StartTag = { tag: nameMatch[0].toLowerCase(), attributes: [] };
  let pos = start + 1 + nameMatch[0].length;
  while (pos < html.length) {
    while (isSpace(html[pos]) || html[pos] === '/') pos++;
    if (pos >= html.length) return { tag, end: pos };
    if (html[pos] === '>') return { tag, end: pos + 1 };
    let nameEnd = pos + 1;
    while (nameEnd < html.length && !isSpace(html[nameEnd]) && !'/>='.includes(html[nameEnd])) {
      nameEnd++;
    }
    const name = html.slice(pos, nameEnd).toLowerCase();
    pos = nameEnd;
    while (isSpace(html[pos])) pos++;
    let value = '';
    if (html[pos] === '=') {
      pos++;
      while (isSpace(html[pos])) pos++;
      const quote = html[pos];
      if (quote === '"' || quote === "'") {
        const close = html.indexOf(quote, pos + 1);
        value = html.slice(pos + 1, close === -1 ? html.length : close);
        pos = close === -1 ? html.length : close + 1;
      } else {
        const valueStart = pos;
        while (pos < html.length && !isSpace(html[pos]) && html[pos] !== '>') pos++;
        value = html.slice(valueStart, pos);
      }
    }
    tag.attributes.push({ name, value: decodeEntities(value, true) });
  }
  return { tag, end: pos };
};

/** Start tags a spec-compliant parser would create from `html`. */
const specStartTags = (html: string): StartTag[] => {
  const tags: StartTag[] = [];
  const lower = html.toLowerCase();
  let pos = 0;
  while (pos < html.length) {
    const lt = html.indexOf('<', pos);
    if (lt === -1) break;
    if (html.startsWith('<!--', lt)) {
      // `<!-->` and `<!--->` close immediately; `--!>` closes like `-->`.
      if (html.startsWith('<!-->', lt)) {
        pos = lt + 5;
        continue;
      }
      if (html.startsWith('<!--->', lt)) {
        pos = lt + 6;
        continue;
      }
      const closeA = html.indexOf('-->', lt + 4);
      const closeB = html.indexOf('--!>', lt + 4);
      const candidates = [
        closeA === -1 ? Infinity : closeA + 3,
        closeB === -1 ? Infinity : closeB + 4,
      ];
      const end = Math.min(...candidates);
      pos = end === Infinity ? html.length : end;
      continue;
    }
    if (html[lt + 1] === '!' || html[lt + 1] === '?' || html[lt + 1] === '/') {
      const end = html.indexOf('>', lt + 1);
      pos = end === -1 ? html.length : end + 1;
      continue;
    }
    const read = readStartTag(html, lt);
    if (!read) {
      pos = lt + 1;
      continue;
    }
    tags.push(read.tag);
    pos = read.end;
    if (read.tag.tag === 'plaintext') break;
    if (TEXT_ONLY_ELEMENTS.has(read.tag.tag)) {
      const close = lower.indexOf(`</${read.tag.tag}`, pos);
      pos = close === -1 ? html.length : close;
    }
  }
  return tags;
};

const isScriptUrl = (value: string): boolean => {
  // Browsers strip ASCII whitespace and C0 controls before reading the scheme.
  const normalized = value.replace(/[\u0000- \u007f]/g, '').toLowerCase();
  return SCRIPT_URL.test(normalized) && !SAFE_DATA_URL.test(normalized);
};

const srcsetUrls = (value: string): string[] =>
  value.split(',').map((candidate) => candidate.trim().split(/\s+/)[0] ?? '');

/**
 * Everything in `html` that a browser could execute. An empty array means no
 * executable element, event handler or script URL was found.
 */
export const findExecutableMarkup = (html: string): string[] => {
  const found: string[] = [];
  for (const { tag, attributes } of specStartTags(html)) {
    if (EXECUTABLE_TAGS.has(tag)) found.push(`<${tag}>`);
    for (const { name, value } of attributes) {
      if (name.startsWith('on')) found.push(`<${tag} ${name}>`);
      if (!URL_ATTRIBUTES.has(name)) continue;
      // `srcset` is only fetched on <img> and <source>.
      if (name === 'srcset' && tag !== 'img' && tag !== 'source') continue;
      const urls = name === 'srcset' ? srcsetUrls(value) : [value];
      if (urls.some(isScriptUrl)) found.push(`<${tag} ${name}="${value}">`);
    }
  }
  return found;
};
