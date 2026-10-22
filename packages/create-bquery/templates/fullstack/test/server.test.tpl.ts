import { describe, expect, it } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { within } from '@bquery/bquery/testing';
import { createApp } from '../server/app';

/** A cookie jar and CSRF-aware client around `app.handle()` — no port needed. */
const createClient = () => {
  const { app, notes } = createApp({ secret: 'test-secret-0123456789abcdef' });
  const cookies = new Map<string, string>();
  let csrf = '';

  const request = async (path: string, init: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(init.headers);
    if (cookies.size > 0) {
      headers.set('cookie', [...cookies].map(([name, value]) => `${name}=${value}`).join('; '));
    }
    const response = await app.handle(new Request(`http://localhost${path}`, { ...init, headers }));
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';');
      const index = pair.indexOf('=');
      cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
    if (response.headers.get('content-type')?.includes('text/html')) {
      const html = await response.clone().text();
      csrf = /name="csrf-token" content="([^"]*)"/.exec(html)?.[1] ?? csrf;
    }
    return response;
  };

  const json = (path: string, method: string, body?: unknown, token = csrf) =>
    request(path, {
      method,
      headers: { 'content-type': 'application/json', 'x-csrf-token': token },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  /** Parses an HTML response so it can be queried like a page. */
  const page = async (path: string) => {
    const response = await request(path);
    const html = await response.text();
    const document = new DOMParser().parseFromString(html, 'text/html');
    return { response, document, app: within(document.querySelector('#app')!) };
  };

  return { request, json, page, notes };
};

describe('server', () => {
  it('renders the notes from the route loader', async () => {
    const client = createClient();
    client.notes.add({ title: 'From the loader', body: 'SSR' });

    const { response, document, app } = await client.page('/');
    expect(response.status).toBe(200);
    expect(app.getByRole('heading').textContent).toBe('Notes');
    expect(app.getByText('From the loader')).toBeTruthy();
    expect(app.getByText('1 note')).toBeTruthy();
    expect(document.querySelector('#bq-state')?.textContent).toContain('From the loader');
  });

  it('rejects writes without the CSRF token', async () => {
    const client = createClient();
    await client.request('/');
    const forged = await client.json('/api/notes', 'POST', { title: 'Hi' }, 'forged');
    expect(forged.status).toBe(403);
  });

  it('validates notes with the shared rules', async () => {
    const client = createClient();
    await client.request('/');

    const invalid = await client.json('/api/notes', 'POST', { title: '   ', body: '' });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ errors: { title: 'Give the note a title.' } });

    const created = await client.json('/api/notes', 'POST', { title: '  Trimmed  ', body: 'x' });
    expect(created.status).toBe(201);
    const note = (await created.json()) as { id: string; title: string };
    expect(note.title).toBe('Trimmed');

    const detail = await client.page(`/notes/${note.id}`);
    expect(detail.response.status).toBe(200);
    expect(detail.app.getByRole('heading').textContent).toBe('Trimmed');
    expect((await client.request('/notes/missing')).status).toBe(404);

    expect((await client.json(`/api/notes/${note.id}`, 'DELETE')).status).toBe(204);
    expect((await client.json(`/api/notes/${note.id}`, 'DELETE')).status).toBe(404);
  });

  it('bundles the browser entry', async () => {
    const result = await Bun.build({
      entrypoints: [fileURLToPath(new URL('../client.ts', import.meta.url))],
      target: 'browser',
    });
    expect(result.success).toBe(true);
  });
});
