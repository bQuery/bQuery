/**
 * Adversarial corpus, differential and property-based sanitizer tests (#230).
 *
 * Three code paths sanitize HTML: the DOM backend and the DOM-free string
 * backend behind `sanitizeHtml()`, and `sanitizeHtmlForSSR()` in the SSR
 * renderer. Every corpus payload goes through all three, and the output is
 * judged by an independent model of how a browser parses it
 * (`tests/helpers/html-safety.ts`) rather than by any of the sanitizers' own
 * parsers.
 */

import { describe, expect, it } from 'bun:test';
import { sanitizeHtmlDom } from '../src/security/sanitize-dom';
import { sanitizeHtmlString } from '../src/security/sanitize-string';
import { sanitizeHtmlForSSR } from '../src/ssr/renderer';
import corpus from './fixtures/xss-corpus.json';
import { findExecutableMarkup } from './helpers/html-safety';
import { createRandom, generateSoup } from './helpers/html-soup';

type Sanitizer = (html: string) => string;

const SANITIZERS: ReadonlyArray<readonly [string, Sanitizer]> = [
  ['DOM backend', (html) => String(sanitizeHtmlDom(html))],
  ['string backend', (html) => String(sanitizeHtmlString(html))],
  ['SSR renderer', (html) => sanitizeHtmlForSSR(html)],
];

const PAYLOADS = Object.entries(corpus.categories).flatMap(([category, payloads]) =>
  payloads.map((payload) => [category, payload] as const)
);

describe('safety oracle', () => {
  it('flags executable markup, including through abrupt comment endings and RCDATA', () => {
    expect(findExecutableMarkup('<p>safe</p>')).toEqual([]);
    expect(findExecutableMarkup('<img src=x onerror=alert(1)>')).toEqual(['<img onerror>']);
    expect(findExecutableMarkup('<a href=" java\tscript:alert(1)">x</a>')).toHaveLength(1);
    expect(findExecutableMarkup('<a href="javas&#99;ript:x">x</a>')).toHaveLength(1);
    expect(findExecutableMarkup('<img srcset="ok.png 1x, javascript:x 2x">')).toHaveLength(1);
    expect(findExecutableMarkup('<!--><script>x</script>-->')).toEqual(['<script>']);
    expect(findExecutableMarkup('<!-- --!><script>x</script>')).toEqual(['<script>']);
    expect(findExecutableMarkup('<textarea></textarea><script>x</script>')).toEqual(['<script>']);
  });

  it('does not flag markup that is only text to a browser', () => {
    expect(findExecutableMarkup('<!-- <script>x</script> -->')).toEqual([]);
    expect(findExecutableMarkup('<textarea><script>x</script></textarea>')).toEqual([]);
    expect(findExecutableMarkup('&lt;img src=x onerror=alert(1)&gt;')).toEqual([]);
    expect(findExecutableMarkup('<a href="data:image/png;base64,AAAA">x</a>')).toEqual([]);
  });
});

describe('adversarial corpus (#230)', () => {
  it('covers every attack category named in the issue', () => {
    expect(Object.keys(corpus.categories)).toEqual(
      expect.arrayContaining([
        'mxss-namespace-confusion',
        'dom-clobbering',
        'protocol-obfuscation',
        'srcset-formaction-xlink',
      ])
    );
    expect(PAYLOADS.length).toBeGreaterThanOrEqual(100);
  });

  for (const [name, sanitize] of SANITIZERS) {
    describe(name, () => {
      it.each(PAYLOADS)('[%s] neutralises %p', (_category, payload) => {
        // The oracle covers `<script>`/`<iframe>` elements, `on*` attributes and
        // script URLs. A plain text search would also hit escaped text and
        // attribute values, which no browser executes.
        expect(findExecutableMarkup(sanitize(payload))).toEqual([]);
      });

      it.each(PAYLOADS)('[%s] is idempotent for %p', (_category, payload) => {
        const once = sanitize(payload);
        expect(sanitize(once)).toBe(once);
      });
    });
  }
});

describe('differential: all sanitizer paths agree on well-formed markup (#230)', () => {
  it.each(corpus.wellFormed)('%p', (payload) => {
    const [dom, string, ssr] = SANITIZERS.map(([, sanitize]) => sanitize(payload));
    expect(string).toBe(dom);
    expect(ssr).toBe(dom);
    expect(findExecutableMarkup(dom)).toEqual([]);
  });
});

/**
 * Two representation differences make a second pass change bytes without
 * changing what a browser sees, so the idempotency check compares modulo
 * exactly these: outer whitespace (the input is trimmed, but an output can
 * start with text that followed a dropped element), and the quote/backtick
 * escapes of the escaped-text fallback, which a second pass reads back as text
 * and re-serializes with the standard text escaping (`&`, `<`, `>` only).
 */
const canonical = (html: string): string =>
  html
    .trim()
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x60;/g, '`');

describe('property-based: random tag and attribute soup (#230)', () => {
  // The two `sanitizeHtml()` backends. Fixed seeds keep runs reproducible; bump
  // CASES locally (or add seeds) to search harder.
  const SEEDS = [0x5eed, 0xb0e, 0x230];
  const CASES = 150;

  for (const [name, sanitize] of SANITIZERS.slice(0, 2)) {
    for (const seed of SEEDS) {
      it(`${name}: output is never executable and a second pass is stable (seed ${seed})`, () => {
        const random = createRandom(seed);
        for (let i = 0; i < CASES; i++) {
          const input = generateSoup(random);
          const once = sanitize(input);
          const unsafe = findExecutableMarkup(once);
          if (unsafe.length > 0) {
            throw new Error(`unsafe output for ${JSON.stringify(input)}: ${unsafe.join(', ')}`);
          }
          expect(canonical(sanitize(once))).toBe(canonical(once));
        }
      }, 20_000);
    }
  }
});
