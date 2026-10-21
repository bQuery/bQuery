// `node:test` runs unchanged under `node --test`, `bun test` and `deno test`.
import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { within } from '@bquery/bquery/testing';
import { Window } from 'happy-dom';
import { handle } from '../src/app.ts';

// The server renders without a DOM. The tests parse its HTML in a separate
// happy-dom window and query it like a page.
const window = new Window({ url: 'http://localhost/' });
after(() => window.happyDOM.close());

/** Requests `path` and parses the response body. */
const visit = async (path: string) => {
  const response = await handle(new Request(`http://localhost${path}`), 'test');
  const html = await response.text();
  const document = new window.DOMParser().parseFromString(html, 'text/html') as unknown as Document;
  return { response, html, document, page: within(document.body) };
};

describe('server-rendered pages', () => {
  it('renders the home page', async () => {
    const { response, html, document, page } = await visit('/');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /text\/html/);
    assert.match(html, /^<!doctype html>/);
    assert.equal(document.title, 'Home');
    assert.equal(page.getByRole('heading').textContent, 'Home');
    assert.ok(page.getByText('This page was rendered on the server.'));
    assert.equal(document.querySelectorAll('li').length, 4);
  });

  it('answers a conditional request with 304', async () => {
    const first = await handle(new Request('http://localhost/about'), 'test');
    const etag = first.headers.get('etag');
    assert.ok(etag);

    const second = await handle(
      new Request('http://localhost/about', { headers: { 'if-none-match': etag } }),
      'test'
    );
    assert.equal(second.status, 304);
  });

  it('renders a 404 page for unknown paths', async () => {
    const { response, page } = await visit('/missing');
    assert.equal(response.status, 404);
    assert.equal(page.getByRole('heading').textContent, 'Not Found');
  });
});
