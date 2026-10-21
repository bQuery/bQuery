/**
 * Full-document SSR templates: the doctype and the `<html>`/`<head>`/`<body>`
 * wrappers survive rendering, and the output is the same whether or not a
 * global DOM (happy-dom here) is installed.
 */
import { afterEach, describe, expect, it } from 'bun:test';
import { splitDocumentPrologue } from '../src/ssr/html-parser';
import {
  configureSSR,
  createSSRContext,
  defer,
  flushBoundary,
  renderToResponse,
  renderToStream,
  renderToStreamSuspense,
  renderToString,
  renderToStringAsync,
} from '../src/ssr/index';
import type { BindingContext } from '../src/view/types';

afterEach(() => {
  configureSSR({ backend: 'auto', documentImpl: null });
});

const PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title bq-text="title"></title>
  </head>
  <body>
    <h1 bq-text="title"></h1>
    <ul><li bq-for="item in items" bq-text="item"></li></ul>
  </body>
</html>`;

const DATA = { title: 'Home', items: ['a', 'b'] };

const readStream = async (stream: ReadableStream<Uint8Array>): Promise<string> =>
  new Response(stream).text();

/** Runs `run` with the global `DOMParser` removed, i.e. without any DOM at all. */
const withoutDom = async <T>(run: () => T | Promise<T>): Promise<T> => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'DOMParser');
  Reflect.deleteProperty(globalThis, 'DOMParser');
  try {
    expect(typeof globalThis.DOMParser).toBe('undefined');
    return await run();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'DOMParser', descriptor);
  }
};

/** Renders with the global `DOMParser` removed, i.e. without any DOM at all. */
const renderWithoutDom = (template: string, data: BindingContext): string => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'DOMParser');
  Reflect.deleteProperty(globalThis, 'DOMParser');
  try {
    expect(typeof globalThis.DOMParser).toBe('undefined');
    return renderToString(template, data).html;
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'DOMParser', descriptor);
  }
};

const readChunks = async (stream: ReadableStream<Uint8Array>): Promise<string[]> => {
  const chunks: string[] = [];
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return chunks;
    chunks.push(decoder.decode(value));
  }
};

const count = (haystack: string, needle: string): number => haystack.split(needle).length - 1;

/** Renders `template` on every backend configuration and returns each output. */
const renderOnEveryBackend = (template: string, data: BindingContext = DATA) => {
  const withGlobalDom = renderToString(template, data).html;
  const withoutDom = renderWithoutDom(template, data);
  configureSSR({ backend: 'pure' });
  const pure = renderToString(template, data).html;
  configureSSR({ backend: 'dom', documentImpl: { DOMParser: globalThis.DOMParser } });
  const dom = renderToString(template, data).html;
  configureSSR({ backend: 'auto', documentImpl: null });
  return { withGlobalDom, withoutDom, pure, dom };
};

describe('SSR full documents', () => {
  it('keeps the doctype and the html/head/body wrappers with a global DOM installed', () => {
    expect(typeof globalThis.DOMParser).toBe('function');
    const { html } = renderToString(PAGE, DATA);
    expect(html).toStartWith('<!doctype html>\n<html lang="en">');
    expect(html).toContain('<head>');
    expect(html).toContain('<title bq-text="title">Home</title>');
    expect(html).toContain('</head>');
    expect(html).toContain('<body>');
    expect(html).toContain('<li bq-text="item">a</li><li bq-text="item">b</li>');
    expect(html).toEndWith('</body>\n</html>');
  });

  it('renders the same document whether or not a DOM is available', () => {
    const outputs = renderOnEveryBackend(PAGE);
    expect(outputs.withoutDom).toStartWith('<!doctype html>\n<html lang="en">');
    expect(outputs.withGlobalDom).toBe(outputs.withoutDom);
    expect(outputs.pure).toBe(outputs.withoutDom);
    expect(outputs.dom).toBe(outputs.withoutDom);
  });

  it('keeps wrappers of documents without a doctype on every backend', () => {
    for (const template of [
      '<html><head><title>T</title></head><body><p bq-text="title"></p></body></html>',
      '<head><title>T</title></head><body><p bq-text="title"></p></body>',
      '<HTML><BODY class="page"><p bq-text="title"></p></BODY></HTML>',
      '<body class="page"><p bq-text="title"></p></body>',
    ]) {
      const outputs = new Set(Object.values(renderOnEveryBackend(template)));
      expect(outputs.size).toBe(1);
      const [html] = outputs;
      expect(html).toContain('<p bq-text="title">Home</p>');
      expect(html).toMatch(/<body[ >]/);
      expect(html).toContain('</body>');
    }
  });

  it('still renders fragments through the configured DOM backend', () => {
    // The DOM backend drops comments; the DOM-free one keeps them.
    expect(renderToString('<!-- c --><p>x</p>', {}).html).toBe('<p>x</p>');
    configureSSR({ backend: 'pure' });
    expect(renderToString('<!-- c --><p>x</p>', {}).html).toBe('<!-- c --><p>x</p>');
  });

  it('keeps the doctype in renderToStringAsync, renderToResponse and the streams', async () => {
    const ctx = createSSRContext();
    ctx.head.add({ meta: [{ name: 'injected', content: 'yes' }] });
    const asyncResult = await renderToStringAsync(PAGE, DATA, { context: ctx });
    expect(asyncResult.html).toStartWith('<!doctype html>');
    expect(asyncResult.html).toContain('<meta name="injected" content="yes"></head>');

    const response = await renderToResponse(PAGE, DATA);
    expect(await response.text()).toStartWith('<!doctype html>\n<html lang="en">');

    expect(await readStream(renderToStream(PAGE, DATA))).toStartWith('<!doctype html>');

    const suspense = await readStream(
      renderToStreamSuspense(PAGE.replace('<h1 bq-text', '<h1 bq-defer="title" bq-text'), {
        ...DATA,
        title: defer(Promise.resolve('Late'), 'Loading'),
      })
    );
    expect(suspense).toStartWith('<!doctype html>\n<html lang="en">');
    expect(suspense).toContain('Late');
  });

  it('keeps the case of the doctype keyword and normalises the name', () => {
    expect(renderToString('<!DOCTYPE HTML><p>x</p>', {}).html).toBe('<!DOCTYPE html><p>x</p>');
    expect(renderToString('  <!doctype html>\n<p>x</p>', {}).html).toBe(
      '<!doctype html>\n<p>x</p>'
    );
  });

  it('rebuilds legacy html doctypes as <!doctype html> and drops other doctypes', () => {
    for (const template of [
      '<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd"><p></p>',
      '<!DOCTYPE HTML SYSTEM "about:legacy-compat"><p></p>',
    ]) {
      expect(new Set(Object.values(renderOnEveryBackend(template, {})))).toEqual(
        new Set(['<!DOCTYPE html><p></p>'])
      );
    }
    expect(renderToString('<!doctype svg><p></p>', {}).html).toBe('<p></p>');
    expect(renderToString('<!doctype\n  html  ><p></p>', {}).html).toBe('<!doctype html><p></p>');
  });
});

describe('SSR doctype safety', () => {
  const renderBoth = (template: string): string[] => {
    const outputs = renderOnEveryBackend(template, {});
    return [...new Set(Object.values(outputs))];
  };

  it('does not let a doctype carry markup into the output', () => {
    for (const template of [
      '<!doctype html><script>alert(1)</script><p>x</p>',
      '<!doctype x "><img src=x onerror=alert(1)>',
      '<!doctype html PUBLIC "-//x//<b onclick=alert(1)>" "y"><p>x</p>',
      `<!doctype html SYSTEM "x' onload='alert(1)"><p>x</p>`,
      '<!doctype "><svg onload=alert(1)>',
      '<!doctype html><!doctype html><img src=x onerror=alert(1)>',
    ]) {
      const outputs = renderBoth(template);
      expect(outputs).toHaveLength(1);
      const [html] = outputs;
      expect(html).not.toContain('<script');
      expect(html).not.toMatch(/\son\w+=/i);
      expect(html).not.toContain('<b');
      expect(html.match(/<!doctype/gi)?.length ?? 0).toBeLessThanOrEqual(1);
    }
  });

  it('drops a malformed doctype whole instead of re-emitting part of it', () => {
    expect(renderBoth('<!doctype x "><img src=x onerror=alert(1)>')).toEqual(['<img src="x">']);
    // A legacy doctype ends at its first `>`, as in the HTML tokenizer, and
    // only the rebuilt `<!doctype html>` is emitted for it.
    expect(renderBoth('<!doctype html PUBLIC "-//x//<b onclick=alert(1)>" "y"><p>x</p>')).toEqual([
      '<!doctype html>" "y"&gt;<p>x</p>',
    ]);
    expect(renderBoth(`<!doctype html SYSTEM "x' onload='alert(1)"><p>x</p>`)).toEqual([
      '<!doctype html><p>x</p>',
    ]);
  });

  it('drops doctypes without a name, later doctypes and processing instructions', () => {
    for (const template of [
      '<!doctype><p>x</p>',
      '<!doctypehtml><p>x</p>',
      '<!doctype ><p>x</p>',
      '<?xml version="1.0"?><p>x</p>',
      '<p>x</p><!doctype html>',
    ]) {
      expect(renderBoth(template)).toEqual(['<p>x</p>']);
    }
  });

  it('does not emit a doctype from bq-html content', () => {
    for (const backend of ['auto', 'pure'] as const) {
      configureSSR({ backend });
      const { html } = renderToString('<div bq-html="content"></div>', {
        content: '<!doctype html><p>x</p>',
      });
      expect(html).toBe('<div bq-html="content"><p>x</p></div>');
    }
  });
});

describe('splitDocumentPrologue', () => {
  it('splits off a doctype after a BOM, whitespace and comments', () => {
    expect(splitDocumentPrologue('<!DOCTYPE html>\n<p>')).toEqual({
      doctype: '<!DOCTYPE html>',
      rest: '\n<p>',
      document: true,
    });
    expect(splitDocumentPrologue('\uFEFF <!-- a --><!---->\n<!doctype html><html>')).toEqual({
      doctype: '<!doctype html>',
      rest: '\uFEFF <!-- a --><!---->\n<html>',
      document: true,
    });
    expect(
      splitDocumentPrologue('<!DocType html PUBLIC "-//W3C//DTD HTML 4.01//EN" "x.dtd"><p>')
    ).toEqual({ doctype: '<!DocType html>', rest: '<p>', document: true });
  });

  it('leaves templates without a well-formed leading doctype alone', () => {
    for (const template of [
      '<p></p><!doctype html>',
      '<!doctype html',
      '<!doctype 1html>',
      '<!doctype htmlx>',
      '<!doctype html junk>',
      '<!-- unterminated <!doctype html>',
    ]) {
      expect(splitDocumentPrologue(template)).toEqual({
        doctype: '',
        rest: template,
        document: false,
      });
    }
  });

  it('detects html/head/body roots after comments and whitespace', () => {
    for (const template of ['<html>', ' <!-- c -->\n<HEAD >', '\uFEFF<!----><body/>']) {
      expect(splitDocumentPrologue(template)).toEqual({
        doctype: '',
        rest: template,
        document: true,
      });
    }
    for (const template of [
      '<header>',
      '<!-- c --><p><html>',
      '<bodyguard>',
      'x<html>',
      '< body>',
    ]) {
      expect(splitDocumentPrologue(template).document).toBe(false);
    }
  });

  it('stays linear on long runs of comment openers, spaces and doctypes', () => {
    for (const template of [
      '<!--'.repeat(100_000),
      ' '.repeat(100_000) + '<p>',
      '<!doctype'.repeat(100_000),
      '<!doctype html'.repeat(100_000),
      '<!---->'.repeat(100_000) + '<html>',
      '<!doctype html PUBLIC "'.repeat(100_000),
    ]) {
      const startedAt = performance.now();
      splitDocumentPrologue(template);
      renderToString(template, {});
      configureSSR({ backend: 'pure' });
      renderToString(template, {});
      configureSSR({ backend: 'auto' });
      expect(performance.now() - startedAt).toBeLessThan(200);
    }
  });
});

describe('SSR document detection', () => {
  // The DOM backend drops comments and the DOM-free one keeps them, which
  // shows which backend rendered a template.
  it('routes only templates rooted at html/head/body to the DOM-free renderer', () => {
    expect(renderToString('<HEAD><!-- c --></HEAD>', {}).html).toBe('<head><!-- c --></head>');
    for (const template of [
      '<header><!-- c --></header>',
      '<bodyguard><!-- c --></bodyguard>',
      '<div><body><!-- c --></body></div>',
    ]) {
      expect(renderToString(template, {}).html).not.toContain('<!--');
    }
  });
});

describe('SSR full documents with flush boundaries', () => {
  const STREAMED_PAGE = `<!DOCTYPE html>
<html lang="en">
  <head><title bq-text="title"></title></head>
  <body>
    <h1 bq-text="title"></h1>
    ${flushBoundary()}
    <ul><li bq-for="item in items" bq-text="item"></li></ul>
    ${flushBoundary()}
    <footer>end</footer>
  </body>
</html>`;

  const newContext = () => {
    const context = createSSRContext({ nonce: 'n0nce' });
    context.head.add({ meta: [{ name: 'streamed', content: 'yes' }] });
    return context;
  };

  /** Streams the page and renders it in one piece with the same options. */
  const renderBoth = async () => {
    const chunks = await readChunks(
      renderToStream(STREAMED_PAGE, DATA, { context: newContext(), includeStoreState: true })
    );
    const { html } = await renderToStringAsync(
      STREAMED_PAGE.split(flushBoundary()).join(''),
      DATA,
      { context: newContext(), includeStoreState: true }
    );
    return { chunks, html };
  };

  const expectStreamedPage = ({ chunks, html }: { chunks: string[]; html: string }): void => {
    expect(chunks).toHaveLength(3);
    expect(chunks.join('')).toBe(html);
    expect(chunks[0]).toStartWith('<!DOCTYPE html>\n<html lang="en">');
    expect(chunks[0]).toContain('<meta name="streamed" content="yes"></head>');
    expect(chunks[0]).toContain('<h1 bq-text="title">Home</h1>');
    expect(chunks[1]).toContain('<li bq-text="item">a</li><li bq-text="item">b</li>');
    for (const chunk of chunks.slice(0, 2)) {
      expect(chunk).not.toContain('</body>');
      expect(chunk).not.toContain('</html>');
    }
    const joined = chunks.join('');
    for (const tag of ['<html', '</html>', '<head>', '</head>', '<body>', '</body>', '<script']) {
      expect(count(joined, tag)).toBe(1);
    }
    expect(joined).not.toContain('bq-flush');
    expect(chunks[2]).toMatch(
      /<footer>end<\/footer>\s*<script nonce="n0nce"[^>]*>[^<]*<\/script><\/body>\s*<\/html>$/
    );
  };

  it('streams a page as one document with a global DOM installed', async () => {
    expect(typeof globalThis.DOMParser).toBe('function');
    expectStreamedPage(await renderBoth());
  });

  it('streams the same page without a DOM and on every backend', async () => {
    const withDom = await renderBoth();
    const noDom = await withoutDom(renderBoth);
    expectStreamedPage(noDom);
    expect(noDom).toEqual(withDom);
    for (const backend of ['pure', 'dom'] as const) {
      configureSSR({ backend, documentImpl: { DOMParser: globalThis.DOMParser } });
      expect(await renderBoth()).toEqual(withDom);
    }
  });

  it('streams a page whose doctype follows a comment', async () => {
    const template = `<!-- page -->${STREAMED_PAGE}`;
    const chunks = await readChunks(renderToStream(template, DATA, { includeStoreState: true }));
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toStartWith('<!DOCTYPE html><!-- page -->\n<html lang="en">');
    expect(count(chunks.join(''), '</body>')).toBe(1);
    expect(chunks[2]).toMatch(/<\/script><\/body>\s*<\/html>$/);
  });

  it('still renders fragment templates part by part', async () => {
    expect(
      await readChunks(renderToStream(`<p bq-text="title"></p>  ${flushBoundary()}<p>b</p>`, DATA))
    ).toEqual(['<p bq-text="title">Home</p>', '<p>b</p>']);
  });

  it('keeps Suspense patches inside <body> and closes the page last', async () => {
    const template = STREAMED_PAGE.split(flushBoundary())
      .join('')
      .replace('<h1 bq-text', '<h1 bq-defer="title" bq-text');
    const stream = () =>
      readChunks(
        renderToStreamSuspense(
          template,
          {
            ...DATA,
            title: defer(Promise.resolve('Late'), 'Loading'),
            extra: Promise.resolve('More'),
          },
          { context: createSSRContext({ nonce: 'n0nce' }) }
        )
      );
    const chunks = await stream();
    expect(chunks).toHaveLength(4);
    expect(chunks[0]).toStartWith('<!DOCTYPE html>\n<html lang="en">');
    expect(chunks[0]).toContain('<bq-slot id="bq-s-0">Loading</bq-slot>');
    expect(chunks[0]).not.toContain('</body>');
    expect(chunks[1]).toStartWith('<template id="bq-r-');
    expect(chunks[3]).toMatch(/^<\/body>\s*<\/html>$/);
    const joined = chunks.join('');
    expect(count(joined, '</body>')).toBe(1);
    expect(joined.indexOf('Late')).toBeLessThan(joined.indexOf('</body>'));
    expect(await withoutDom(stream)).toEqual(chunks);
  });

  it('streams Suspense fragments without holding anything back', async () => {
    const chunks = await readChunks(
      renderToStreamSuspense('<main bq-defer="title"></main>', {
        title: defer(Promise.resolve('Late'), 'Loading'),
      })
    );
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toBe('<main><bq-slot id="bq-s-0"></bq-slot></main>');
  });
});

describe('SSR document detection after a prologue', () => {
  it('keeps the wrappers after a leading comment, BOM or whitespace on every backend', () => {
    for (const [template, start] of [
      ['<!-- c --><html><body><p bq-text="title"></p></body></html>', '<!-- c --><html><body>'],
      ['\uFEFF<html><body><p bq-text="title"></p></body></html>', '<html><body>'],
      [
        '\n\t <!-- a -->\n<!-- b --><body><p bq-text="title"></p></body>',
        '<!-- a -->\n<!-- b --><body>',
      ],
      [
        '<!-- c -->\n<!DOCTYPE html><html><body><p bq-text="title"></p></body></html>',
        '<!DOCTYPE html><!-- c -->\n<html><body>',
      ],
    ]) {
      const outputs = new Set(Object.values(renderOnEveryBackend(template)));
      expect([template, [...outputs]]).toEqual([
        template,
        [
          `${start}<p bq-text="title">Home</p></body>${template.includes('</html>') ? '</html>' : ''}`,
        ],
      ]);
    }
  });

  it('treats legacy doctypes as documents and emits a rebuilt <!DOCTYPE html>', () => {
    for (const doctype of [
      '<!DOCTYPE html SYSTEM "about:legacy-compat">',
      '<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">',
      "<!doctype HTML public '-//W3C//DTD XHTML 1.0 Strict//EN'>",
    ]) {
      const template = `${doctype}\n<html><head></head><body><p bq-text="title"></p></body></html>`;
      const outputs = new Set(Object.values(renderOnEveryBackend(template)));
      expect(outputs.size).toBe(1);
      const [html] = outputs;
      expect(html).toBe(
        `<!${doctype.slice(2, 9)} html>\n<html><head></head><body><p bq-text="title">Home</p></body></html>`
      );
    }
  });

  it('never echoes the identifiers of a legacy doctype', () => {
    const template =
      '<!DOCTYPE html PUBLIC "-//EVIL//<script" SYSTEM \'javascript:alert(1)\' x="<img src=x onerror=alert(1)"' +
      '><html><body><p bq-text="title"></p></body></html>';
    for (const html of new Set(Object.values(renderOnEveryBackend(template)))) {
      expect(html).toBe('<!DOCTYPE html><html><body><p bq-text="title">Home</p></body></html>');
    }
    const context = createSSRContext();
    return renderToStringAsync(template, DATA, { context }).then(({ html }) => {
      expect(html).not.toMatch(/EVIL|alert|javascript|PUBLIC|SYSTEM/);
    });
  });
});
