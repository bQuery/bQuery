/**
 * Seeded generator of random tag-and-attribute soup for property-based
 * sanitizer tests (#230). Deterministic per seed, so a failure reproduces from
 * the seed printed in the test name; no dependency on a property-testing
 * library.
 */

/** mulberry32: a small, fast, seedable PRNG. */
export const createRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const TAGS = [
  'a',
  'b',
  'div',
  'p',
  'span',
  'img',
  'svg',
  'math',
  'mtext',
  'mglyph',
  'table',
  'td',
  'tr',
  'form',
  'input',
  'button',
  'select',
  'option',
  'template',
  'textarea',
  'title',
  'noscript',
  'style',
  'script',
  'iframe',
  'object',
  'embed',
  'base',
  'meta',
  'details',
  'video',
  'source',
  'picture',
  'foreignObject',
  'desc',
  'xmp',
  'noembed',
];

const ATTRIBUTE_NAMES = [
  'href',
  'src',
  'srcset',
  'action',
  'formaction',
  'xlink:href',
  'poster',
  'id',
  'name',
  'class',
  'title',
  'alt',
  'style',
  'onerror',
  'onload',
  'onclick',
  'ONMOUSEOVER',
  'data-x',
  'target',
  'rel',
];

const ATTRIBUTE_VALUES = [
  'javascript:alert(1)',
  'JaVaScRiPt:alert(1)',
  ' java\tscript:alert(1)',
  'javas&#99;ript:alert(1)',
  '&#x6a;avascript:alert(1)',
  'vbscript:msgbox(1)',
  'data:text/html,<script>alert(1)</script>',
  'https://example.com',
  '/local',
  'x',
  'alert(1)',
  '"><img src=x onerror=alert(1)>',
  "'><svg onload=alert(1)>",
  'location',
  '__proto__',
  'ok.png 1x, javascript:alert(1) 2x',
  '',
];

const TEXT = ['text', ' ', '&amp;', '&lt;script&gt;', '"', "'", '>', '<', '`', 'alert(1)'];

const pick = <T>(random: () => number, items: readonly T[]): T =>
  items[Math.floor(random() * items.length)] as T;

const quote = (random: () => number, value: string): string => {
  const roll = random();
  if (roll < 0.45) return `"${value}"`;
  if (roll < 0.8) return `'${value}'`;
  return value.replace(/\s/g, '');
};

const attributes = (random: () => number): string => {
  let out = '';
  const count = Math.floor(random() * 4);
  for (let i = 0; i < count; i++) {
    const separator = pick(random, [' ', ' ', '\n', '/', '\t']);
    out += `${separator}${pick(random, ATTRIBUTE_NAMES)}=${quote(random, pick(random, ATTRIBUTE_VALUES))}`;
  }
  return out;
};

/** Generate one random fragment of HTML-ish soup, nested up to `depth`. */
export const generateSoup = (random: () => number, depth = 3): string => {
  let out = '';
  const parts = 1 + Math.floor(random() * 4);
  for (let i = 0; i < parts; i++) {
    const roll = random();
    if (roll < 0.25 || depth === 0) {
      out += pick(random, TEXT);
    } else if (roll < 0.85) {
      const tag = pick(random, TAGS);
      const close = random() < 0.85 ? `</${tag}>` : '';
      out += `<${tag}${attributes(random)}>${generateSoup(random, depth - 1)}${close}`;
    } else if (roll < 0.92) {
      out += `</${pick(random, TAGS)}>`;
    } else {
      out += pick(random, ['<', '<!', '</', '<?x?>', '<![CDATA[x]]>']);
    }
  }
  return out;
};
