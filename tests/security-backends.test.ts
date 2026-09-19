/**
 * Sanitizer backend selection and DOM-free sanitization (#229).
 *
 * `sanitizeHtml()` threw `ReferenceError: document is not defined` on every
 * runtime without a DOM. It now picks a string backend there. Because that
 * backend is a second implementation of a security-critical function, most of
 * this file is differential: the same adversarial corpus goes through both
 * backends, and both have to come out safe.
 */

import { afterEach, describe, expect, it } from 'bun:test';
import {
  configureSanitizer,
  getSanitizerConfig,
  sanitizeHtml,
  stripTags,
} from '../src/security/index';
import { hasDomSupport, resolveSanitizerBackend } from '../src/security/config';
import { sanitizeHtmlDom } from '../src/security/sanitize-dom';
import {
  decodeEntities,
  sanitizeHtmlString,
  stripTagsString,
} from '../src/security/sanitize-string';

afterEach(() => {
  configureSanitizer({ backend: 'auto' });
});

/**
 * Markup that must never survive sanitization in an executable form. Both
 * backends run every one of these.
 */
const ADVERSARIAL = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<svg/onload=alert(1)>',
  '<a href="javascript:alert(1)">x</a>',
  '<a href="java\tscript:alert(1)">x</a>',
  '<a href="javas&#99;ript:alert(1)">x</a>',
  '<a href="JaVaScRiPt:alert(1)">x</a>',
  '<a href=" javascript:alert(1)">x</a>',
  '<a href="&#x6a;avascript:alert(1)">x</a>',
  '<div><scr<script>ipt>alert(1)</script></div>',
  '<iframe src="javascript:alert(1)"></iframe>',
  '<object data="x"></object>',
  '<embed src="x">',
  '<style>*{background:url(javascript:alert(1))}</style>',
  '<form action="javascript:alert(1)"><input></form>',
  '<img src="x" srcset="javascript:alert(1) 1x">',
  '<!--<script>alert(1)</script>-->',
  '<textarea></textarea><script>alert(1)</script>',
  '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
  '<math><mtext><table><mglyph><style><!--</style><img src=x onerror=alert(1)>',
  '<div attr="><script>alert(1)</script>">x</div>',
  '<base href="javascript:alert(1)//">',
  '</div><script>alert(1)</script>',
  '<body onload=alert(1)>x</body>',
  '<input onfocus=alert(1) autofocus>',
  '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>',
  '<a href="vbscript:msgbox(1)">x</a>',
];

/** Anything that would mean the sanitizer let something executable through. */
const EXECUTABLE =
  /<script|<iframe|<object|<embed|<style|\son[a-z]+\s*=|javascript:|vbscript:|data:text\/html/i;

describe('sanitizer backend selection', () => {
  it('defaults to auto', () => {
    expect(getSanitizerConfig().backend).toBe('auto');
  });

  it('resolves auto to the DOM backend when the runtime has a DOM', () => {
    // The suite preloads happy-dom, so a DOM is present here.
    expect(hasDomSupport()).toBe(true);
    expect(resolveSanitizerBackend()).toBe('dom');
  });

  it('honours an explicit backend over what the runtime offers', () => {
    configureSanitizer({ backend: 'string' });
    expect(resolveSanitizerBackend()).toBe('string');
    configureSanitizer({ backend: 'dom' });
    expect(resolveSanitizerBackend()).toBe('dom');
  });

  it('reports the configured backend', () => {
    configureSanitizer({ backend: 'string' });
    expect(getSanitizerConfig().backend).toBe('string');
  });

  it('ignores an options object that sets nothing', () => {
    configureSanitizer({ backend: 'string' });
    configureSanitizer({});
    expect(getSanitizerConfig().backend).toBe('string');
  });

  it('routes sanitizeHtml and stripTags through the configured backend', () => {
    configureSanitizer({ backend: 'string' });
    // `sanitizeHtml` returns the branded `SanitizedHtml`, so compare as a
    // plain string — the same way tests/security.test.ts does.
    expect(String(sanitizeHtml('<b>hi</b>'))).toBe('<b>hi</b>');
    expect(stripTags('<div>a<script>evil()</script>b</div>')).toBe('ab');
  });
});

describe('DOM-free sanitizer', () => {
  it('sanitizes the case from the issue without a DOM', () => {
    // `sanitizeHtml('<b>hi</b>')` used to throw ReferenceError here.
    expect(sanitizeHtmlString('<b>hi</b>')).toBe('<b>hi</b>');
  });

  it('keeps allowed markup and attributes', () => {
    expect(sanitizeHtmlString('<div class="a"><p>Hello</p></div>')).toBe(
      '<div class="a"><p>Hello</p></div>'
    );
  });

  it('drops disallowed elements but keeps their children', () => {
    expect(sanitizeHtmlString('<unknown-tag><b>kept</b></unknown-tag>')).toBe('<b>kept</b>');
  });

  it('drops a dangerous element together with its subtree', () => {
    expect(sanitizeHtmlString('<div><script>alert(1)</script>after</div>')).toBe(
      '<div>after</div>'
    );
  });

  it('escapes text rather than emitting markup', () => {
    expect(sanitizeHtmlString('a & b < c > d')).toBe('a &amp; b &lt; c &gt; d');
  });

  it('closes elements the input left open', () => {
    expect(sanitizeHtmlString('<div><p>a')).toBe('<div><p>a</p></div>');
  });

  it('drops a close tag with no matching open tag', () => {
    expect(sanitizeHtmlString('</div>text')).toBe('text');
  });

  it('repairs mis-nested elements', () => {
    expect(sanitizeHtmlString('<b><i>x</b></i>')).toBe('<b><i>x</i></b>');
  });

  it('treats implied end tags as siblings', () => {
    expect(sanitizeHtmlString('<ul><li>a<li>b</ul>')).toBe('<ul><li>a</li><li>b</li></ul>');
  });

  it('does not emit a closing tag for void elements', () => {
    expect(sanitizeHtmlString('<p>a<br>b</p>')).toBe('<p>a<br>b</p>');
  });

  it('strips comments entirely', () => {
    expect(sanitizeHtmlString('<p>a</p><!-- c --><p>b</p>')).toBe('<p>a</p><p>b</p>');
  });

  it('adds rel="noopener noreferrer" to external and target=_blank links', () => {
    expect(sanitizeHtmlString('<a href="https://example.com">x</a>')).toContain(
      'rel="noopener noreferrer"'
    );
    expect(sanitizeHtmlString('<a href="/local" target="_blank">x</a>')).toContain(
      'rel="noopener noreferrer"'
    );
  });

  it('leaves a same-document link without rel', () => {
    expect(sanitizeHtmlString('<a href="/local">x</a>')).toBe('<a href="/local">x</a>');
  });

  it('drops duplicate ids so named access cannot be clobbered', () => {
    expect(sanitizeHtmlString('<a id="x">1</a><a id="x">2</a>')).toBe('<a id="x">1</a><a>2</a>');
  });

  it('keeps the first of a repeated attribute', () => {
    expect(sanitizeHtmlString('<p class="a" class="b">x</p>')).toBe('<p class="a">x</p>');
  });

  it('reads unquoted and single-quoted attribute values', () => {
    expect(sanitizeHtmlString("<p class=a title='b'>x</p>")).toBe('<p class="a" title="b">x</p>');
  });

  it('escapes quotes in attribute values', () => {
    expect(sanitizeHtmlString('<p title="a&quot;b">x</p>')).toBe('<p title="a&quot;b">x</p>');
  });

  it('honours allowTags and allowAttributes', () => {
    expect(sanitizeHtmlString('<section data-x="1">x</section>', { allowTags: ['section'] })).toBe(
      '<section data-x="1">x</section>'
    );
  });

  it('refuses to allow a dangerous tag even when asked', () => {
    expect(sanitizeHtmlString('<script>alert(1)</script>', { allowTags: ['script'] })).toBe('');
  });

  it('drops data attributes when allowDataAttributes is false', () => {
    expect(sanitizeHtmlString('<p data-x="1">y</p>', { allowDataAttributes: false })).toBe(
      '<p>y</p>'
    );
  });

  it('strips all tags on request, without leaking script source', () => {
    expect(stripTagsString('<div>a<script>evil()</script>b</div>')).toBe('ab');
  });
});

describe('decodeEntities', () => {
  it('decodes named, decimal and hex entities', () => {
    expect(decodeEntities('&amp;&lt;&gt;&quot;&apos;')).toBe('&<>"\'');
    expect(decodeEntities('&#65;&#x42;')).toBe('AB');
  });

  it('leaves unknown and malformed entities untouched', () => {
    expect(decodeEntities('&notanentity;')).toBe('&notanentity;');
    expect(decodeEntities('&#xZZ;')).toBe('&#xZZ;');
  });

  it('returns the input unchanged when there is no entity', () => {
    expect(decodeEntities('plain text')).toBe('plain text');
  });

  it('rejects an out-of-range code point', () => {
    expect(decodeEntities('&#x110000;')).toBe('&#x110000;');
  });
});

describe('both backends against the adversarial corpus', () => {
  it.each(ADVERSARIAL)('neutralizes %j in the string backend', (input) => {
    expect(sanitizeHtmlString(input)).not.toMatch(EXECUTABLE);
  });

  it.each(ADVERSARIAL)('neutralizes %j in the DOM backend', (input) => {
    expect(sanitizeHtmlDom(input)).not.toMatch(EXECUTABLE);
  });

  it('agrees with the DOM backend on well-formed markup', () => {
    const wellFormed = [
      '<b>bold</b> and <i>italic</i>',
      '<div class="a"><p>Hello</p></div>',
      '<ul><li>a</li><li>b</li></ul>',
      '<p>a<br>b</p>',
      '<a href="/local">x</a>',
      'plain text',
    ];

    for (const input of wellFormed) {
      expect(sanitizeHtmlString(input), input).toBe(sanitizeHtmlDom(input));
    }
  });

  it('strips tags identically for well-formed markup', () => {
    for (const input of ['<p>a</p><p>b</p>', '<div>x<span>y</span></div>', 'plain']) {
      expect(stripTagsString(input), input).toBe(sanitizeHtmlDom(input, { stripAllTags: true }));
    }
  });
});
