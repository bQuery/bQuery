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
import { loadEntities } from '../src/security/entities';
import { sanitizeHtmlDom, stripTagsDom } from '../src/security/sanitize-dom';
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
  // Attribute name carrying a quote: safe only if the name is validated
  // before serialization, not if the consumer's parser happens to recover.
  '<img src=y data-a"onerror=alert(1) "">',
  '<p data-x"><script>alert(1)</script>">y</p>',
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

  it('drops a disallowed element together with its subtree, as the DOM does', () => {
    // `Element.remove()` in the DOM backend detaches the children too, so
    // unwrapping here would make this backend the less conservative one.
    expect(sanitizeHtmlString('<unknown-tag><b>dropped</b></unknown-tag>')).toBe('');
    expect(sanitizeHtmlString('<div>keep<blink>drop</blink></div>')).toBe('<div>keep</div>');
  });

  it('unwraps document structure instead of discarding the page', () => {
    // `<html>`/`<body>` are absorbed by a real parser rather than nested, so
    // suppressing them would throw away a whole server-rendered response.
    // `<head>` is not structure the body keeps — its content goes.
    expect(
      sanitizeHtmlString('<html><head><title>Secret</title></head><body><h1>Hi</h1></body></html>')
    ).toBe('<h1>Hi</h1>');
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

  it('does not give a rejected attribute a second chance via a duplicate', () => {
    // The HTML parser discards duplicates before any policy runs, so a first
    // occurrence the policy rejects must not let a later one through.
    expect(sanitizeHtmlString('<a id="location" id="safe">x</a>')).toBe('<a>x</a>');
    expect(sanitizeHtmlString('<img src="javascript:alert(1)" src="ok.png">')).toBe('<img>');
  });

  it('never serializes an attribute name it cannot quote safely', () => {
    // `"` is a legal name character for the scanner and a `data-` prefix is
    // enough for the policy, so an unvalidated name could be re-split into a
    // live event handler by a lenient parser.
    const out = sanitizeHtmlString('<img src=y data-a"onerror=alert(1) "">');
    expect(out).not.toContain('onerror');
    expect(out).toBe('<img src="y">');
  });

  it('keeps the two sanitize passes stable for RCDATA content', () => {
    // Raw-text content used to be pushed undecoded but escaped on output, so
    // the mXSS guard could never agree and one `<textarea>` collapsed the
    // whole document to escaped plain text.
    expect(sanitizeHtmlString('<textarea>a &amp; b</textarea>')).toBe(
      '<textarea>a &amp; b</textarea>'
    );
    expect(sanitizeHtmlString('<p>before</p><textarea>x &lt; y</textarea>')).toBe(
      '<p>before</p><textarea>x &lt; y</textarea>'
    );
  });

  it('tokenizes raw-text elements in linear time', () => {
    // The lowercased copy used to be rebuilt per raw-text element, making a
    // megabyte of `<textarea>` take seconds on the `ctx.html()` path.
    const input = '<textarea>x</textarea>'.repeat(5000) + 'a'.repeat(1_000_000);
    const started = performance.now();
    sanitizeHtmlString(input);
    expect(performance.now() - started).toBeLessThan(2000);
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

describe('text extraction is one rule across both backends', () => {
  // The two used to disagree here on *well-formed* input: the DOM backend
  // returned `textContent`, which includes the body of a <script>, while the
  // string backend suppressed the subtree. Under the default 'auto' backend
  // that meant `stripTags()` produced different text on the server and in the
  // browser for the same input.
  const cases = [
    ['<script>alert(1)</script>', ''],
    ['a<script>alert(1)</script>b', 'ab'],
    ['<style>body{}</style>hello', 'hello'],
    ['<iframe>nope</iframe>ok', 'ok'],
    ['<noscript>x</noscript>', ''],
    ['<script>a</script><script>b</script>tail', 'tail'],
    ['<style>x</style><script>y</script>z', 'z'],
    ['<p>hello <b>world</b></p>', 'hello world'],
    ['<div>a<span>b</span>c</div>', 'abc'],
  ] as const;

  for (const [html, expected] of cases) {
    it(`agrees on ${JSON.stringify(html)}`, () => {
      expect(stripTagsDom(html)).toBe(expected);
      expect(stripTagsString(html)).toBe(expected);
    });
  }
});

describe('a trailing slash closes only what HTML lets it close', () => {
  // `<script/>` does not close a script element — HTML drops the slash and
  // everything up to `</script>` is still raw text. Honouring it let the
  // string backend skip raw-text consumption and hand back `alert(1)` as
  // ordinary prose.
  const suppressed = [
    '<script/>alert(1)</script>',
    '<script />alert(1)</script>',
    '<style/>body{}</style>',
    '<iframe/>nope</iframe>',
    '<template/>text',
    '<object/>text',
    '<noscript/>text',
  ] as const;

  for (const html of suppressed) {
    it(`suppresses through ${JSON.stringify(html)}`, () => {
      expect(stripTagsString(html)).toBe('');
      expect(stripTagsDom(html)).toBe('');
    });
  }

  // Void elements self-close by definition, and `svg` switches the tree
  // builder into foreign content where a self-closing start tag is
  // acknowledged. Text after these is genuinely outside the element.
  const closes = ['<link/>text', '<meta/>text', '<embed/>text', '<svg/>text'] as const;

  for (const html of closes) {
    it(`keeps text after ${JSON.stringify(html)}`, () => {
      expect(stripTagsString(html)).toBe('text');
      expect(stripTagsDom(html)).toBe('text');
    });
  }
});

describe('entities decode identically on text-only input', () => {
  // The DOM backend takes a shortcut for input with no angle brackets: it
  // builds a Text node rather than parsing, which keeps text away from
  // `DOMParser`. Building it from the *raw* string left entities as literal
  // characters, so `stripTags` returned them undecoded and `sanitizeHtml`
  // escaped them a second time.
  const cases = [
    ['Tom &amp; Jerry', 'Tom & Jerry', 'Tom &amp; Jerry'],
    ['&lt;b&gt;', '<b>', '&lt;b&gt;'],
    ['a &amp;amp; b', 'a &amp; b', 'a &amp;amp; b'],
    ['plain', 'plain', 'plain'],
  ] as const;

  for (const [html, text, markup] of cases) {
    it(`agrees on ${JSON.stringify(html)}`, () => {
      expect(stripTagsDom(html)).toBe(text);
      expect(stripTagsString(html)).toBe(text);
      expect(sanitizeHtmlDom(html)).toBe(markup);
      expect(sanitizeHtmlString(html)).toBe(markup);
    });
  }
});

describe('character references follow the tokenizer, not a lookup table', () => {
  // The decoder knew six names, lowercased them, and made `;` optional for all
  // of them. So `caf&eacute;` came back literal from the DOM backend's
  // text-only shortcut while `<b>caf&eacute;</b>` decoded through DOMParser,
  // and `&copy=2` in a query string would have become `©=2` the moment the
  // table grew. Each case below is what Chromium produces.
  const text = [
    ['caf&eacute; &mdash; &rsquo;&hellip;', 'café — ’…'],
    ['&Eacute; &eacute;', 'É é'],
    ['&EACUTE;', '&EACUTE;'],
    ['&notit;', '¬it;'],
    ['&notin; &notinva;', '∉ ∉'],
    ['&copyright', '©right'],
    ['&hellip', '&hellip'],
    ['&#150; &#x80;', '– €'],
    ['&#0; &#xD800; &#x110000;', '\ufffd \ufffd \ufffd'],
    ['&#12ab;', '\fab;'],
  ] as const;

  for (const [html, decoded] of text) {
    it(`decodes ${JSON.stringify(html)} as text on both backends and both DOM paths`, () => {
      expect(decodeEntities(html)).toBe(decoded);
      expect(stripTagsString(html)).toBe(decoded);
      expect(stripTagsDom(html)).toBe(decoded);
      expect(stripTagsString(`<b>${html}</b>`)).toBe(decoded);
      expect(stripTagsDom(`<b>${html}</b>`)).toBe(decoded);
    });
  }

  it('keeps a legacy name without `;` literal in an attribute when `=` or a letter follows', () => {
    expect(decodeEntities('?a=1&copy=2', true)).toBe('?a=1&copy=2');
    expect(decodeEntities('&copyright', true)).toBe('&copyright');
    expect(decodeEntities('&notit;', true)).toBe('&notit;');
    expect(decodeEntities('&ltques;', true)).toBe('&ltques;');
    expect(decodeEntities('&copy 2', true)).toBe('© 2');
    expect(decodeEntities('&copy;2', true)).toBe('©2');

    const link = '<a href="?a=1&copy=2">x</a>';
    const kept = '<a href="?a=1&amp;copy=2">x</a>';
    expect(sanitizeHtmlString(link)).toBe(kept);
    expect(sanitizeHtmlDom(link)).toBe(kept);
  });

  it('decodes the references that can rewrite a URL scheme on both backends', () => {
    for (const href of ['javascript&colon;alert(1)', 'java&Tab;script&colon;alert(1)']) {
      const html = `<a href="${href}">x</a>`;
      expect(sanitizeHtmlString(html)).toBe('<a>x</a>');
      expect(sanitizeHtmlDom(html)).toBe('<a>x</a>');
    }
  });

  it('carries every legacy name, none longer than the prefix search looks', () => {
    // The decoder bounds its longest-prefix search at six characters; a
    // longer legacy name would silently never match without its `;`.
    const { named, legacy } = loadEntities();
    expect(legacy.size).toBe(106);
    expect(Math.max(...[...legacy].map((name) => name.length))).toBe(6);
    for (const name of legacy) expect(named.has(name)).toBe(true);
    expect(named.get('fjlig')).toBe('fj');
  });

  it('leaves a name outside the table literal, and escaped, rather than guessing', () => {
    // `&star;` is HTML5-only. A browser shows ☆; the string backend and the DOM
    // backend's text-only path show the reference itself. See entities.ts.
    expect(sanitizeHtmlString('&star;')).toBe('&amp;star;');
    expect(sanitizeHtmlDom('&star;')).toBe('&amp;star;');
  });
});

describe('stripAllTags output is safe for an HTML sink', () => {
  // `stripTags()` is documented to return plain text and returns it raw.
  // `sanitizeHtml(..., { stripAllTags: true })` is branded SanitizedHtml and
  // goes to innerHTML, so it must escape — the parser has already decoded the
  // entities by then, so the "text" can carry live markup.
  const encoded = '<p>&lt;img src=x onerror=alert(1)&gt;</p>';

  it('escapes on the DOM backend', () => {
    const out = sanitizeHtmlDom(encoded, { stripAllTags: true });
    expect(out).not.toContain('<img');
    expect(out).toBe('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('escapes on the string backend', () => {
    const out = sanitizeHtmlString(encoded, { stripAllTags: true });
    expect(out).not.toContain('<img');
    expect(out).toBe('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('leaves stripTags() as raw plain text', () => {
    // Not escaped, deliberately: the return value is text, not markup.
    expect(stripTagsDom(encoded)).toBe('<img src=x onerror=alert(1)>');
    expect(stripTagsString(encoded)).toBe('<img src=x onerror=alert(1)>');
  });
});

describe('decodeEntities', () => {
  it('decodes named, decimal and hex entities', () => {
    expect(decodeEntities('&amp;&lt;&gt;&quot;&apos;')).toBe('&<>"\'');
    expect(decodeEntities('&#65;&#x42;')).toBe('AB');
  });

  it('leaves unknown and malformed entities untouched', () => {
    expect(decodeEntities('&unknownname;')).toBe('&unknownname;');
    expect(decodeEntities('&#xZZ;')).toBe('&#xZZ;');
    // Not untouched, although it looks unknown: `&not` is a legacy name and
    // matches as a prefix, exactly as a browser reads it.
    expect(decodeEntities('&notanentity;')).toBe('¬anentity;');
  });

  it('returns the input unchanged when there is no entity', () => {
    expect(decodeEntities('plain text')).toBe('plain text');
  });

  it('replaces an out-of-range code point with U+FFFD, as a browser does', () => {
    expect(decodeEntities('&#x110000;')).toBe('\ufffd');
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
      // Disallowed tags with children: the corpus had none, which is how the
      // backends came to disagree on ordinary input.
      '<unknown-tag><b>hi</b></unknown-tag>',
      '<foo>bar</foo>',
      '<div>keep<blink>drop</blink></div>',
      // RCDATA, and a full page: both reach this backend via `ctx.html()`.
      '<textarea>a &amp; b</textarea>',
      '<form><textarea name="c">a &lt; b</textarea></form>',
      '<html><head><title>My &amp; Page</title></head><body><h1>Hi</h1></body></html>',
      // Duplicate attributes where the first occurrence is rejected.
      '<a id="location" id="safe">x</a>',
      '<img src="javascript:alert(1)" src="ok.png">',
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
