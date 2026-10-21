/**
 * Full-document SSR templates: the doctype and the `<html>`/`<head>`/`<body>`
 * wrappers survive rendering, and the output is the same whether or not a
 * global DOM (happy-dom here) is installed.
 */
import { afterEach, describe, expect, it } from 'bun:test';
import { splitLeadingDoctype } from '../src/ssr/html-parser';
import {
  configureSSR,
  createSSRContext,
  defer,
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

  it('emits only the HTML5 doctype and drops legacy or other doctypes', () => {
    for (const template of [
      '<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd"><p></p>',
      '<!doctype html SYSTEM "about:legacy-compat"><p></p>',
      '<!doctype svg><p></p>',
    ]) {
      expect(renderToString(template, {}).html).toBe('<p></p>');
    }
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
    expect(renderBoth('<!doctype html PUBLIC "-//x//<b onclick=alert(1)>" "y"><p>x</p>')).toEqual([
      '" "y"&gt;<p>x</p>',
    ]);
    expect(renderBoth(`<!doctype html SYSTEM "x' onload='alert(1)"><p>x</p>`)).toEqual([
      '<p>x</p>',
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

describe('splitLeadingDoctype', () => {
  it('splits only a leading, well-formed doctype token', () => {
    expect(splitLeadingDoctype('<!DOCTYPE html>\n<p>')).toEqual({
      doctype: '<!DOCTYPE html>',
      rest: '\n<p>',
    });
    expect(splitLeadingDoctype('<p></p><!doctype html>')).toBeNull();
    expect(splitLeadingDoctype('<!doctype html')).toBeNull();
    expect(splitLeadingDoctype('<!doctype 1html>')).toBeNull();
    expect(splitLeadingDoctype('<!doctype html junk>')).toBeNull();
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
